import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, TrendingUp, TrendingDown, Users, Receipt } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from 'date-fns';

import { useLanguage } from '@/components/i18n/LanguageContext';
import { useCurrency } from '@/lib/CurrencyContext';

export default function Debts() {
  const { t, dir } = useLanguage();
  const { currencySymbol } = useCurrency();
  const [selectedUser, setSelectedUser] = useState<{ email: string; name: string } | null>(null);
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

  const { data: sharedExpenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ['sharedExpenses', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.SharedExpense.list();
    },
    enabled: !!user?.email,
  });

  const { data: allSplits = [], isLoading: loadingSplits } = useQuery({
    queryKey: ['sharedExpenseSplits', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.SharedExpenseSplit.list();
    },
    enabled: !!user?.email,
  });

  const isLoading = loadingExpenses || loadingSplits;

  const userEmail = user?.email?.trim();

  // Compute net balance per user directly from shared expenses
  const balanceByUser: Record<string, { amount: number; name: string; email: string }> = {};

  if (userEmail && sharedExpenses.length > 0) {
    for (const expense of sharedExpenses) {
      // Only approved shared expenses (all participants have accepted) contribute to debts
      if (expense.is_pending) continue;

      const splits = allSplits.filter((s: any) => s.shared_expense_id === expense.id);
      const pendingUsers: string[] = expense.pending_with_users || [];

      if (expense.paid_by_user_id?.trim() === userEmail) {
        // I paid — others owe me their share
        for (const split of splits) {
          const splitUserId = split.user_id?.trim();
          if (!splitUserId || splitUserId === userEmail) continue;
          // Skip if this user hasn't approved yet
          if (pendingUsers.map((u: string) => u.trim()).includes(splitUserId)) continue;
          if (!balanceByUser[splitUserId]) {
            balanceByUser[splitUserId] = { amount: 0, name: split.user_name || splitUserId, email: splitUserId };
          }
          balanceByUser[splitUserId].amount += split.share_amount; // positive = they owe me
        }
      } else {
        // Someone else paid — I may owe them
        const mySplit = splits.find((s: any) => s.user_id?.trim() === userEmail);
        if (!mySplit) continue;
        // Skip if I haven't approved yet
        if (pendingUsers.map((u: string) => u.trim()).includes(userEmail)) continue;
        const payerId = expense.paid_by_user_id?.trim();
        if (!payerId) continue;
        const payerSplit = splits.find((s: any) => s.user_id?.trim() === payerId);
        const payerName = payerSplit?.user_name || payerId;
        if (!balanceByUser[payerId]) {
          balanceByUser[payerId] = { amount: 0, name: payerName, email: payerId };
        }
        balanceByUser[payerId].amount -= mySplit.share_amount; // negative = I owe them
      }
    }
  }

  // Split into owed-to-me and i-owe
  const debtsOwedToMe = Object.values(balanceByUser).filter(b => b.amount > 0.005);
  const debtsIOwe = Object.values(balanceByUser).filter(b => b.amount < -0.005).map(b => ({ ...b, amount: Math.abs(b.amount) }));

  const totalOwedToMe = debtsOwedToMe.reduce((sum, d) => sum + d.amount, 0);
  const totalIOwe = debtsIOwe.reduce((sum, d) => sum + d.amount, 0);
  const netBalance = totalOwedToMe - totalIOwe;

  // Expenses involving both current user and the selected user
  const selectedUserExpenses = selectedUser
    ? sharedExpenses.filter((expense: any) => {
        const splits = allSplits.filter((s: any) => s.shared_expense_id === expense.id);
        const userIds = splits.map((s: any) => s.user_id?.trim());
        return userIds.includes(userEmail) && userIds.includes(selectedUser.email);
      })
    : [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50" dir={dir}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">{t.debts}</h1>
          <p className="text-slate-500 mt-1">{t.debts_subtitle}</p>
        </div>

        {/* Net Balance */}
        <Card className="mb-6 border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-sm text-slate-500 mb-2">{t.net_balance}</div>
              <div className={`text-4xl font-bold ${netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {currencySymbol}{Math.abs(netBalance).toFixed(2)}
              </div>
              <div className="text-sm text-slate-500 mt-2">
                {netBalance >= 0 ? t.positive_balance : t.negative_balance}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users Who Owe Me */}
        <Card className="mb-6 border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              {t.owed_to_me}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {debtsOwedToMe.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Users className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                <p>{t.no_active_debts}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {debtsOwedToMe.map((debt) => (
                  <div
                    key={debt.email}
                    onClick={() => setSelectedUser({ email: debt.email, name: debt.name })}
                    className="flex items-center justify-between p-4 bg-green-50 border border-green-100 rounded-xl cursor-pointer hover:bg-green-100 transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">
                        {debt.name}
                      </div>
                      <div className="text-sm text-slate-500">{t.owes_you}</div>
                    </div>
                    <div className="text-xl font-bold text-green-600">
                      {currencySymbol}{debt.amount.toFixed(2)}
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                  <span className="font-semibold text-slate-700">{t.total}</span>
                  <span className="text-xl font-bold text-green-600">
                    {currencySymbol}{totalOwedToMe.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Users I Owe */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-600" />
              {t.i_owe}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {debtsIOwe.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Users className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                <p>{t.no_active_debts}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {debtsIOwe.map((debt) => (
                  <div
                    key={debt.email}
                    onClick={() => setSelectedUser({ email: debt.email, name: debt.name })}
                    className="flex items-center justify-between p-4 bg-red-50 border border-red-100 rounded-xl cursor-pointer hover:bg-red-100 transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">
                        {debt.name}
                      </div>
                      <div className="text-sm text-slate-500">{t.you_owe}</div>
                    </div>
                    <div className="text-xl font-bold text-red-600">
                      {currencySymbol}{debt.amount.toFixed(2)}
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                  <span className="font-semibold text-slate-700">{t.total}</span>
                  <span className="text-xl font-bold text-red-600">
                    {currencySymbol}{totalIOwe.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Shared Expenses Detail Modal */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-slate-500" />
              Shared expenses with {selectedUser?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 space-y-3 pr-1">
            {selectedUserExpenses.length === 0 ? (
              <div className="text-center py-10 text-slate-500">
                <Users className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                <p>No shared expenses found</p>
              </div>
            ) : (
              selectedUserExpenses.map((expense: any) => {
                const splits = allSplits.filter((s: any) => s.shared_expense_id === expense.id);
                const mySplit = splits.find((s: any) => s.user_id?.trim() === userEmail);
                const iPaid = expense.paid_by_user_id?.trim() === userEmail;
                return (
                  <div key={expense.id} className="border border-slate-100 rounded-xl p-4 bg-white shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900 truncate">
                          {expense.description || expense.category_name || 'Shared expense'}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {expense.date ? format(new Date(expense.date), 'MMM d, yyyy') : '—'}
                          {expense.category_name && ` · ${expense.category_name}`}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-semibold text-slate-900">
                          {currencySymbol}{Number(expense.total_amount).toFixed(2)}
                        </div>
                        <div className={`text-xs font-medium mt-0.5 ${iPaid ? 'text-green-600' : 'text-red-500'}`}>
                          {iPaid ? 'You paid' : `${selectedUser?.name} paid`}
                        </div>
                      </div>
                    </div>
                    {mySplit && (
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
                        <span className="text-slate-500">Your share</span>
                        <span className={`font-semibold ${iPaid ? 'text-green-600' : 'text-red-500'}`}>
                          {iPaid ? '+' : '-'}{currencySymbol}{Number(mySplit.share_amount).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {expense.is_pending && (
                      <div className="mt-2">
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                          Pending approval
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
