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
import { useCurrency } from '@/lib/CurrencyContext';
import { fetchExchangeRate } from '@/api/exchangeRate';

const SUPPORTED_CURRENCIES = ['ILS', 'USD', 'EUR'];

/**
 * Manages the exchange rate state machine for a single form tab.
 * Returns { selectedCurrency, rateStatus, exchangeRate, selectCurrency, retryFetch, resetRate }
 */
function useCurrencyRate(defaultCurrency) {
  const [selectedCurrency, setSelectedCurrency] = React.useState(defaultCurrency);
  const [rateStatus, setRateStatus] = React.useState('idle'); // 'idle'|'loading'|'ready'|'error'
  const [exchangeRate, setExchangeRate] = React.useState(null);
  const fetchGenRef = React.useRef(0);

  const doFetch = React.useCallback(async (from, to, errorMsg) => {
    const gen = ++fetchGenRef.current;
    setRateStatus('loading');
    setExchangeRate(null);
    try {
      const rate = await fetchExchangeRate(from, to);
      if (gen !== fetchGenRef.current) return;
      setExchangeRate(rate);
      setRateStatus('ready');
    } catch {
      if (gen !== fetchGenRef.current) return;
      setRateStatus('error');
      if (errorMsg) toast.error(errorMsg);
    }
  }, []);

  const selectCurrency = React.useCallback((currency, defaultCurr, errorMsg) => {
    setSelectedCurrency(currency);
    if (currency === defaultCurr) {
      setRateStatus('idle');
      setExchangeRate(null);
    } else {
      doFetch(currency, defaultCurr, errorMsg);
    }
  }, [doFetch]);

  const retryFetch = React.useCallback((defaultCurr, errorMsg) => {
    doFetch(selectedCurrency, defaultCurr, errorMsg);
  }, [doFetch, selectedCurrency]);

  const resetRate = React.useCallback((defaultCurr) => {
    setSelectedCurrency(defaultCurr);
    setRateStatus('idle');
    setExchangeRate(null);
  }, []);

  return { selectedCurrency, rateStatus, exchangeRate, selectCurrency, retryFetch, resetRate };
}

/**
 * Renders the rate info line, spinner, or error+retry below the amount field.
 */
