import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/components/i18n/LanguageContext';
import { useCurrency } from '@/lib/CurrencyContext';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { Pencil, Check, X, LogOut, Target, TrendingUp, Wallet } from 'lucide-react';

export default function Profile() {
  const { t, dir } = useLanguage();
  const { fmt } = useCurrency();
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

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

  const { data: goals = [] } = useQuery({
    queryKey: ['savingsGoals', user?.email, settings?.current_household_id, isHouseholdMode],
    queryFn: async () => {
      if (!user?.email) return [];
      if (isHouseholdMode) {
        return base44.entities.SavingsGoal.filter({ household_id: settings.current_household_id });
      }
      return base44.entities.SavingsGoal.filter({ user_email: user.email });
    },
    enabled: !!user?.email,
  });

  const updateNameMutation = useMutation({
    mutationFn: async (fullName) => {
      const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
      if (profiles.length > 0) {
        return base44.entities.UserProfile.update(profiles[0].id, { full_name: fullName });
      }
      return base44.entities.UserProfile.create({ user_email: user.email, full_name: fullName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      toast.success(t.name_updated || 'Name updated!');
      setEditingName(false);
    },
    onError: () => toast.error(t.error_saving || 'Error saving'),
  });

  // Current month stats
  const now = new Date();
  const thisMonthExpenses = expenses.filter((e) => {
    const d = new Date(e.date);
    return (
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear() &&
      !e.is_pending
    );
  });
  const thisMonthTotal = thisMonthExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalBudget = budgets.reduce((s, b) => s + (b.amount || b.total_budget || 0), 0);
  const budgetUsedPct = totalBudget > 0 ? Math.round((thisMonthTotal / totalBudget) * 100) : null;


  // Avatar initials
  const displayName = user?.full_name || user?.email || '';
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('') || '?';

  const startEditName = () => {
    setNameInput(user?.full_name || '');
    setEditingName(true);
  };

  const saveName = () => {
    if (nameInput.trim()) updateNameMutation.mutate(nameInput.trim());
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6" dir={dir}>
      {/* Hero / Avatar card */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600" />
        <CardContent className="px-6 pb-6">
          <div className="flex items-end gap-4 -mt-10 mb-2">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg border-4 border-white shrink-0">
              {initials}
            </div>
            <div className="pb-1 flex-1 min-w-0">
              {editingName ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <Input
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="h-8 text-base font-semibold max-w-[200px]"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveName();
                      if (e.key === 'Escape') setEditingName(false);
                    }}
                  />
                  <button
                    onClick={saveName}
                    className="p-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors"
                    disabled={updateNameMutation.isPending}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setEditingName(false)}
                    className="p-1.5 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900 truncate">
                    {user?.full_name || t.unnamed_user || 'User'}
                  </h2>
                  <button
                    onClick={startEditName}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <p className="text-sm text-slate-500 mt-0.5 truncate">{user?.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
              <TrendingUp className="h-5 w-5 text-indigo-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500">{t.this_month_spent || 'This Month'}</p>
              <p className="text-lg font-bold text-slate-900">{fmt(thisMonthTotal)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
              <Target className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500">{t.active_goals || 'Active Goals'}</p>
              <p className="text-lg font-bold text-slate-900">{goals.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <Wallet className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500">{t.budget_used || 'Budget Used'}</p>
              <p className="text-lg font-bold text-slate-900">
                {budgetUsedPct !== null ? `${budgetUsedPct}%` : '—'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* App Info */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <h3 className="font-semibold text-slate-900 mb-3">{t.app_info || 'App Info'}</h3>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">{t.version || 'Version'}</span>
            <span className="font-mono text-slate-700">1.0.0</span>
          </div>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-0 shadow-sm border border-red-100">
        <CardContent className="p-6">
          <h3 className="font-semibold text-red-600 mb-4">{t.danger_zone || 'Danger Zone'}</h3>
          <Button
            variant="outline"
            className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
            onClick={() => logout()}
          >
            <LogOut className="h-4 w-4 me-2" />
            {t.logout || 'Logout'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
