import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { CalendarIcon, Plus, Loader2, Users, X } from "lucide-react";
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/components/i18n/LanguageContext';

export default function UnifiedExpenseDialog({ 
  open, 
  onOpenChange, 
  categories,
  onSubmitExpense,
  onSubmitRecurring,
  onSubmitShared,
  isSubmittingExpense = false,
  isSubmittingRecurring = false,
  isSubmittingShared = false,
  defaultTab = "expense",
  user,
  isHouseholdMode,
  householdId
}) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);
  
  // Regular expense form
  const [expenseForm, setExpenseForm] = useState({
    amount: '',
    date: new Date(),
    categoryId: '',
    description: '',
    merchant: '',
    paymentMethod: '',
    installments: 1,
    showMore: false
  });

  // Recurring expense form
  const [recurringForm, setRecurringForm] = useState({
    name: '',
    amount: '',
    category_id: '',
    frequency: 'monthly',
    start_date: new Date(),
    end_date: null,
    description: '',
    is_active: true
  });

  // Shared expense form
  const [sharedForm, setSharedForm] = useState({
    amount: '',
    date: new Date(),
    categoryId: '',
    description: '',
    paidByUserId: user?.email || '',
    splitMethod: 'equal',
    participants: [],
    splits: []
  });

  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);

  const resetExpenseForm = () => {
    setExpenseForm({
      amount: '',
      date: new Date(),
      categoryId: '',
      description: '',
      merchant: '',
      paymentMethod: '',
      installments: 1,
      showMore: false
    });
  };

  const resetRecurringForm = () => {
    setRecurringForm({
      name: '',
      amount: '',
      category_id: '',
      frequency: 'monthly',
      start_date: new Date(),
      end_date: null,
      description: '',
      is_active: true
    });
  };

  const resetSharedForm = () => {
    setSharedForm({
      amount: '',
      date: new Date(),
      categoryId: '',
      description: '',
      paidByUserId: '',
      splitMethod: 'equal',
      participants: [],
      splits: []
    });
    setUserSearch('');
    setSearchResults([]);
  };

  // Shared expense functions
  const addParticipantByEmail = (email, fullName = '') => {
    if (!email || email === user?.email) {
      return;
    }

    if (sharedForm.participants.find(p => p.email === email)) {
      return;
    }

    const newParticipants = [...sharedForm.participants, {
      email: email,
      name: fullName || email
    }];

    setSharedForm({
      ...sharedForm,
      participants: newParticipants,
      splits: calculateDefaultSplits(newParticipants, sharedForm.amount, sharedForm.splitMethod)
    });
    setUserSearch('');
  };



  const removeParticipant = (email) => {
    const newParticipants = sharedForm.participants.filter(p => p.email !== email);
    setSharedForm({
      ...sharedForm,
      participants: newParticipants,
      splits: calculateDefaultSplits(newParticipants, sharedForm.amount, sharedForm.splitMethod),
      paidByUserId: sharedForm.paidByUserId === email ? '' : sharedForm.paidByUserId
    });
  };

  const calculateDefaultSplits = (participants, totalAmount, method) => {
    if (!totalAmount || participants.length === 0) return [];
    
    const total = parseFloat(totalAmount);
    if (method === 'equal') {
      const allParticipants = [{ email: user?.email, name: user?.full_name }, ...participants];
      const perPerson = total / allParticipants.length;
      const remainder = total - (perPerson * allParticipants.length);
      
      return allParticipants.map((p, i) => ({
        userId: p.email,
        userName: p.name,
        shareAmount: i === allParticipants.length - 1 
          ? perPerson + remainder 
          : perPerson,
        sharePercent: 100 / allParticipants.length
      }));
    }
    return [];
  };

  useEffect(() => {
    if (sharedForm.amount && sharedForm.splitMethod === 'equal') {
      setSharedForm(prev => ({
        ...prev,
        splits: calculateDefaultSplits(prev.participants, prev.amount, 'equal')
      }));
    }
  }, [sharedForm.amount, sharedForm.participants.length]);

  useEffect(() => {
    if (user?.email && open && activeTab === 'shared') {
      // Load available users
      const loadUsers = async () => {
        // Load always-approved list for the current user (as requester)
        let alwaysApprovedSet = new Set();
        try {
          const alwaysApproved = await base44.entities.AlwaysApprovedUser.list();
          // Users who have marked the current user as always-approved
          alwaysApproved
            .filter(r => r.approved_user_id === user.email)
            .forEach(r => alwaysApprovedSet.add(r.user_id));
        } catch (e) {}

        if (isHouseholdMode && householdId) {
          // Get household members
          const households = await base44.entities.Household.list();
          const household = households.find(h => h.id === householdId);
          if (household) {
            const members = household.member_emails
              .filter(email => email !== user.email)
              .map(email => ({
                email,
                name: email,
                alwaysApproved: alwaysApprovedSet.has(email),
              }));
            setAvailableUsers(members);
          }
        } else {
          // Fetch all registered users from UserProfile (public read)
          const profiles = await base44.entities.UserProfile.list();

          const users = profiles
            .filter(p => p.user_email !== user.email)
            .map(p => ({
              email: p.user_email,
              name: p.full_name || p.user_email,
              alwaysApproved: alwaysApprovedSet.has(p.user_email),
            }));

          setAvailableUsers(users);
        }
      };
      loadUsers();

      if (!sharedForm.paidByUserId) {
        setSharedForm(prev => ({
          ...prev,
          paidByUserId: user.email
        }));
      }
    }
  }, [user?.email, open, activeTab, isHouseholdMode, householdId]);

  const updateSplit = (index, field, value) => {
    const newSplits = [...sharedForm.splits];
    newSplits[index] = { ...newSplits[index], [field]: parseFloat(value) || 0 };
    setSharedForm({ ...sharedForm, splits: newSplits });
  };

  const handleSubmitExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.amount || !expenseForm.categoryId) return;

    const category = categories.find(c => c.id === expenseForm.categoryId);
    await onSubmitExpense({
      amount: parseFloat(expenseForm.amount),
      date: format(expenseForm.date, 'yyyy-MM-dd'),
      category_id: expenseForm.categoryId,
      category_name: category?.name || '',
      description: expenseForm.description || undefined,
      merchant: expenseForm.merchant || undefined,
      payment_method: expenseForm.paymentMethod || undefined,
      installments: expenseForm.installments,
    });

    resetExpenseForm();
  };

  const handleSubmitRecurring = async (e) => {
    e.preventDefault();
    if (!recurringForm.name || !recurringForm.amount || !recurringForm.category_id) return;

    const category = categories.find(c => c.id === recurringForm.category_id);
    await onSubmitRecurring({
      name: recurringForm.name,
      amount: parseFloat(recurringForm.amount),
      category_id: recurringForm.category_id,
      category_name: category?.name || '',
      frequency: recurringForm.frequency,
      start_date: format(recurringForm.start_date, 'yyyy-MM-dd'),
      end_date: recurringForm.end_date ? format(recurringForm.end_date, 'yyyy-MM-dd') : null,
      description: recurringForm.description || undefined,
      is_active: recurringForm.is_active
    });

    resetRecurringForm();
  };

  const handleSubmitShared = (e) => {
    e.preventDefault();
    if (isSubmittingShared) return;

    if (sharedForm.participants.length === 0) {
      toast.error(t.error_at_least_one_participant);
      return;
    }

    if (!sharedForm.paidByUserId) {
      toast.error(t.error_choose_who_paid);
      return;
    }

    const totalAmount = parseFloat(sharedForm.amount);

    let finalSplits = sharedForm.splits;
    if (!finalSplits || finalSplits.length === 0) {
      finalSplits = calculateDefaultSplits(sharedForm.participants, sharedForm.amount, sharedForm.splitMethod);
    }

    if (sharedForm.splitMethod === 'custom_amount') {
      const splitSum = finalSplits.reduce((sum, s) => sum + (s.shareAmount || 0), 0);
      if (Math.abs(splitSum - totalAmount) > 0.01) {
        toast.error(t.error_split_mismatch.replace('{sum}', splitSum.toFixed(2)).replace('{total}', totalAmount.toFixed(2)));
        return;
      }
    }

    if (sharedForm.splitMethod === 'custom_percent') {
      const percentSum = finalSplits.reduce((sum, s) => sum + (s.sharePercent || 0), 0);
      if (Math.abs(percentSum - 100) > 0.01) {
        toast.error(t.error_percent_mismatch.replace('{percent}', percentSum.toFixed(1)));
        return;
      }
      finalSplits = finalSplits.map((s, i) => ({
        ...s,
        shareAmount: i === finalSplits.length - 1
          ? totalAmount - finalSplits.slice(0, -1).reduce((sum, split) => sum + (totalAmount * split.sharePercent / 100), 0)
          : totalAmount * s.sharePercent / 100
      }));
    }

    if (!finalSplits || finalSplits.length === 0) {
      toast.error(t.error_split_calculation);
      return;
    }

    const category = categories.find(c => c.id === sharedForm.categoryId);

    // Pass all participants to the mutation - it will determine pending status
    onSubmitShared({
      total_amount: totalAmount,
      date: format(sharedForm.date, 'yyyy-MM-dd'),
      category_id: sharedForm.categoryId,
      category_name: category?.name || '',
      description: sharedForm.description,
      paid_by_user_id: sharedForm.paidByUserId,
      split_method: sharedForm.splitMethod,
      household_id: isHouseholdMode ? householdId : null,
      splits: finalSplits,
      participants: sharedForm.participants,
    });
  };

  const currentUserName = user?.full_name || user?.email || '';
  const allParticipants = [
    { email: user?.email, name: currentUserName ? `אני (${currentUserName})` : 'אני' },
    ...(sharedForm.participants || [])
  ];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        resetExpenseForm();
        resetRecurringForm();
        resetSharedForm();
        setActiveTab(defaultTab);
      }
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.add_expense_dialog_title}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="shared">{t.shared_tab}</TabsTrigger>
            <TabsTrigger value="recurring">{t.recurring_tab}</TabsTrigger>
            <TabsTrigger value="expense">{t.expense_tab}</TabsTrigger>
          </TabsList>

          {/* Regular Expense Tab */}
          <TabsContent value="expense">
            <form onSubmit={handleSubmitExpense} className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={t.amount_placeholder}
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    className="text-2xl font-semibold h-14 text-center"
                    required
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Select value={expenseForm.categoryId || undefined} onValueChange={(v) => setExpenseForm({ ...expenseForm, categoryId: v })} required>
                  <SelectTrigger className="flex-1 h-12">
                    <SelectValue placeholder={t.category_placeholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <span className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                          {cat.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-12 px-4">
                      <CalendarIcon className="h-4 w-4 ml-2" />
                      {format(expenseForm.date, 'MMM d')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={expenseForm.date}
                      onSelect={(d) => d && setExpenseForm({ ...expenseForm, date: d })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <button
                type="button"
                onClick={() => setExpenseForm({ ...expenseForm, showMore: !expenseForm.showMore })}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                {expenseForm.showMore ? t.fewer_options : t.more_options}
              </button>

              {expenseForm.showMore && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <Input
                    placeholder={t.description_optional}
                    value={expenseForm.description}
                    onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                    className="h-11"
                    dir="rtl"
                  />
                  <div className="flex gap-3">
                    <Input
                     placeholder={t.merchant_placeholder}
                     value={expenseForm.merchant}
                     onChange={(e) => setExpenseForm({ ...expenseForm, merchant: e.target.value })}
                     className="flex-1 h-11"
                     dir="rtl"
                    />
                    <Select value={expenseForm.paymentMethod || undefined} onValueChange={(v) => setExpenseForm({ ...expenseForm, paymentMethod: v })}>
                      <SelectTrigger className="flex-1 h-11">
                        <SelectValue placeholder={t.payment_method_placeholder} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">{t.payment_cash}</SelectItem>
                        <SelectItem value="credit_card">{t.payment_credit_card}</SelectItem>
                        <SelectItem value="debit_card">{t.payment_debit_card}</SelectItem>
                        <SelectItem value="bank_transfer">{t.payment_bank_transfer}</SelectItem>
                        <SelectItem value="other">{t.payment_other}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-right block">{t.installments_label}</Label>
                    <Input
                     type="number"
                     min="1"
                     max="36"
                     placeholder={t.installments_label}
                     value={expenseForm.installments}
                     onChange={(e) => setExpenseForm({ ...expenseForm, installments: parseInt(e.target.value) || 1 })}
                     className="h-11"
                     dir="ltr"
                    />
                    {expenseForm.installments > 1 && expenseForm.amount && (
                     <p className="text-xs text-slate-500 text-right">
                        {t.installments_breakdown.replace('{count}', expenseForm.installments).replace('{amount}', (parseFloat(expenseForm.amount) / expenseForm.installments).toFixed(2))}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full h-12 text-base font-medium bg-slate-900 hover:bg-slate-800"
                disabled={!expenseForm.amount || !expenseForm.categoryId || isSubmittingExpense}
              >
                {isSubmittingExpense ? (
                   <Loader2 className="h-5 w-5 animate-spin" />
                 ) : (
                   <>
                     <Plus className="h-5 w-5 ml-2" />
                     {t.add_regular_expense}
                   </>
                 )}
              </Button>
            </form>
          </TabsContent>

          {/* Recurring Expense Tab */}
          <TabsContent value="recurring">
            <form onSubmit={handleSubmitRecurring} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-right block">{t.recurring_name_label}</Label>
                <Input
                 value={recurringForm.name}
                 onChange={(e) => setRecurringForm({ ...recurringForm, name: e.target.value })}
                 placeholder={t.recurring_name_placeholder}
                 required
                 dir="rtl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-right block">{t.amount_label}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={recurringForm.amount}
                    onChange={(e) => setRecurringForm({ ...recurringForm, amount: e.target.value })}
                    className="text-lg font-semibold"
                    dir="ltr"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-right block">{t.frequency_label}</Label>
                  <Select 
                    value={recurringForm.frequency} 
                    onValueChange={(v) => setRecurringForm({ ...recurringForm, frequency: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">{t.frequency_daily}</SelectItem>
                      <SelectItem value="weekly">{t.frequency_weekly}</SelectItem>
                      <SelectItem value="monthly">{t.frequency_monthly}</SelectItem>
                      <SelectItem value="yearly">{t.frequency_yearly}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-right block">{t.category_label}</Label>
                <Select 
                  value={recurringForm.category_id || undefined} 
                  onValueChange={(v) => setRecurringForm({ ...recurringForm, category_id: v })}
                  required
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t.choose_category} />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-[300px]">
                    {categories.length === 0 ? (
                      <div className="p-4 text-center text-sm text-slate-500">
                        {t.no_categories}
                      </div>
                    ) : (
                      categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id} className="cursor-pointer">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                            <span>{cat.name}</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-right block">{t.start_date_label}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="h-4 w-4 ml-2" />
                        {format(recurringForm.start_date, 'dd/MM/yyyy')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={recurringForm.start_date}
                        onSelect={(d) => d && setRecurringForm({ ...recurringForm, start_date: d })}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label className="text-right block">{t.end_date_label}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="h-4 w-4 ml-2" />
                        {recurringForm.end_date ? format(recurringForm.end_date, 'dd/MM/yyyy') : t.no_end_date}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={recurringForm.end_date}
                        onSelect={(d) => setRecurringForm({ ...recurringForm, end_date: d })}
                      />
                      {recurringForm.end_date && (
                        <div className="p-2 border-t">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full"
                            onClick={() => setRecurringForm({ ...recurringForm, end_date: null })}
                          >
                            {t.clear_end_date}
                          </Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-right block">{t.description_label}</Label>
                <Input
                 value={recurringForm.description}
                 onChange={(e) => setRecurringForm({ ...recurringForm, description: e.target.value })}
                 placeholder={t.description_notes_placeholder}
                 dir="rtl"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl" dir="rtl">
               <Label className="cursor-pointer text-right">{t.active_label}</Label>
                <Switch
                  checked={recurringForm.is_active}
                  onCheckedChange={(checked) => setRecurringForm({ ...recurringForm, is_active: checked })}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-base font-medium bg-slate-900 hover:bg-slate-800"
                disabled={!recurringForm.name || !recurringForm.amount || !recurringForm.category_id || isSubmittingRecurring}
              >
                {isSubmittingRecurring ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-5 w-5 ml-2" />
                    {t.add_recurring_expense}
                  </>
                )}
              </Button>
            </form>
          </TabsContent>

          {/* Shared Expense Tab */}
          <TabsContent value="shared">
            <form onSubmit={handleSubmitShared} className="space-y-4">
              {/* Amount & Category */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-right block">{t.total_amount_label}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={sharedForm.amount}
                    onChange={(e) => setSharedForm({ ...sharedForm, amount: e.target.value })}
                    className="text-lg font-semibold"
                    dir="ltr"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-right block">{t.category_label}</Label>
                  <Select value={sharedForm.categoryId || undefined} onValueChange={(v) => setSharedForm({ ...sharedForm, categoryId: v })} required>
                    <SelectTrigger>
                      <SelectValue placeholder={t.choose_category} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <span className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                            {cat.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Date & Description */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-right block">{t.date_label}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="h-4 w-4 ml-2" />
                        {format(sharedForm.date, 'dd/MM/yyyy')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={sharedForm.date}
                        onSelect={(d) => d && setSharedForm({ ...sharedForm, date: d })}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label className="text-right block">{t.description_label}</Label>
                  <Input
                   value={sharedForm.description}
                   onChange={(e) => setSharedForm({ ...sharedForm, description: e.target.value })}
                   placeholder={t.description_placeholder}
                   dir="rtl"
                  />
                </div>
              </div>

              {/* Add Participants */}
              <div className="space-y-2">
                <Label className="text-right block">{t.participants_label}</Label>
                <div className="space-y-2">
                  <Input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder={t.search_participant}
                    className="flex-1"
                    dir="rtl"
                  />
                  {userSearch && (
                    <div className="border border-slate-200 rounded-lg max-h-40 overflow-y-auto">
                      {availableUsers
                        .filter(u => !sharedForm.participants.find(p => p.email === u.email) &&
                          (u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
                           u.email.toLowerCase().includes(userSearch.toLowerCase())))
                        .map((u) => (
                          <button
                            key={u.email}
                            type="button"
                            onClick={() => addParticipantByEmail(u.email, u.name)}
                            className="w-full text-right px-3 py-2 flex items-center justify-between hover:bg-slate-50 cursor-pointer"
                          >
                            <div className="text-right flex-1">
                              <div className="font-medium text-sm">{u.name}</div>
                              {u.name !== u.email && <div className="text-xs text-slate-500">{u.email}</div>}
                              {!u.alwaysApproved && (
                                <div className="text-xs mt-1">
                                  <span className="text-blue-500">{t.approval_will_send}</span>
                                </div>
                              )}
                              {u.alwaysApproved && (
                                <div className="text-xs mt-1">
                                  <span className="text-green-600">{t.approval_auto}</span>
                                </div>
                              )}
                            </div>
                            <Plus className="h-4 w-4 text-slate-400" />
                          </button>
                        ))}
                      {availableUsers.filter(u => !sharedForm.participants.find(p => p.email === u.email) &&
                        (u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
                         u.email.toLowerCase().includes(userSearch.toLowerCase()))).length === 0 && (
                        <div className="p-3 text-center text-sm text-slate-500">
                          {t.no_participants_found}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <div className="px-3 py-1 bg-slate-900 text-white rounded-full text-sm">
                    {t.me_label}
                  </div>
                  {sharedForm.participants.map((p) => (
                    <div key={p.email} className="px-3 py-1 bg-slate-100 rounded-full text-sm flex items-center gap-2">
                      {p.name}
                      <button
                        type="button"
                        onClick={() => removeParticipant(p.email)}
                        className="hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Who Paid */}
              <div className="space-y-2">
                <Label className="text-right block">{t.who_paid_label}</Label>
                <Select value={sharedForm.paidByUserId || undefined} onValueChange={(v) => setSharedForm({ ...sharedForm, paidByUserId: v })} required>
                  <SelectTrigger>
                    <SelectValue placeholder={t.choose_who_paid} />
                  </SelectTrigger>
                  <SelectContent>
                    {allParticipants.filter(p => p.email).map((p) => (
                      <SelectItem key={p.email} value={p.email}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Split Method */}
              <div className="space-y-2">
                <Label className="text-right block">{t.split_method_label}</Label>
                <Select value={sharedForm.splitMethod} onValueChange={(v) => setSharedForm({ ...sharedForm, splitMethod: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equal">{t.split_equal}</SelectItem>
                    <SelectItem value="custom_amount">{t.split_custom_amount}</SelectItem>
                    <SelectItem value="custom_percent">{t.split_custom_percent}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Splits Table */}
              {sharedForm.splits.length > 0 && (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-right p-2 text-sm font-medium">{t.split_table_participant}</th>
                        <th className="text-right p-2 text-sm font-medium">
                          {sharedForm.splitMethod === 'custom_percent' ? t.split_table_percent : t.split_table_amount}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sharedForm.splits.map((split, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="p-2">{split.userName}</td>
                          <td className="p-2">
                            {sharedForm.splitMethod === 'equal' ? (
                              <span className="font-semibold">₪{split.shareAmount.toFixed(2)}</span>
                            ) : (
                              <Input
                                type="number"
                                step={sharedForm.splitMethod === 'custom_percent' ? '0.1' : '0.01'}
                                value={sharedForm.splitMethod === 'custom_percent' ? split.sharePercent : split.shareAmount}
                                onChange={(e) => updateSplit(i, sharedForm.splitMethod === 'custom_percent' ? 'sharePercent' : 'shareAmount', e.target.value)}
                                className="w-24"
                                dir="ltr"
                              />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full h-12 text-base font-medium bg-slate-900 hover:bg-slate-800"
                disabled={isSubmittingShared || sharedForm.participants.length === 0}
              >
                {isSubmittingShared ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-5 w-5 ml-2" />
                    {t.add_shared_expense}
                  </>
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}