import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/components/i18n/LanguageContext';
import { TrendingUp, TrendingDown, Receipt, Target } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

export default function Dashboard() {
  const { t } = useLanguage();

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

  const { data: expenses = [], isLoading: expensesLoading } = useQuery({
    queryKey: ['expenses', user?.email, settings?.current_household_id, isHouseholdMode],
    queryFn: async () => {
      if (!user?.email) return [];
      if (isHouseholdMode) {
        return base44.entities.Expense.filter({ household_id: settings.current_household_id });
      }
      return base44.entities.Expense.filter({ user_email: user.email, household_id: null });
    },
    enabled: !!user?.email,
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories', user?.email, settings?.current_household_id, isHouseholdMode],
    queryFn: async () => {
      if (!user?.email) return [];
      if (isHouseholdMode) {
        return base44.entities.Category.filter({ household_id: settings.current_household_id });
      }
      return base44.entities.Category.filter({ user_email: user.email, household_id: null });
    },
    enabled: !!user?.email,
  });

  const { data: budgets = [], isLoading: budgetsLoading } = useQuery({
    queryKey: ['budgets', user?.email, settings?.current_household_id, isHouseholdMode],
    queryFn: async () => {
      if (!user?.email) return [];
      if (isHouseholdMode) {
        return base44.entities.Budget.filter({ household_id: settings.current_household_id });
      }
      return base44.entities.Budget.filter({ created_by: user.email, household_id: null });
    },
    enabled: !!user?.email,
  });

  const isLoading = expensesLoading || categoriesLoading || budgetsLoading;

  // Current month expenses
  const now = new Date();
  const currentMonthExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && !e.is_pending;
  });
  const totalThisMonth = currentMonthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  // Total budget
  const totalBudget = budgets.reduce((sum, b) => sum + (b.amount || b.total_budget || 0), 0);

  // Budget computed values
  const budgetPct = totalBudget > 0 ? Math.min((totalThisMonth / totalBudget) * 100, 100) : 0;
  const isOverBudget = totalBudget > 0 && totalThisMonth > totalBudget;
  const remaining = totalBudget - totalThisMonth;

  // Top categories
  const categoryTotals = {};
  currentMonthExpenses.forEach(e => {
    const name = e.category_name || 'Other';
    categoryTotals[name] = (categoryTotals[name] || 0) + (e.amount || 0);
  });
  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const currency = settings?.currency || 'USD';
  const fmt = (n) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Summary Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map(i => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="p-6 space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total This Month */}
          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500">{t.total_expenses || 'Total This Month'}</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{fmt(totalThisMonth)}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {currentMonthExpenses.length} {currentMonthExpenses.length === 1 ? 'transaction' : 'transactions'}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <Receipt className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Budget */}
          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 me-3">
                  <p className="text-sm text-slate-500">{t.budget || 'Budget'}</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {totalBudget > 0 ? fmt(totalBudget) : '—'}
                  </p>
                  {totalBudget > 0 && (
                    <div className="mt-2 space-y-1">
                      <Progress value={budgetPct} className="h-1.5" />
                      <p className="text-xs text-slate-400">{budgetPct.toFixed(0)}% used</p>
                    </div>
                  )}
                </div>
                <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                  <Target className="h-5 w-5 text-violet-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Remaining */}
          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500">{t.remaining || 'Remaining'}</p>
                  <p className={`text-2xl font-bold mt-1 ${isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
                    {totalBudget > 0 ? fmt(remaining) : '—'}
                  </p>
                  {totalBudget > 0 && (
                    <p className="text-xs text-slate-400 mt-1">
                      {isOverBudget ? 'over budget' : 'left this month'}
                    </p>
                  )}
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isOverBudget ? 'bg-red-50' : 'bg-green-50'}`}>
                  {isOverBudget
                    ? <TrendingUp className="h-5 w-5 text-red-600" />
                    : <TrendingDown className="h-5 w-5 text-green-600" />
                  }
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top Categories */}
      {isLoading ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-5 w-32 mb-4" />
            {[0, 1, 2].map(i => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-3.5 h-3.5 rounded-full shrink-0" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-3 w-10" />
                </div>
                <Skeleton className="h-1 ms-6 rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : topCategories.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <h3 className="font-semibold text-slate-900 mb-4">{t.top_categories || 'Top Categories'}</h3>
            <div className="space-y-3">
              {topCategories.map(([name, total]) => {
                const cat = categories.find(c => c.name === name);
                const pct = totalThisMonth > 0 ? (total / totalThisMonth) * 100 : 0;
                return (
                  <div key={name}>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3.5 h-3.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat?.color || '#94a3b8' }}
                      />
                      <span className="text-sm text-slate-700 flex-1">{name}</span>
                      <span className="text-sm font-medium text-slate-900">{fmt(total)}</span>
                      <span className="text-xs text-slate-400 w-12 text-right">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="ms-6 mt-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: cat?.color || '#94a3b8' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Expenses */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <h3 className="font-semibold text-slate-900 mb-4">{t.recent_expenses || 'Recent Expenses'}</h3>
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3 py-1">
                  <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : currentMonthExpenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <Receipt className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-700">No expenses yet</p>
              <p className="text-xs text-slate-400 mt-1">Tap + to add your first expense</p>
            </div>
          ) : (
            <div className="space-y-1">
              {currentMonthExpenses.slice(0, 10).map(e => {
                const cat = categories.find(c => c.id === e.category_id || c.name === e.category_name);
                return (
                  <div
                    key={e.id}
                    className="group flex items-center justify-between py-2 px-2 -mx-2 rounded-lg border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${cat?.color || '#94a3b8'}1F` }}
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: cat?.color || '#94a3b8' }}
                        />
                      </div>
                      <div>
                        <p className="text-sm text-slate-700 group-hover:text-indigo-600 transition-colors">
                          {e.description || e.category_name || '—'}
                        </p>
                        <p className="text-xs text-slate-400">{e.date}</p>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-slate-900">{fmt(e.amount)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
