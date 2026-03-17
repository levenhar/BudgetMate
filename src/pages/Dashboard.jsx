import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/components/i18n/LanguageContext';

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

  const { data: expenses = [] } = useQuery({
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

  const { data: categories = [] } = useQuery({
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

  const { data: budgets = [] } = useQuery({
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

  // Current month expenses
  const now = new Date();
  const currentMonthExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && !e.is_pending;
  });
  const totalThisMonth = currentMonthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  // Total budget
  const totalBudget = budgets.reduce((sum, b) => sum + (b.amount || b.total_budget || 0), 0);

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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">{t.total_expenses || 'Total This Month'}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{fmt(totalThisMonth)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">{t.budget || 'Budget'}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalBudget > 0 ? fmt(totalBudget) : '—'}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">{t.remaining || 'Remaining'}</p>
            <p className={`text-2xl font-bold mt-1 ${totalBudget - totalThisMonth < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {totalBudget > 0 ? fmt(totalBudget - totalThisMonth) : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Categories */}
      {topCategories.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <h3 className="font-semibold text-slate-900 mb-4">{t.top_categories || 'Top Categories'}</h3>
            <div className="space-y-3">
              {topCategories.map(([name, total]) => {
                const cat = categories.find(c => c.name === name);
                const pct = totalThisMonth > 0 ? (total / totalThisMonth) * 100 : 0;
                return (
                  <div key={name} className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: cat?.color || '#94a3b8' }}
                    />
                    <span className="text-sm text-slate-700 flex-1">{name}</span>
                    <span className="text-sm font-medium text-slate-900">{fmt(total)}</span>
                    <span className="text-xs text-slate-400 w-12 text-right">{pct.toFixed(0)}%</span>
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
          {currentMonthExpenses.length === 0 ? (
            <p className="text-sm text-slate-400">{t.no_expenses || 'No expenses yet this month.'}</p>
          ) : (
            <div className="space-y-2">
              {currentMonthExpenses.slice(0, 10).map(e => {
                const cat = categories.find(c => c.id === e.category_id || c.name === e.category_name);
                return (
                  <div key={e.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: cat?.color || '#94a3b8' }}
                      />
                      <div>
                        <p className="text-sm text-slate-700">{e.description || e.category_name || '—'}</p>
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