function CurrencyRateInfo({ rateStatus, exchangeRate, fromCurrency, toSymbol, amount, t, onRetry }) {
  if (rateStatus === 'idle') return null;

  if (rateStatus === 'loading') {
    return (
      <p className="text-xs text-slate-400 flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t.currency_rate_loading}
      </p>
    );
  }

  if (rateStatus === 'error') {
    return (
      <p className="text-xs text-red-500 flex items-center gap-1">
        {t.currency_rate_error}
        <button type="button" onClick={onRetry} className="underline ml-1">
          {t.currency_rate_retry}
        </button>
      </p>
    );
  }

  // ready
  const total = amount && exchangeRate ? (parseFloat(amount) * exchangeRate).toFixed(2) : '—';
  const info = t.currency_rate_info
    .replace('{from}', fromCurrency)
    .replace('{rate}', exchangeRate?.toFixed(4) ?? '')
    .replace('{toSymbol}', toSymbol)
    .replace('{totalSymbol}', toSymbol)
    .replace('{total}', total);

  return <p className="text-xs text-slate-500">{info}</p>;
}

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
  const { t, dir } = useLanguage();
  const { currencySymbol, currencyCode } = useCurrency();
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const handleTabChange = (newTab) => {
    const getSharedSnapshot = () => {
      if (activeTab === "expense") return {
        amount: expenseForm.amount,
        categoryId: expenseForm.categoryId,
        date: expenseForm.date,
        description: expenseForm.description,
      };
      if (activeTab === "recurring") return {
        amount: recurringForm.amount,
        categoryId: recurringForm.category_id,
        date: recurringForm.start_date,
        description: recurringForm.description,
      };
      return {
        amount: sharedForm.amount,
        categoryId: sharedForm.categoryId,
        date: sharedForm.date,
        description: sharedForm.description,
      };
    };

    const snap = getSharedSnapshot();

    if (newTab === "expense") {
      setExpenseForm(prev => ({
        ...prev,
        ...(snap.amount      && { amount: snap.amount }),
        ...(snap.categoryId  && { categoryId: snap.categoryId }),
        ...(snap.date        && { date: snap.date }),
        ...(snap.description && { description: snap.description }),
      }));
    } else if (newTab === "recurring") {
      setRecurringForm(prev => ({
        ...prev,
        ...(snap.amount      && { amount: snap.amount }),
        ...(snap.categoryId  && { category_id: snap.categoryId }),
        ...(snap.date        && { start_date: snap.date }),
        ...(snap.description && { description: snap.description }),
      }));
    } else if (newTab === "shared") {
      setSharedForm(prev => ({
        ...prev,
        ...(snap.amount      && { amount: snap.amount }),
        ...(snap.categoryId  && { categoryId: snap.categoryId }),
        ...(snap.date        && { date: snap.date }),
        ...(snap.description && { description: snap.description }),
      }));
    }

    setActiveTab(newTab);
  };
  
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
  const [expenseDateOpen, setExpenseDateOpen] = useState(false);
  const [recurringStartDateOpen, setRecurringStartDateOpen] = useState(false);
  const [recurringEndDateOpen, setRecurringEndDateOpen] = useState(false);
  const [sharedDateOpen, setSharedDateOpen] = useState(false);

  const expenseRate  = useCurrencyRate(currencyCode);
  const recurringRate = useCurrencyRate(currencyCode);
  const sharedRate   = useCurrencyRate(currencyCode);

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
    expenseRate.resetRate(currencyCode);
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
    recurringRate.resetRate(currencyCode);
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
    sharedRate.resetRate(currencyCode);
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
    try {
      const isForeign = expenseRate.selectedCurrency !== currencyCode;
      const originalAmount = parseFloat(expenseForm.amount);
      const convertedAmount = isForeign ? originalAmount * expenseRate.exchangeRate : originalAmount;
      if (isForeign && !expenseRate.exchangeRate) return;

      await onSubmitExpense({
        amount: convertedAmount,
        date: format(expenseForm.date, 'yyyy-MM-dd'),
        category_id: expenseForm.categoryId,
        category_name: category?.name || '',
        description: expenseForm.description || undefined,
        merchant: expenseForm.merchant || undefined,
        payment_method: expenseForm.paymentMethod || undefined,
        installments: expenseForm.installments,
        ...(isForeign && {
          original_currency: expenseRate.selectedCurrency,
          original_amount: originalAmount,
          exchange_rate: expenseRate.exchangeRate,
        }),
      });
      resetExpenseForm();
    } catch (err) {
      // error handled by caller; do not reset form
    }
  };

  const handleSubmitRecurring = async (e) => {
    e.preventDefault();
    if (!recurringForm.name || !recurringForm.amount || !recurringForm.category_id) return;

    const category = categories.find(c => c.id === recurringForm.category_id);
    try {
      const isForeign = recurringRate.selectedCurrency !== currencyCode;
      const originalAmount = parseFloat(recurringForm.amount);
      const convertedAmount = isForeign ? originalAmount * recurringRate.exchangeRate : originalAmount;
      if (isForeign && !recurringRate.exchangeRate) return;

      await onSubmitRecurring({
        name: recurringForm.name,
        amount: convertedAmount,
        category_id: recurringForm.category_id,
        category_name: category?.name || '',
        frequency: recurringForm.frequency,
        start_date: format(recurringForm.start_date, 'yyyy-MM-dd'),
        end_date: recurringForm.end_date ? format(recurringForm.end_date, 'yyyy-MM-dd') : null,
        description: recurringForm.description || undefined,
        is_active: recurringForm.is_active,
        ...(isForeign && {
          original_currency: recurringRate.selectedCurrency,
          original_amount: originalAmount,
          exchange_rate: recurringRate.exchangeRate,
        }),
      });
      resetRecurringForm();
    } catch (err) {
      // error handled by caller; do not reset form
    }
  };

  const handleSubmitShared = async (e) => {
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
    const isForeign = sharedRate.selectedCurrency !== currencyCode;
    const convertedTotal = isForeign ? totalAmount * sharedRate.exchangeRate : totalAmount;
    if (isForeign && !sharedRate.exchangeRate) return;

    let finalSplits = sharedForm.splits;
    if (!finalSplits || finalSplits.length === 0) {
      finalSplits = calculateDefaultSplits(sharedForm.participants, convertedTotal, sharedForm.splitMethod);
    }

    if (sharedForm.splitMethod === 'custom_amount') {
      const splitSum = finalSplits.reduce((sum, s) => sum + (s.shareAmount || 0), 0);
      if (Math.abs(splitSum - convertedTotal) > 0.01) {
        toast.error(t.error_split_mismatch.replace('{sum}', splitSum.toFixed(2)).replace('{total}', convertedTotal.toFixed(2)));
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
          ? convertedTotal - finalSplits.slice(0, -1).reduce((sum, split) => sum + (convertedTotal * split.sharePercent / 100), 0)
          : convertedTotal * s.sharePercent / 100
      }));
    }

    if (!finalSplits || finalSplits.length === 0) {
      toast.error(t.error_split_calculation);
      return;
    }

    const category = categories.find(c => c.id === sharedForm.categoryId);

    // Pass all participants to the mutation - it will determine pending status
    try {
      await onSubmitShared({
        total_amount: convertedTotal,
        date: format(sharedForm.date, 'yyyy-MM-dd'),
        category_id: sharedForm.categoryId,
        category_name: category?.name || '',
        description: sharedForm.description,
        paid_by_user_id: sharedForm.paidByUserId,
        split_method: sharedForm.splitMethod,
        household_id: isHouseholdMode ? householdId : null,
        splits: finalSplits,
        participants: sharedForm.participants,
        ...(isForeign && {
          original_currency: sharedRate.selectedCurrency,
          original_amount: totalAmount,
          exchange_rate: sharedRate.exchangeRate,
        }),
      });
      resetSharedForm();
    } catch (err) {
      // error handled by caller; do not reset form
    }
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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir={dir}>
        <DialogHeader>
          <DialogTitle>{t.add_expense_dialog_title}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="shared">{t.shared_tab}</TabsTrigger>
            <TabsTrigger value="recurring">{t.recurring_tab}</TabsTrigger>
            <TabsTrigger value="expense">{t.expense_tab}</TabsTrigger>
          </TabsList>

          {/* Regular Expense Tab */}
          <TabsContent value="expense">
            <form onSubmit={handleSubmitExpense} className="space-y-4" dir={dir}>
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
                <Select
                  value={expenseRate.selectedCurrency}
                  onValueChange={(v) => expenseRate.selectCurrency(v, currencyCode, t.currency_rate_error)}
                >
                  <SelectTrigger className="w-20 h-14 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_CURRENCIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <CurrencyRateInfo
                rateStatus={expenseRate.rateStatus}
                exchangeRate={expenseRate.exchangeRate}
                fromCurrency={expenseRate.selectedCurrency}
                toSymbol={currencySymbol}
                amount={expenseForm.amount}
                t={t}
                onRetry={() => expenseRate.retryFetch(currencyCode, t.currency_rate_error)}
              />

              <div className="flex gap-3">
                <Select value={expenseForm.categoryId || undefined} onValueChange={(v) => setExpenseForm({ ...expenseForm, categoryId: v })} required>
                  <SelectTrigger className="flex-1 h-12" dir={dir}>
                    <SelectValue placeholder={t.category_placeholder} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]" dir={dir}>
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

                <Popover open={expenseDateOpen} onOpenChange={setExpenseDateOpen}>
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
                      onSelect={(d) => { if (d) { setExpenseForm({ ...expenseForm, date: d }); setExpenseDateOpen(false); } }}
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
                    dir={dir}
                  />
                  <div className="flex gap-3">
                    <Input
                     placeholder={t.merchant_placeholder}
                     value={expenseForm.merchant}
                     onChange={(e) => setExpenseForm({ ...expenseForm, merchant: e.target.value })}
                     className="flex-1 h-11"
                     dir={dir}
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
                    <Label className="text-start block">{t.installments_label}</Label>
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
                     <p className="text-xs text-slate-500 text-start">
                        {t.installments_breakdown.replace('{count}', expenseForm.installments).replace('{symbol}', currencySymbol).replace('{amount}', (parseFloat(expenseForm.amount) / expenseForm.installments).toFixed(2))}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full h-12 text-base font-medium bg-slate-900 hover:bg-slate-800"
                disabled={
                  !expenseForm.amount || !expenseForm.categoryId || isSubmittingExpense ||
                  expenseRate.rateStatus === 'loading' || expenseRate.rateStatus === 'error'
                }
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
            <form onSubmit={handleSubmitRecurring} className="space-y-4" dir={dir}>
              <div className="space-y-2">
                <Label className="text-start block">{t.recurring_name_label}</Label>
                <Input
                 value={recurringForm.name}
                 onChange={(e) => setRecurringForm({ ...recurringForm, name: e.target.value })}
                 placeholder={t.recurring_name_placeholder}
                 required
                 dir={dir}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2 col-span-2">
                  <Label className="text-start block">{t.amount_label}</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={recurringForm.amount}
                      onChange={(e) => setRecurringForm({ ...recurringForm, amount: e.target.value })}
                      className={`flex-1 text-lg font-semibold ${dir === 'rtl' ? 'text-right' : ''}`}
                      dir="ltr"
                      required
                    />
                    <Select
                      value={recurringRate.selectedCurrency}
                      onValueChange={(v) => recurringRate.selectCurrency(v, currencyCode, t.currency_rate_error)}
                    >
                      <SelectTrigger className="w-20 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPORTED_CURRENCIES.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <CurrencyRateInfo
                    rateStatus={recurringRate.rateStatus}
                    exchangeRate={recurringRate.exchangeRate}
                    fromCurrency={recurringRate.selectedCurrency}
                    toSymbol={currencySymbol}
                    amount={recurringForm.amount}
                    t={t}
                    onRetry={() => recurringRate.retryFetch(currencyCode, t.currency_rate_error)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-start block">{t.frequency_label}</Label>
                  <Select 
                    value={recurringForm.frequency} 
                    onValueChange={(v) => setRecurringForm({ ...recurringForm, frequency: v })}
                  >
                    <SelectTrigger dir={dir}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent dir={dir}>
                      <SelectItem value="daily">{t.daily}</SelectItem>
                      <SelectItem value="weekly">{t.weekly}</SelectItem>
                      <SelectItem value="monthly">{t.monthly_freq}</SelectItem>
                      <SelectItem value="yearly">{t.yearly}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-start block">{t.category_label}</Label>
                <Select 
                  value={recurringForm.category_id || undefined} 
                  onValueChange={(v) => setRecurringForm({ ...recurringForm, category_id: v })}
                  required
                >
                  <SelectTrigger className="w-full" dir={dir}>
                    <SelectValue placeholder={t.choose_category} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]" dir={dir}>
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
                  <Label className="text-start block">{t.start_date_label}</Label>
                  <Popover open={recurringStartDateOpen} onOpenChange={setRecurringStartDateOpen}>
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
                        onSelect={(d) => { if (d) { setRecurringForm({ ...recurringForm, start_date: d }); setRecurringStartDateOpen(false); } }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label className="text-start block">{t.end_date_label}</Label>
                  <Popover open={recurringEndDateOpen} onOpenChange={setRecurringEndDateOpen}>
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
                        onSelect={(d) => { setRecurringForm({ ...recurringForm, end_date: d }); setRecurringEndDateOpen(false); }}
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
                <Label className="text-start block">{t.description_label}</Label>
                <Input
                 value={recurringForm.description}
                 onChange={(e) => setRecurringForm({ ...recurringForm, description: e.target.value })}
                 placeholder={t.description_notes_placeholder}
                 dir={dir}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl" dir={dir}>
               <Label className="cursor-pointer text-start">{t.active_label}</Label>
                <Switch
                  checked={recurringForm.is_active}
                  onCheckedChange={(checked) => setRecurringForm({ ...recurringForm, is_active: checked })}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-base font-medium bg-slate-900 hover:bg-slate-800"
                disabled={
                  !recurringForm.name || !recurringForm.amount || !recurringForm.category_id ||
                  isSubmittingRecurring ||
                  recurringRate.rateStatus === 'loading' || recurringRate.rateStatus === 'error'
                }
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
            <form onSubmit={handleSubmitShared} className="space-y-4" dir={dir}>
              {/* Amount & Category */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2 col-span-2">
                  <Label className="text-start block">{t.total_amount_label}</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={sharedForm.amount}
                      onChange={(e) => setSharedForm({ ...sharedForm, amount: e.target.value })}
                      className={`flex-1 text-lg font-semibold ${dir === 'rtl' ? 'text-right' : ''}`}
                      dir="ltr"
                      required
                    />
                    <Select
                      value={sharedRate.selectedCurrency}
                      onValueChange={(v) => sharedRate.selectCurrency(v, currencyCode, t.currency_rate_error)}
                    >
                      <SelectTrigger className="w-20 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPORTED_CURRENCIES.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <CurrencyRateInfo
                    rateStatus={sharedRate.rateStatus}
                    exchangeRate={sharedRate.exchangeRate}
                    fromCurrency={sharedRate.selectedCurrency}
                    toSymbol={currencySymbol}
                    amount={sharedForm.amount}
                    t={t}
                    onRetry={() => sharedRate.retryFetch(currencyCode, t.currency_rate_error)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-start block">{t.category_label}</Label>
                  <Select value={sharedForm.categoryId || undefined} onValueChange={(v) => setSharedForm({ ...sharedForm, categoryId: v })} required>
                    <SelectTrigger dir={dir}>
                      <SelectValue placeholder={t.choose_category} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]" dir={dir}>
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
                  <Label className="text-start block">{t.date_label}</Label>
                  <Popover open={sharedDateOpen} onOpenChange={setSharedDateOpen}>
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
                        onSelect={(d) => { if (d) { setSharedForm({ ...sharedForm, date: d }); setSharedDateOpen(false); } }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label className="text-start block">{t.description_label}</Label>
                  <Input
                   value={sharedForm.description}
                   onChange={(e) => setSharedForm({ ...sharedForm, description: e.target.value })}
                   placeholder={t.description_placeholder}
                   dir={dir}
                  />
                </div>
              </div>

              {/* Add Participants */}
              <div className="space-y-2">
                <Label className="text-start block">{t.participants_label}</Label>
                <div className="space-y-2">
                  <Input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder={t.search_participant}
                    className="flex-1"
                    dir={dir}
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
                            className="w-full text-start px-3 py-2 flex items-center justify-between hover:bg-slate-50 cursor-pointer"
                          >
                            <div className="text-start flex-1">
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
                <Label className="text-start block">{t.who_paid_label}</Label>
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
                <Label className="text-start block">{t.split_method_label}</Label>
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
                        <th className="text-start p-2 text-sm font-medium">{t.split_table_participant}</th>
                        <th className="text-start p-2 text-sm font-medium">
                          {sharedForm.splitMethod === 'custom_percent' ? t.split_table_percent : t.split_table_amount.replace('{symbol}', currencySymbol)}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sharedForm.splits.map((split, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="p-2">{split.userName}</td>
                          <td className="p-2">
                            {sharedForm.splitMethod === 'equal' ? (
                              <span className="font-semibold">{currencySymbol}{split.shareAmount.toFixed(2)}</span>
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
                disabled={
                  isSubmittingShared || sharedForm.participants.length === 0 ||
                  sharedRate.rateStatus === 'loading' || sharedRate.rateStatus === 'error'
                }
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