import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, parseISO } from "date-fns";
import { CalendarIcon, Loader2, X, UserPlus, Search } from "lucide-react";
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useCurrency } from '@/lib/CurrencyContext';
import { useLanguage } from '@/components/i18n/LanguageContext';

export default function EditSharedExpenseDialog({
  open,
  onOpenChange,
  sharedExpense,
  splits,
  categories,
  onSave,
  isLoading = false
}) {
  const { currencySymbol } = useCurrency();
  const { dir } = useLanguage();
  const [form, setForm] = useState({
    amount: '',
    date: new Date(),
    categoryId: '',
    description: '',
    paidByUserId: '',
    splitMethod: 'equal',
    splits: [],
    removedParticipants: []
  });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddUser, setShowAddUser] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: settings } = useQuery({
    queryKey: ['settings', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const list = await base44.entities.UserSettings.filter({ user_email: user.email });
      return list[0] || null;
    },
    enabled: !!user?.email,
  });

  const isHouseholdMode = settings?.mode === 'household' && settings?.current_household_id;

  const { data: household } = useQuery({
    queryKey: ['household', settings?.current_household_id],
    queryFn: async () => {
      if (!settings?.current_household_id) return null;
      const households = await base44.entities.Household.filter({ id: settings.current_household_id });
      return households[0] || null;
    },
    enabled: !!settings?.current_household_id && isHouseholdMode,
  });

  const availableUsers = React.useMemo(() => {
    if (!isHouseholdMode || !household) return [];
    
    const allUsers = [
      { email: household.owner_email, name: household.owner_email },
      ...(household.member_emails || []).map(email => ({ email, name: email }))
    ];
    
    const currentUserIds = form.splits.map(s => s.userId);
    return allUsers.filter(u => !currentUserIds.includes(u.email));
  }, [isHouseholdMode, household, form.splits]);

  useEffect(() => {
    if (sharedExpense && splits) {
      setForm({
        amount: sharedExpense.total_amount?.toString() || '',
        date: sharedExpense.date ? parseISO(sharedExpense.date) : new Date(),
        categoryId: sharedExpense.category_id || '',
        description: sharedExpense.description || '',
        paidByUserId: sharedExpense.paid_by_user_id || '',
        splitMethod: sharedExpense.split_method || 'equal',
        splits: splits.map(s => ({
          userId: s.user_id,
          userName: s.user_name,
          shareAmount: s.share_amount,
          sharePercent: s.share_percent || 0
        })),
        removedParticipants: []
      });
    }
  }, [sharedExpense, splits]);

  const addParticipant = (userEmail) => {
    if (!userEmail || !userEmail.trim()) return;
    if (form.splits.some(s => s.userId === userEmail)) {
      toast.error('משתתף זה כבר נמצא ברשימה');
      return;
    }
    
    const newSplits = [...form.splits, {
      userId: userEmail.trim(),
      userName: userEmail.trim(),
      shareAmount: 0,
      sharePercent: 0
    }];
    
    setForm({ ...form, splits: newSplits });
    setSearchQuery('');
    setShowAddUser(false);
    
    if (form.splitMethod === 'equal' && form.amount) {
      setTimeout(() => recalculateEqualSplits(), 0);
    }
  };
  
  const addParticipantByEmail = () => {
    const email = searchQuery.trim();
    if (!email) return;
    
    // Basic email validation
    if (!email.includes('@')) {
      toast.error('נא להזין כתובת מייל תקינה');
      return;
    }
    
    addParticipant(email);
  };

  const removeParticipant = (index) => {
    const removed = form.splits[index];
    const newSplits = form.splits.filter((_, i) => i !== index);
    
    // Track removed participants for deletion
    const isOriginalParticipant = splits?.some(s => s.user_id === removed.userId);
    const removedList = isOriginalParticipant 
      ? [...form.removedParticipants, removed.userId]
      : form.removedParticipants;
    
    let newPaidByUserId = form.paidByUserId;
    if (form.paidByUserId === removed.userId) {
      newPaidByUserId = '';
    }
    
    const updatedForm = { ...form, splits: newSplits, removedParticipants: removedList, paidByUserId: newPaidByUserId };
    setForm(updatedForm);
    
    // Recalculate splits after state update
    if (form.splitMethod === 'equal' && form.amount && newSplits.length > 0) {
      setTimeout(() => {
        const total = parseFloat(form.amount);
        const perPerson = total / newSplits.length;
        const remainder = total - (perPerson * newSplits.length);
        
        const recalculated = newSplits.map((s, i) => ({
          ...s,
          shareAmount: i === newSplits.length - 1 
            ? perPerson + remainder 
            : perPerson,
          sharePercent: 100 / newSplits.length
        }));
        
        setForm(prev => ({ ...prev, splits: recalculated }));
      }, 0);
    }
  };

  const updateSplit = (index, field, value) => {
    const newSplits = [...form.splits];
    newSplits[index] = { ...newSplits[index], [field]: parseFloat(value) || 0 };
    setForm({ ...form, splits: newSplits });
  };

  const recalculateEqualSplits = () => {
    const total = parseFloat(form.amount);
    if (!total || form.splits.length === 0) return;
    
    const perPerson = total / form.splits.length;
    const remainder = total - (perPerson * form.splits.length);
    
    const newSplits = form.splits.map((s, i) => ({
      ...s,
      shareAmount: i === form.splits.length - 1 
        ? perPerson + remainder 
        : perPerson,
      sharePercent: 100 / form.splits.length
    }));
    
    setForm({ ...form, splits: newSplits });
  };

  useEffect(() => {
    if (form.amount && form.splitMethod === 'equal' && form.splits.length > 0) {
      recalculateEqualSplits();
    }
  }, [form.amount, form.splitMethod]);

  const validateAndSubmit = async (e) => {
    e.preventDefault();
    
    const totalAmount = parseFloat(form.amount);
    
    if (form.splitMethod === 'custom_amount') {
      const splitSum = form.splits.reduce((sum, s) => sum + (s.shareAmount || 0), 0);
      if (Math.abs(splitSum - totalAmount) > 0.01) {
        toast.error(`סכום החלוקה (${splitSum.toFixed(2)}) לא שווה לסכום הכולל (${totalAmount.toFixed(2)})`);
        return;
      }
    }
    
    if (form.splitMethod === 'custom_percent') {
      const percentSum = form.splits.reduce((sum, s) => sum + (s.sharePercent || 0), 0);
      if (Math.abs(percentSum - 100) > 0.01) {
        toast.error(`סכום האחוזים (${percentSum.toFixed(1)}%) חייב להיות 100%`);
        return;
      }
      // Convert percents to amounts
      const newSplits = form.splits.map((s, i) => ({
        ...s,
        shareAmount: i === form.splits.length - 1
          ? totalAmount - form.splits.slice(0, -1).reduce((sum, split) => sum + (totalAmount * split.sharePercent / 100), 0)
          : totalAmount * s.sharePercent / 100
      }));
      setForm({ ...form, splits: newSplits });
    }

    const category = categories.find(c => c.id === form.categoryId);
    
    await onSave({
      total_amount: totalAmount,
      date: format(form.date, 'yyyy-MM-dd'),
      category_id: form.categoryId,
      category_name: category?.name || '',
      description: form.description,
      paid_by_user_id: form.paidByUserId,
      split_method: form.splitMethod,
      splits: form.splits,
      removedParticipants: form.removedParticipants
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir={dir}>
        <DialogHeader>
          <DialogTitle>ערוך הוצאה משותפת</DialogTitle>
          <p className="text-sm text-slate-500 mt-1">
            שינויים ישפיעו על כל המשתתפים
          </p>
        </DialogHeader>

        <form onSubmit={validateAndSubmit} className="space-y-4" dir={dir}>
          {/* Amount & Category */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>סכום כולל</Label>
              <Input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="text-lg font-semibold"
                dir="ltr"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>קטגוריה</Label>
              <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })} required>
                <SelectTrigger>
                  <SelectValue placeholder="בחר קטגוריה" />
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
              <Label>תאריך</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="h-4 w-4 ml-2" />
                    {format(form.date, 'dd/MM/yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={form.date}
                    onSelect={(d) => d && setForm({ ...form, date: d })}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>תיאור</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="למשל: ארוחת ערב"
              />
            </div>
          </div>

          {/* Who Paid */}
          <div className="space-y-2">
            <Label>מי שילם?</Label>
            <Select value={form.paidByUserId} onValueChange={(v) => setForm({ ...form, paidByUserId: v })} required>
              <SelectTrigger>
                <SelectValue placeholder="בחר מי שילם" />
              </SelectTrigger>
              <SelectContent>
                {form.splits.map((s) => (
                  <SelectItem key={s.userId} value={s.userId}>
                    {s.userName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Split Method */}
          <div className="space-y-2">
            <Label>שיטת חלוקה</Label>
            <Select value={form.splitMethod} onValueChange={(v) => setForm({ ...form, splitMethod: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equal">חלוקה שווה</SelectItem>
                <SelectItem value="custom_amount">סכומים מותאמים</SelectItem>
                <SelectItem value="custom_percent">אחוזים מותאמים</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Splits Table */}
          {form.splits.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>משתתפים ({form.splits.length})</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddUser(!showAddUser)}
                  className="text-blue-600"
                >
                  <UserPlus className="h-4 w-4 ml-1" />
                  הוסף משתתף
                </Button>
              </div>

              {showAddUser && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="הזן מייל או חפש..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pr-10"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addParticipantByEmail();
                          }
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={addParticipantByEmail}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      הוסף
                    </Button>
                  </div>
                  
                  {availableUsers.length > 0 && (
                    <>
                      <div className="text-xs text-slate-500 px-1">משתמשים בבית המשותף:</div>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {availableUsers
                          .filter(u => !searchQuery || u.email.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map(u => (
                            <button
                              key={u.email}
                              type="button"
                              onClick={() => addParticipant(u.email)}
                              className="w-full text-start px-3 py-2 hover:bg-white rounded-md transition-colors text-sm"
                            >
                              {u.email}
                            </button>
                          ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-start p-2 text-sm font-medium">משתתף</th>
                      <th className="text-start p-2 text-sm font-medium">
                        {form.splitMethod === 'custom_percent' ? 'אחוז (%)' : `סכום (${currencySymbol})`}
                      </th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.splits.map((split, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="p-2">{split.userName}</td>
                        <td className="p-2">
                          {form.splitMethod === 'equal' ? (
                            <span className="font-semibold">{currencySymbol}{split.shareAmount.toFixed(2)}</span>
                          ) : (
                            <Input
                              type="number"
                              step={form.splitMethod === 'custom_percent' ? '0.1' : '0.01'}
                              value={form.splitMethod === 'custom_percent' ? split.sharePercent : split.shareAmount}
                              onChange={(e) => updateSplit(i, form.splitMethod === 'custom_percent' ? 'sharePercent' : 'shareAmount', e.target.value)}
                              className="w-24"
                              dir="ltr"
                            />
                          )}
                        </td>
                        <td className="p-2">
                          {form.splits.length > 1 && split.userId !== user?.email && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm(`האם להסיר את ${split.userName} מההוצאה?`)) {
                                  removeParticipant(i);
                                }
                              }}
                              className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button 
              type="button"
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              ביטול
            </Button>
            <Button 
              type="submit" 
              className="flex-1 bg-slate-900 hover:bg-slate-800"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'שמור שינויים'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}