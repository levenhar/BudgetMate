import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, Calendar, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import UnifiedExpenseDialog from '@/components/ui/UnifiedExpenseDialog';

import { useLanguage } from '@/components/i18n/LanguageContext';

export default function RecurringExpenses() {
  const { t, dir } = useLanguage();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [editingInstallmentGroup, setEditingInstallmentGroup] = useState(null);
  const [installmentFormData, setInstallmentFormData] = useState({
    description: '',
    category_id: '',
    totalAmount: '',
  });
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    category_id: '',
    frequency: 'monthly',
    start_date: new Date(),
    end_date: null,
    description: '',
    is_active: true
  });

  // Fetch data
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

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', user?.email, settings?.current_household_id, isHouseholdMode],
    queryFn: async () => {
      if (!user?.email) return [];
      if (isHouseholdMode) {
        return base44.entities.Category.filter({ household_id: settings.current_household_id });
      } else {
        return base44.entities.Category.filter({ user_email: user.email, household_id: null });
      }
    },
    enabled: !!user?.email,
  });

  const { data: recurringExpenses = [], isLoading } = useQuery({
    queryKey: ['recurringExpenses', user?.email, settings?.current_household_id, isHouseholdMode],
    queryFn: async () => {
      if (!user?.email) return [];
      if (isHouseholdMode) {
        return base44.entities.RecurringExpense.filter(
          { household_id: settings.current_household_id },
          '-created_date'
        );
      } else {
        return base44.entities.RecurringExpense.filter(
          { user_email: user.email, household_id: null },
          '-created_date'
        );
      }
    },
    enabled: !!user?.email,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', user?.email, settings?.current_household_id, isHouseholdMode],
    queryFn: async () => {
      if (!user?.email) return [];
      if (isHouseholdMode) {
        return base44.entities.Expense.filter(
          { household_id: settings.current_household_id },
          '-date'
        );
      } else {
        return base44.entities.Expense.filter(
          { user_email: user.email, household_id: null },
          '-date'
        );
      }
    },
    enabled: !!user?.email,
  });

  // Group installment expenses
  const installmentGroups = useMemo(() => {
    const groups = {};
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Reset to start of day
    
    expenses.forEach(expense => {
      const match = expense.description?.match(/\(תשלום (\d+)\/(\d+)\)$/);
      if (match) {
        const [, current, total] = match;
        const baseDesc = expense.description.replace(/\s*\(תשלום \d+\/\d+\)$/, '').trim();
        const key = `${baseDesc}_${expense.category_id}_${expense.amount * parseInt(total)}`;
        
        if (!groups[key]) {
          groups[key] = {
            baseDescription: baseDesc,
            totalInstallments: parseInt(total),
            installmentAmount: expense.amount,
            totalAmount: expense.amount * parseInt(total),
            category_id: expense.category_id,
            category_name: expense.category_name,
            expenses: [],
          };
        }
        groups[key].expenses.push(expense);
      }
    });

    // Filter only groups with future payments (including today)
    return Object.values(groups).filter(group => {
      const futurePayments = group.expenses.filter(e => {
        const expenseDate = new Date(e.date);
        expenseDate.setHours(0, 0, 0, 0);
        return expenseDate >= now;
      });
      return futurePayments.length > 0;
    }).map(group => ({
      ...group,
      expenses: group.expenses.sort((a, b) => new Date(a.date) - new Date(b.date)),
      futureCount: group.expenses.filter(e => {
        const expenseDate = new Date(e.date);
        expenseDate.setHours(0, 0, 0, 0);
        return expenseDate >= now;
      }).length,
    }));
  }, [expenses]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.RecurringExpense.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['recurringExpenses']);
      toast.success('הוצאה קבועה נוספה בהצלחה');
      resetForm();
      setIsAddDialogOpen(false);
    },
  });

  const createExpenseMutation = useMutation({
    mutationFn: async (data) => {
      const { installments = 1, ...expenseData } = data;
      const baseData = {
        ...expenseData,
        user_email: user.email,
        household_id: isHouseholdMode ? settings.current_household_id : null,
      };

      if (installments <= 1) {
        return base44.entities.Expense.create(baseData);
      }

      const installmentAmount = baseData.amount / installments;
      const expenses = [];

      for (let i = 0; i < installments; i++) {
        const installmentDate = new Date(baseData.date);
        installmentDate.setMonth(installmentDate.getMonth() + i);

        const installmentDesc = baseData.description || 'רכישה';
        expenses.push({
          ...baseData,
          amount: installmentAmount,
          date: format(installmentDate, 'yyyy-MM-dd'),
          description: `${installmentDesc} (תשלום ${i + 1}/${installments})`,
        });
      }

      return base44.entities.Expense.bulkCreate(expenses);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      const installments = variables.installments || 1;
      toast.success(installments > 1 ? `${installments} תשלומים נוספו בהצלחה!` : 'ההוצאה נוספה בהצלחה!');
      setIsAddDialogOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.RecurringExpense.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['recurringExpenses']);
      toast.success('הוצאה קבועה עודכנה בהצלחה');
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.RecurringExpense.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['recurringExpenses']);
      toast.success('הוצאה קבועה נמחקה');
    },
  });

  const deleteInstallmentGroupMutation = useMutation({
    mutationFn: async (expenseIds) => {
      await Promise.all(expenseIds.map(id => base44.entities.Expense.delete(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['expenses']);
      toast.success('כל התשלומים נמחקו בהצלחה');
    },
  });

  const updateInstallmentGroupMutation = useMutation({
    mutationFn: async ({ group, newDescription, newCategoryId, newTotalAmount }) => {
      const totalInstallments = group.totalInstallments;
      const newInstallmentAmount = newTotalAmount / totalInstallments;
      
      const category = categories.find(c => c.id === newCategoryId);
      
      // Update all expenses in the group
      await Promise.all(group.expenses.map((expense, idx) => {
        const match = expense.description?.match(/\(תשלום (\d+)\/(\d+)\)$/);
        const installmentNum = match ? match[1] : (idx + 1);
        
        return base44.entities.Expense.update(expense.id, {
          description: `${newDescription} (תשלום ${installmentNum}/${totalInstallments})`,
          category_id: newCategoryId,
          category_name: category?.name || '',
          amount: newInstallmentAmount,
        });
      }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['expenses']);
      toast.success('כל התשלומים עודכנו בהצלחה');
      setEditingInstallmentGroup(null);
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      amount: '',
      category_id: '',
      frequency: 'monthly',
      start_date: new Date(),
      end_date: null,
      description: '',
      is_active: true
    });
    setEditingExpense(null);
    setIsAddDialogOpen(false);
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setFormData({
      name: expense.name,
      amount: expense.amount.toString(),
      category_id: expense.category_id,
      frequency: expense.frequency,
      start_date: parseISO(expense.start_date),
      end_date: expense.end_date ? parseISO(expense.end_date) : null,
      description: expense.description || '',
      is_active: expense.is_active
    });
    setIsAddDialogOpen(true);
  };

  const handleSubmit = () => {
    const category = categories.find(c => c.id === formData.category_id);
    const data = {
      name: formData.name,
      amount: parseFloat(formData.amount),
      category_id: formData.category_id,
      category_name: category?.name || '',
      frequency: formData.frequency,
      start_date: format(formData.start_date, 'yyyy-MM-dd'),
      end_date: formData.end_date ? format(formData.end_date, 'yyyy-MM-dd') : null,
      description: formData.description || undefined,
      is_active: formData.is_active,
      household_id: settings?.mode === 'household' ? settings.current_household_id : null,
      user_email: user.email
    };

    if (editingExpense) {
      updateMutation.mutate({ id: editingExpense.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const frequencyLabels = {
    daily: 'יומי',
    weekly: 'שבועי',
    monthly: 'חודשי',
    yearly: 'שנתי'
  };

  // Separate active and expired recurring expenses
  const { activeRecurring, expiredRecurring } = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const active = [];
    const expired = [];
    
    recurringExpenses.forEach(expense => {
      if (expense.end_date) {
        const endDate = parseISO(expense.end_date);
        endDate.setHours(0, 0, 0, 0);
        if (endDate < now) {
          expired.push(expense);
        } else {
          active.push(expense);
        }
      } else {
        active.push(expense);
      }
    });
    
    return { activeRecurring: active, expiredRecurring: expired };
  }, [recurringExpenses]);

  const [showExpired, setShowExpired] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-slate-300 border-t-slate-900 rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6" dir={dir}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{t.recurring_payments}</h1>
            <p className="text-slate-500 mt-1">
              {recurringExpenses.length > 0 ? `${recurringExpenses.length} ${t.recurring_expenses}` : t.no_recurring_desc}
            </p>
          </div>
        </div>

        {/* Installment Expenses */}
        {installmentGroups.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900">{t.future_payments}</h2>
              <div className="text-left">
                <div className="text-2xl font-bold text-slate-900">
                  ₪{installmentGroups.reduce((sum, g) => sum + g.installmentAmount, 0).toFixed(2)}
                </div>
                <div className="text-sm text-slate-500">{t.per_month}</div>
              </div>
            </div>
            <div className="space-y-2">
              {installmentGroups.map((group, idx) => (
                <div
                  key={idx}
                  className="group bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: categories.find(c => c.id === group.category_id)?.color || '#8b5cf6' }}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">
                            {group.baseDescription || 'הוצאה'}
                          </span>
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                            {group.futureCount}/{group.totalInstallments} תשלומים נותרו
                          </span>
                        </div>
                        <div className="text-sm text-slate-500 mt-0.5">
                          {group.category_name} · ₪{group.installmentAmount.toFixed(2)} לחודש · סה״כ ₪{group.totalAmount.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-slate-900">
                        ₪{(group.installmentAmount * group.futureCount).toFixed(2)}
                      </span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-slate-600"
                          onClick={() => {
                            setEditingInstallmentGroup(group);
                            setInstallmentFormData({
                              description: group.baseDescription,
                              category_id: group.category_id,
                              totalAmount: group.totalAmount.toString(),
                            });
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-red-500"
                          onClick={() => {
                            if (confirm(`האם למחוק את כל ${group.totalInstallments} התשלומים?`)) {
                              deleteInstallmentGroupMutation.mutate(group.expenses.map(e => e.id));
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                ))}
            </div>
          </div>
        )}

        {/* Recurring Expenses List */}
        {recurringExpenses.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900">{t.active_recurring}</h2>
            <div className="text-left">
              <div className="text-2xl font-bold text-slate-900">
                ₪{activeRecurring.filter(r => r.is_active).reduce((sum, r) => sum + r.amount, 0).toFixed(2)}
              </div>
              <div className="text-sm text-slate-500">לחודש</div>
            </div>
          </div>
        )}

        {recurringExpenses.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <Calendar className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">{t.no_recurring}</h3>
            <p className="text-slate-500 mb-6">{t.no_recurring_desc}</p>

          </div>
        ) : (
          <>
            {/* Active Recurring Expenses */}
            <div className="space-y-2">
              {activeRecurring.map((expense) => (
              <div
                key={expense.id}
                className="group bg-slate-100 rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: categories.find(c => c.id === expense.category_id)?.color || '#8b5cf6' }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{expense.name}</span>
                        {!expense.is_active && (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">
                            {t.inactive}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-500 mt-0.5">
                        {t[expense.frequency === 'daily' ? 'daily' : expense.frequency === 'weekly' ? 'weekly' : expense.frequency === 'monthly' ? 'monthly_freq' : 'yearly']} · {expense.category_name}
                        {expense.end_date && (
                          <span className="ms-1">· {format(parseISO(expense.end_date), 'dd/MM/yy')}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-slate-900">₪{expense.amount.toFixed(2)}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-slate-600"
                        onClick={() => handleEdit(expense)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-red-500"
                        onClick={() => {
                          if (confirm('האם למחוק הוצאה קבועה זו?')) {
                            deleteMutation.mutate(expense.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Expired Recurring Expenses */}
          {expiredRecurring.length > 0 && (
            <div className="mt-6">
              <button
                onClick={() => setShowExpired(!showExpired)}
                className="w-full flex items-center justify-between bg-slate-50 rounded-xl border border-slate-200 p-4 hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-700">{t.expired_recurring}</span>
                  <span className="text-sm text-slate-500">({expiredRecurring.length})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">{showExpired ? t.hide : t.show}</span>
                  <div className={`transform transition-transform ${showExpired ? 'rotate-180' : ''}`}>
                    ▼
                  </div>
                </div>
              </button>

              {showExpired && (
                <div className="mt-2 space-y-2">
                  {expiredRecurring.map((expense) => (
                    <div
                      key={expense.id}
                      className="group bg-slate-50 rounded-xl border border-slate-200 p-4 opacity-60"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: categories.find(c => c.id === expense.category_id)?.color || '#8b5cf6' }}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900">{expense.name}</span>
                              <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-xs rounded-full">
                                {t.ended}
                              </span>
                            </div>
                            <div className="text-sm text-slate-500 mt-0.5">
                              {frequencyLabels[expense.frequency]} · {expense.category_name} · הסתיים ב-{format(parseISO(expense.end_date), 'dd/MM/yy')}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-slate-700">₪{expense.amount.toFixed(2)}</span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-red-500"
                              onClick={() => {
                                if (confirm('האם למחוק הוצאה קבועה זו?')) {
                                  deleteMutation.mutate(expense.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
        )}



        {/* Edit Installment Group Dialog */}
        <Dialog open={!!editingInstallmentGroup} onOpenChange={(open) => {
          if (!open) setEditingInstallmentGroup(null);
        }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t.edit_installments}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-right block">{t.description_optional}</Label>
                <Input
                  value={installmentFormData.description}
                  onChange={(e) => setInstallmentFormData({ ...installmentFormData, description: e.target.value })}
                  placeholder="למשל: מוצר, רכישה"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-right block">קטגוריה</Label>
                <Select 
                  value={installmentFormData.category_id} 
                  onValueChange={(v) => setInstallmentFormData({ ...installmentFormData, category_id: v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="בחר קטגוריה" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-[300px]">
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id} className="cursor-pointer">
                        <div className="flex items-center gap-2">
                          <span 
                            className="w-3 h-3 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: cat.color }}
                          />
                          <span>{cat.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-right block">{t.total_amount}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={installmentFormData.totalAmount}
                  onChange={(e) => setInstallmentFormData({ ...installmentFormData, totalAmount: e.target.value })}
                  className="text-lg font-semibold"
                  dir="ltr"
                />
                {installmentFormData.totalAmount && editingInstallmentGroup && (
                  <p className="text-xs text-slate-500">
                    {editingInstallmentGroup.totalInstallments} תשלומים של ₪{(parseFloat(installmentFormData.totalAmount) / editingInstallmentGroup.totalInstallments).toFixed(2)} כל אחד
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingInstallmentGroup(null)}>
                {t.cancel}
              </Button>
              <Button 
                onClick={() => {
                  if (editingInstallmentGroup && installmentFormData.description && installmentFormData.category_id && installmentFormData.totalAmount) {
                    updateInstallmentGroupMutation.mutate({
                      group: editingInstallmentGroup,
                      newDescription: installmentFormData.description,
                      newCategoryId: installmentFormData.category_id,
                      newTotalAmount: parseFloat(installmentFormData.totalAmount),
                    });
                  }
                }}
                disabled={
                  !installmentFormData.description || 
                  !installmentFormData.category_id || 
                  !installmentFormData.totalAmount ||
                  updateInstallmentGroupMutation.isPending
                }
                className="bg-slate-900 hover:bg-slate-800"
              >
                {updateInstallmentGroupMutation.isPending ? '...' : t.update}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Recurring Expense Dialog */}
        <Dialog open={!!editingExpense} onOpenChange={(open) => {
          if (!open) resetForm();
        }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingExpense ? t.edit_recurring : t.add_recurring}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-right block">{t.expense_name}</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="למשל: דמי שכירות, Netflix, ביטוח"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-right block">{t.amount}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="text-lg font-semibold"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-right block">{t.frequency_label}</Label>
                  <Select 
                    value={formData.frequency} 
                    onValueChange={(v) => setFormData({ ...formData, frequency: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">{t.daily}</SelectItem>
                      <SelectItem value="weekly">{t.weekly}</SelectItem>
                      <SelectItem value="monthly">{t.monthly_freq}</SelectItem>
                      <SelectItem value="yearly">{t.yearly}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-right block">{t.category}</Label>
                <Select 
                  value={formData.category_id} 
                  onValueChange={(v) => setFormData({ ...formData, category_id: v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="בחר קטגוריה" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-[300px]">
                    {categories.length === 0 ? (
                      <div className="p-4 text-center text-sm text-slate-500">
                        אין קטגוריות זמינות
                      </div>
                    ) : (
                      categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id} className="cursor-pointer">
                          <div className="flex items-center gap-2">
                            <span 
                              className="w-3 h-3 rounded-full flex-shrink-0" 
                              style={{ backgroundColor: cat.color }}
                            />
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
                  <Label className="text-right block">{t.start_date}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <Calendar className="h-4 w-4 ml-2" />
                        {format(formData.start_date, 'dd/MM/yyyy')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={formData.start_date}
                        onSelect={(d) => d && setFormData({ ...formData, start_date: d })}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label className="text-right block">{t.end_date_optional}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <Calendar className="h-4 w-4 ml-2" />
                        {formData.end_date ? format(formData.end_date, 'dd/MM/yyyy') : t.no_end_date}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={formData.end_date}
                        onSelect={(d) => setFormData({ ...formData, end_date: d })}
                      />
                      {formData.end_date && (
                        <div className="p-2 border-t">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full"
                            onClick={() => setFormData({ ...formData, end_date: null })}
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
                <Label className="text-right block">{t.description_optional}</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="הוסף הערות או פרטים נוספים"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <Label className="cursor-pointer">{t.active_label}</Label>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>

              {formData.end_date && formData.end_date < formData.start_date && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm text-amber-800">{t.end_before_start_error}</span>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => resetForm()}>
                {t.cancel}
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={
                  !formData.name || 
                  !formData.amount || 
                  !formData.category_id ||
                  (formData.end_date && formData.end_date < formData.start_date)
                }
                className="bg-slate-900 hover:bg-slate-800"
              >
                {editingExpense ? t.update : t.add}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}