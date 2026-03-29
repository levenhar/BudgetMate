import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Plus, TrendingUp, TrendingDown, AlertCircle, Pencil, Trash2, DollarSign, Receipt } from 'lucide-react';
import { format, endOfMonth } from 'date-fns';
import { toast } from 'sonner';

import { useLanguage } from '@/components/i18n/LanguageContext';
import { useCurrency } from '@/lib/CurrencyContext';

export default function Budget() {
  const { t, dir } = useLanguage();
  const { currencySymbol } = useCurrency();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM-01'));
  const [showDialog, setShowDialog] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [quickEditCategory, setQuickEditCategory] = useState(null);
  const [quickEditValue, setQuickEditValue] = useState('');
  const [quickEditMode, setQuickEditMode] = useState('amount');

  // Form state
  const [inputMode, setInputMode] = useState('amount'); // 'amount' or 'percentage'
  const [formTotalBudget, setFormTotalBudget] = useState('');
  const [categoryInputs, setCategoryInputs] = useState({});
  const [previousInputMode, setPreviousInputMode] = useState('amount');

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

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.Category.filter({ user_email: user.email });
    },
    enabled: !!user?.email,
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.Budget.filter({ created_by: user.email });
    },
    enabled: !!user?.email,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses-budget', selectedMonth, user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.Expense.filter({ user_email: user.email });
    },
    enabled: !!user?.email,
  });

  const { data: recurringExpenses = [] } = useQuery({
    queryKey: ['recurring-budget', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.RecurringExpense.filter({ user_email: user.email, is_active: true });
    },
    enabled: !!user?.email,
  });

  // Filter expenses for selected month
  const monthExpenses = useMemo(() => {
    const monthStart = format(new Date(selectedMonth), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(new Date(selectedMonth)), 'yyyy-MM-dd');
    return expenses.filter(e => e.date >= monthStart && e.date <= monthEnd);
  }, [expenses, selectedMonth]);

  // Calculate spending by category (including recurring)
  const spendingByCategory = useMemo(() => {
    const result = {};
    
    // Add regular expenses
    monthExpenses.forEach(expense => {
      if (!result[expense.category_id]) {
        result[expense.category_id] = {
          spent: 0,
          category_name: expense.category_name,
        };
      }
      result[expense.category_id].spent += expense.amount;
    });

    // Add recurring expenses (monthly equivalent) - only if active for selected month
    const monthStart = new Date(selectedMonth);
    const monthEnd = endOfMonth(new Date(selectedMonth));
    
    recurringExpenses.forEach(recurring => {
      if (!recurring.is_active) return;
      
      const startDate = new Date(recurring.start_date);
      const endDate = recurring.end_date ? new Date(recurring.end_date) : null;
      if (startDate > monthEnd) return;
      if (endDate && endDate < monthStart) return;
      
      let monthlyAmount = 0;
      
      switch (recurring.frequency) {
        case 'daily':
          monthlyAmount = recurring.amount * 30;
          break;
        case 'weekly':
          monthlyAmount = recurring.amount * 4.33;
          break;
        case 'monthly':
          monthlyAmount = recurring.amount;
          break;
        case 'yearly':
          monthlyAmount = recurring.amount / 12;
          break;
      }

      if (!result[recurring.category_id]) {
        result[recurring.category_id] = {
          spent: 0,
          category_name: recurring.category_name,
        };
      }
      result[recurring.category_id].spent += monthlyAmount;
    });

    return result;
  }, [monthExpenses, recurringExpenses, selectedMonth]);

  const totalSpent = useMemo(() => {
    let total = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
    
    // Add recurring expenses - only if active for selected month
    const monthStart = new Date(selectedMonth);
    const monthEnd = endOfMonth(new Date(selectedMonth));
    
    recurringExpenses.forEach(recurring => {
      if (!recurring.is_active) return;
      
      const startDate = new Date(recurring.start_date);
      const endDate = recurring.end_date ? new Date(recurring.end_date) : null;
      if (startDate > monthEnd) return;
      if (endDate && endDate < monthStart) return;
      
      switch (recurring.frequency) {
        case 'daily':
          total += recurring.amount * 30;
          break;
        case 'weekly':
          total += recurring.amount * 4.33;
          break;
        case 'monthly':
          total += recurring.amount;
          break;
        case 'yearly':
          total += recurring.amount / 12;
          break;
      }
    });
    
    return total;
  }, [monthExpenses, recurringExpenses, selectedMonth]);

  // Mutations
  const createBudgetMutation = useMutation({
    mutationFn: (data) => base44.entities.Budget.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success(t.budget_created);
      setShowDialog(false);
      resetForms();
    },
    onError: () => toast.error(t.budget_create_error),
  });

  const bulkCreateBudgetMutation = useMutation({
    mutationFn: (data) => base44.entities.Budget.bulkCreate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success(t.budget_created);
      setShowDialog(false);
      resetForms();
    },
    onError: () => toast.error(t.budget_create_error),
  });

  const updateBudgetMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Budget.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success(t.budget_updated);
      setEditingBudget(null);
    },
    onError: () => toast.error(t.budget_update_error),
  });

  const deleteBudgetMutation = useMutation({
    mutationFn: (id) => base44.entities.Budget.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success(t.budget_deleted);
    },
    onError: () => toast.error(t.budget_delete_error),
  });

  const resetForms = () => {
    setInputMode('amount');
    setFormTotalBudget('');
    setCategoryInputs({});
    setPreviousInputMode('amount');
  };

  const handleQuickEdit = (budget) => {
    const mode = budgetTypeForMonth === 'total' ? 'percentage' : 'amount';
    setQuickEditCategory(budget);
    setQuickEditMode(mode);
    
    if (mode === 'percentage') {
      setQuickEditValue(budget.percentage?.toString() || '');
    } else {
      setQuickEditValue(budget.amount?.toString() || '');
    }
  };

  // Calculate available percentage for quick edit
  const availablePercentage = useMemo(() => {
    if (!quickEditCategory || quickEditMode !== 'percentage') return 0;
    
    const totalUsed = budgets.reduce((sum, b) => {
      if (b.id === quickEditCategory.id) return sum;
      return sum + (b.percentage || 0);
    }, 0);
    
    return 100 - totalUsed;
  }, [budgets, quickEditCategory, quickEditMode]);

  const saveQuickEdit = async () => {
    if (!quickEditCategory || !quickEditValue) return;
    
    const newValue = parseFloat(quickEditValue);
    if (newValue <= 0) {
      toast.error(quickEditMode === 'percentage' ? t.percent_must_be_positive : t.amount_must_be_positive);
      return;
    }

    if (quickEditMode === 'percentage') {
      const currentPercentage = quickEditCategory.percentage || 0;
      const percentageChange = newValue - currentPercentage;

      if (percentageChange > availablePercentage) {
        toast.error(t.percent_limit_exceeded.replace('{n}', availablePercentage.toFixed(1)));
        return;
      }
      
      const totalBudget = quickEditCategory.total_budget || 0;
      const newAmount = (totalBudget * newValue) / 100;
      
      await updateBudgetMutation.mutateAsync({
        id: quickEditCategory.id,
        data: { 
          percentage: newValue,
          amount: newAmount
        }
      });
    } else {
      await updateBudgetMutation.mutateAsync({
        id: quickEditCategory.id,
        data: { amount: newValue }
      });
    }
    
    setQuickEditCategory(null);
    setQuickEditValue('');
  };

  const handleCreateBudget = () => {
    // Check if editing existing budget
    if (hasBudget) {
      // Delete old budgets and create new ones
      Promise.all(budgets.map(b => base44.entities.Budget.delete(b.id))).then(() => {
        createNewBudget();
      });
    } else {
      createNewBudget();
    }
  };

  const createNewBudget = () => {
    if (inputMode === 'amount') {
      // Create budgets with absolute amounts
      const budgetItems = Object.entries(categoryInputs)
        .filter(([_, amount]) => amount && parseFloat(amount) > 0)
        .map(([categoryId, amount]) => {
          const category = categories.find(c => c.id === categoryId);
          return {
            budget_type: 'per_category',
            category_id: categoryId,
            category_name: category?.name,
            amount: parseFloat(amount),
            user_email: user.email,
          };
        });

      if (budgetItems.length === 0) return;
      bulkCreateBudgetMutation.mutate(budgetItems);
    } else {
      // Create budgets with percentages
      const total = parseFloat(formTotalBudget);
      const budgetItems = Object.entries(categoryInputs)
        .filter(([_, percentage]) => percentage && parseFloat(percentage) > 0)
        .map(([categoryId, percentage]) => {
          const category = categories.find(c => c.id === categoryId);
          return {
            budget_type: 'total',
            total_budget: total,
            category_id: categoryId,
            category_name: category?.name,
            percentage: parseFloat(percentage),
            amount: (total * parseFloat(percentage)) / 100,
            user_email: user.email,
          };
        });

      if (budgetItems.length === 0) return;
      bulkCreateBudgetMutation.mutate(budgetItems);
    }
  };

  const updateCategoryInput = (categoryId, value) => {
    setCategoryInputs({ ...categoryInputs, [categoryId]: value });
  };

  // Handle mode change with conversion
  const handleModeChange = (newMode) => {
    if (newMode === previousInputMode) {
      setInputMode(newMode);
      return;
    }

    if (newMode === 'amount' && previousInputMode === 'percentage') {
      // Convert from percentage to amount
      const total = parseFloat(formTotalBudget);
      if (total > 0) {
        const newInputs = {};
        Object.entries(categoryInputs).forEach(([catId, percentage]) => {
          if (percentage && parseFloat(percentage) > 0) {
            newInputs[catId] = ((total * parseFloat(percentage)) / 100).toFixed(2);
          }
        });
        setCategoryInputs(newInputs);
      }
      setFormTotalBudget('');
    } else if (newMode === 'percentage' && previousInputMode === 'amount') {
      // Convert from amount to percentage
      const totalAmount = Object.values(categoryInputs).reduce(
        (sum, v) => sum + (parseFloat(v) || 0), 0
      );
      if (totalAmount > 0) {
        const newInputs = {};
        Object.entries(categoryInputs).forEach(([catId, amount]) => {
          if (amount && parseFloat(amount) > 0) {
            newInputs[catId] = ((parseFloat(amount) / totalAmount) * 100).toFixed(1);
          }
        });
        setCategoryInputs(newInputs);
        setFormTotalBudget(totalAmount.toFixed(2));
      }
    }

    setInputMode(newMode);
    setPreviousInputMode(newMode);
  };

  const totalPercentage = useMemo(() => {
    if (inputMode !== 'percentage') return 0;
    return Object.values(categoryInputs).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  }, [categoryInputs, inputMode]);

  const canSubmit = useMemo(() => {
    const hasValues = Object.values(categoryInputs).some(v => v && parseFloat(v) > 0);
    if (!hasValues) return false;
    
    if (inputMode === 'percentage') {
      const hasTotalBudget = formTotalBudget && parseFloat(formTotalBudget) > 0;
      const percentageValid = totalPercentage > 0 && totalPercentage <= 100;
      return hasTotalBudget && percentageValid;
    }
    return true;
  }, [categoryInputs, inputMode, formTotalBudget, totalPercentage]);



  // Check if budget exists for this month
  const hasBudget = budgets.length > 0;
  const budgetTypeForMonth = budgets[0]?.budget_type;

  // Calculate total budget
  const totalBudget = useMemo(() => {
    if (budgetTypeForMonth === 'total') {
      return budgets[0]?.total_budget || 0;
    }
    return budgets.reduce((sum, b) => sum + (b.amount || 0), 0);
  }, [budgets, budgetTypeForMonth]);

  const remainingBudget = totalBudget - totalSpent;
  const budgetProgress = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6" dir={dir}>
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{t.budget}</h1>
            <p className="text-slate-500 mt-1 text-sm sm:text-base">{t.no_budget_desc}</p>
          </div>
          {!hasBudget && (
            <Button onClick={() => setShowDialog(true)} className="bg-slate-900 hover:bg-slate-800 shrink-0">
              <Plus className="h-5 w-5 ms-2" />
              {t.set_budget}
            </Button>
          )}
        </div>

        {hasBudget ? (
          <>
            {/* Overview Card */}
            <Card className="p-4 sm:p-6">
              <div className="flex flex-col gap-4 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="text-lg sm:text-xl font-semibold text-slate-900">{t.budget_overview}</h2>
                    <p className="text-sm text-slate-500 mt-1">{t.fixed_monthly_budget}</p>
                  </div>
                  <Input
                    type="month"
                    value={selectedMonth.substring(0, 7)}
                    onChange={(e) => setSelectedMonth(e.target.value + '-01')}
                    className="w-full sm:w-40"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none"
                    onClick={() => {
                      const inputs = {};
                      const budgetType = budgets[0]?.budget_type;
                      const mode = budgetType === 'total' ? 'percentage' : 'amount';
                      budgets.forEach(b => {
                        if (budgetType === 'total') {
                          inputs[b.category_id] = b.percentage?.toString() || '';
                        } else {
                          inputs[b.category_id] = b.amount?.toString() || '';
                        }
                      });
                      setCategoryInputs(inputs);
                      setInputMode(mode);
                      setPreviousInputMode(mode);
                      setFormTotalBudget(budgets[0]?.total_budget?.toString() || '');
                      setShowDialog(true);
                    }}
                  >
                    <Pencil className="h-4 w-4 ms-2" />
                    {t.edit_budget}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none"
                    onClick={() => {
                      budgets.forEach(b => deleteBudgetMutation.mutate(b.id));
                    }}
                  >
                    <Trash2 className="h-4 w-4 ms-2" />
                    {t.delete_budget}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-slate-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-slate-600 mb-2">
                    <DollarSign className="h-4 w-4" />
                    <span className="text-sm">{t.total_budget}</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{currencySymbol}{totalBudget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>

                <div className="bg-slate-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-slate-600 mb-2">
                    <TrendingDown className="h-4 w-4" />
                    <span className="text-sm">{t.spent}</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{currencySymbol}{totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>

                <div className={`bg-slate-50 rounded-xl p-4 ${remainingBudget < 0 ? 'border-2 border-red-300' : ''}`}>
                  <div className="flex items-center gap-2 text-slate-600 mb-2">
                    {remainingBudget >= 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm">{t.remaining}</span>
                  </div>
                  <p className={`text-2xl font-bold ${remainingBudget >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {currencySymbol}{remainingBudget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{t.progress}</span>
                  <span className="font-medium">{budgetProgress.toFixed(1)}%</span>
                </div>
                <Progress 
                  value={Math.min(budgetProgress, 100)} 
                  className={budgetProgress > 100 ? 'bg-red-100' : ''}
                />
                {budgetProgress > 100 && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {t.budget_exceeded}
                  </p>
                )}
              </div>
            </Card>

            {/* Category Breakdown */}
            <Card className="p-4 sm:p-6">
              <div className="mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-semibold text-slate-900">{t.category_breakdown}</h2>
                <p className="text-xs text-slate-500 mt-1">{t.right_click_hint}</p>
              </div>
              <div className="space-y-4">
                {budgets.map(budget => {
                  const spent = spendingByCategory[budget.category_id]?.spent || 0;
                  const categoryBudget = budget.amount || 0;
                  const percentage = categoryBudget > 0 ? (spent / categoryBudget) * 100 : 0;
                  const remaining = categoryBudget - spent;
                  const category = categories.find(c => c.id === budget.category_id);

                  return (
                    <ContextMenu key={budget.id}>
                      <ContextMenuTrigger>
                        <div 
                          className="border border-slate-200 rounded-xl p-4 cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all"
                          onClick={() => {
                            const monthStart = format(new Date(selectedMonth), 'yyyy-MM-dd');
                            const monthEnd = format(endOfMonth(new Date(selectedMonth)), 'yyyy-MM-dd');
                            navigate(createPageUrl('Expenses') + `?category=${encodeURIComponent(budget.category_name)}&dateFrom=${monthStart}&dateTo=${monthEnd}`);
                          }}
                        >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${category?.color || '#94a3b8'}20` }}
                          >
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: category?.color || '#94a3b8' }}
                            />
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-900">{budget.category_name}</h3>
                            {budgetTypeForMonth === 'total' && (
                              <p className="text-xs text-slate-500">{budget.percentage}{t.percent_of_budget}</p>
                            )}
                          </div>
                        </div>
                        <div className="sm:text-end text-start ps-13 sm:ps-0">
                          <p className="text-sm text-slate-600">
                            {currencySymbol}{spent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {currencySymbol}{categoryBudget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <p className={`text-sm font-medium ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {t.remaining_short}: {currencySymbol}{remaining.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                      <Progress value={Math.min(percentage, 100)} className={percentage > 100 ? 'bg-red-100' : ''} />
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent align="start">
                    <ContextMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuickEdit(budget);
                      }}
                    >
                      <Pencil className="h-4 w-4 me-2" />
                      {t.edit_budget}
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        const monthStart = format(new Date(selectedMonth), 'yyyy-MM-dd');
                        const monthEnd = format(endOfMonth(new Date(selectedMonth)), 'yyyy-MM-dd');
                        navigate(createPageUrl('Expenses') + `?category=${encodeURIComponent(budget.category_name)}&dateFrom=${monthStart}&dateTo=${monthEnd}`);
                      }}
                    >
                      <Receipt className="h-4 w-4 me-2" />
                      {t.view_expenses}
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
                  );
                })}
              </div>
            </Card>
          </>
        ) : (
          <Card className="p-8 sm:p-12 text-center">
            <DollarSign className="h-12 w-12 sm:h-16 sm:w-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg sm:text-xl font-semibold text-slate-900 mb-2">{t.no_budget_defined}</h3>
            <p className="text-slate-500 mb-6 text-sm sm:text-base">{t.no_budget_desc}</p>
          </Card>
        )}
      </div>

      {/* Create Budget Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open);
        if (!open) resetForms();
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{hasBudget ? t.edit_budget : t.create_new_budget}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Mode Selection */}
            <div className="space-y-2">
              <Label>{t.input_mode}</Label>
              <Select value={inputMode} onValueChange={handleModeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="amount">{t.absolute_amount.replace('{symbol}', currencySymbol)}</SelectItem>
                  <SelectItem value="percentage">{t.percentage}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Total Budget (for percentage mode) */}
            {inputMode === 'percentage' && (
              <div className="space-y-2">
                <Label>{t.total_monthly_budget}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formTotalBudget}
                  onChange={(e) => setFormTotalBudget(e.target.value)}
                  placeholder="0.00"
                  dir="ltr"
                />
              </div>
            )}

            {/* Categories Table */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {categories.map(category => (
                <div key={category.id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${category.color || '#94a3b8'}20` }}
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: category.color || '#94a3b8' }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Label className="text-sm font-medium truncate block">{category.name}</Label>
                  </div>
                  <div className="w-24 sm:w-32 shrink-0">
                    <Input
                      type="number"
                      step="0.01"
                      value={categoryInputs[category.id] || ''}
                      onChange={(e) => updateCategoryInput(category.id, e.target.value)}
                      placeholder={inputMode === 'percentage' ? '0%' : '0.00'}
                      dir="ltr"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            {Object.values(categoryInputs).some(v => v && parseFloat(v) > 0) && (
              <div className="bg-slate-50 rounded-lg p-3 space-y-1">
                {inputMode === 'percentage' ? (
                  <>
                    <p className="text-sm text-slate-600">
                      {t.total_percent} {totalPercentage.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                    </p>
                    {totalPercentage > 0 && totalPercentage <= 100 && (
                      <p className="text-sm text-green-600">{t.valid_percentages} ({totalPercentage.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)</p>
                    )}
                    {totalPercentage > 100 && (
                      <p className="text-sm text-red-600">{t.excess} {(totalPercentage - 100).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-600">
                    {t.total_budget_colon} {currencySymbol}{Object.values(categoryInputs)
                      .reduce((sum, v) => sum + (parseFloat(v) || 0), 0)
                      .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                )}
              </div>
            )}

            <Button
              onClick={handleCreateBudget}
              className="w-full bg-slate-900 hover:bg-slate-800"
              disabled={!canSubmit}
            >
              {hasBudget ? t.update_budget : t.create_budget}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Edit Dialog */}
      <Dialog open={!!quickEditCategory} onOpenChange={(open) => {
        if (!open) {
          setQuickEditCategory(null);
          setQuickEditValue('');
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.edit_budget} - {quickEditCategory?.category_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{quickEditMode === 'percentage' ? t.new_percent : t.new_amount}</Label>
              <Input
                type="number"
                step={quickEditMode === 'percentage' ? '0.1' : '0.01'}
                value={quickEditValue}
                onChange={(e) => setQuickEditValue(e.target.value)}
                placeholder={quickEditMode === 'percentage' ? '0%' : '0.00'}
                dir="ltr"
                className="text-xl font-semibold"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    saveQuickEdit();
                  }
                }}
                autoFocus
              />
            </div>
            {quickEditCategory && (
              <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
                {quickEditMode === 'percentage' ? (
                  <>
                    <p className="text-slate-600">{t.current_percent_colon} {quickEditCategory.percentage?.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</p>
                    <p className="text-slate-600">{t.total_budget_label2} {currencySymbol}{quickEditCategory.total_budget?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</p>
                    <p className={`font-medium ${availablePercentage > 0 ? 'text-green-600' : 'text-amber-600'}`}>
                      {availablePercentage > 0
                        ? t.available_percent_free.replace('{n}', availablePercentage.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }))
                        : t.no_percent_available}
                    </p>
                  </>
                ) : (
                  <p className="text-slate-600">{t.current_budget_colon} {currencySymbol}{quickEditCategory.amount?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setQuickEditCategory(null);
                setQuickEditValue('');
              }}
            >
              {t.cancel}
            </Button>
            <Button
              onClick={saveQuickEdit}
              disabled={!quickEditValue || parseFloat(quickEditValue) <= 0}
              className="bg-slate-900 hover:bg-slate-800"
            >
              {t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}