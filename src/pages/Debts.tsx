import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, TrendingUp, TrendingDown, Users, Receipt, CheckCircle, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from 'date-fns';
import { toast } from 'sonner';

import { useLanguage } from '@/components/i18n/LanguageContext';
import { useCurrency } from '@/lib/CurrencyContext';
import EditSharedExpenseDialog from '@/components/ui/EditSharedExpenseDialog';

export default function Debts() {
  const { t, dir } = useLanguage();
  const { currencySymbol } = useCurrency();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<{ email: string; name: string } | null>(null);
  const [settleTarget, setSettleTarget] = useState<{ email: string; name: string } | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<any | null>(null);
  const [editingExpense, setEditingExpense] = useState<any | null>(null);
  const [editingExpenseSplits, setEditingExpenseSplits] = useState<any[] | null>(null);

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
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list(),
  });

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

  // Settle debt mutation — bilateral: settles all shared expenses between current user and other party
  const settleDebtMutation = useMutation({
    mutationFn: async (otherEmail: string) => {
      // Find all shared expenses between the current user and the other party (both directions)
      const expensesToSettle = (sharedExpenses as any[]).filter((expense: any) => {
        if (expense.is_pending || expense.is_settled) return false;
        const splits = (allSplits as any[]).filter((s: any) => s.shared_expense_id === expense.id);
        const splitUserIds = splits.map((s: any) => s.user_id?.trim());
        const payerId = expense.paid_by_user_id?.trim();

        // Direction 1: I paid, other person is a participant
        if (payerId === userEmail && splitUserIds.includes(otherEmail.trim())) return true;
        // Direction 2: Other person paid, I am a participant
        if (payerId === otherEmail.trim() && splitUserIds.includes(userEmail)) return true;

        return false;
      });

      for (const expense of expensesToSettle) {
        await base44.entities.SharedExpense.update(expense.id, { is_settled: true });
      }
    },
    onSuccess: () => {
      const name = settleTarget?.name || '';
      toast.success((t as any).settle_debt_success?.replace('{name}', name) || `Debt with ${name} settled`);
      queryClient.invalidateQueries({ queryKey: ['sharedExpenses'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      setSettleTarget(null);
    },
    onError: () => {
      toast.error((t as any).settle_debt_error || 'Error settling debt');
      setSettleTarget(null);
    },
  });

  // Delete shared expense mutation (cascading: splits, participant expenses, debts, then the shared expense)
  const deleteSharedExpenseMutation = useMutation({
    mutationFn: async (sharedExpenseId: string) => {
      // Get all splits
      const splits = await base44.entities.SharedExpenseSplit.filter({
        shared_expense_id: sharedExpenseId,
      });

      const shared = sharedExpenses.find((e: any) => e.id === sharedExpenseId);

      // Delete all participant expenses linked to this shared expense
      const allParticipantExpenses = await base44.entities.Expense.filter({
        source_shared_expense_id: sharedExpenseId,
      });
      for (const exp of allParticipantExpenses) {
        await base44.entities.Expense.delete(exp.id);
      }

      // Delete all splits
      for (const split of splits) {
        await base44.entities.SharedExpenseSplit.delete(split.id);
      }

      // Reverse debts caused by this expense
      if (shared) {
        for (const split of splits) {
          if (split.user_id === shared.paid_by_user_id) continue;

          const allDebts = await base44.entities.Debt.list();
          const splitUserIdTrimmed = split.user_id.trim();
          const paidByUserIdTrimmed = shared.paid_by_user_id.trim();

          const existingDebt = allDebts.find(
            (d: any) =>
              d.from_user_id?.trim() === splitUserIdTrimmed &&
              d.to_user_id?.trim() === paidByUserIdTrimmed,
          );

          if (existingDebt) {
            const newAmount = existingDebt.amount - split.share_amount;
            if (newAmount <= 0.01) {
              await base44.entities.Debt.delete(existingDebt.id);
            } else {
              await base44.entities.Debt.update(existingDebt.id, { amount: newAmount });
            }
          }
        }
      }

      // Finally delete the shared expense itself
      await base44.entities.SharedExpense.delete(sharedExpenseId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sharedExpenses'] });
      queryClient.invalidateQueries({ queryKey: ['sharedExpenseSplits'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      toast.success('הוצאה משותפת נמחקה בהצלחה');
      setExpenseToDelete(null);
    },
    onError: () => {
      toast.error('שגיאה במחיקת ההוצאה המשותפת');
    },
  });

  // Update shared expense mutation (mirrors Expenses.jsx updateSharedExpenseMutation)
  const updateSharedExpenseMutation = useMutation({
    mutationFn: async ({ sharedExpenseId, data }: { sharedExpenseId: string; data: any }) => {
      const shared = sharedExpenses.find((e: any) => e.id === sharedExpenseId);

      // Get old splits before changes
      const oldSplits = await base44.entities.SharedExpenseSplit.filter({
        shared_expense_id: sharedExpenseId,
      });

      // Handle removed participants
      if (data.removedParticipants && data.removedParticipants.length > 0) {
        for (const removedUserId of data.removedParticipants) {
          const splitToRemove = oldSplits.find((s: any) => s.user_id === removedUserId);
          if (splitToRemove) {
            await base44.entities.SharedExpenseSplit.delete(splitToRemove.id);

            const expenseToRemove = await base44.entities.Expense.filter({
              source_shared_expense_id: sharedExpenseId,
              user_email: removedUserId,
            });
            if (expenseToRemove.length > 0) {
              await base44.entities.Expense.delete(expenseToRemove[0].id);
            }

            if (removedUserId !== shared?.paid_by_user_id) {
              const allDebts = await base44.entities.Debt.list();
              const removedUserIdTrimmed = removedUserId.trim();
              const paidByTrimmed = shared?.paid_by_user_id?.trim();

              const existingDebt = allDebts.find(
                (d: any) =>
                  d.from_user_id?.trim() === removedUserIdTrimmed &&
                  d.to_user_id?.trim() === paidByTrimmed,
              );
              if (existingDebt) {
                const newAmount = existingDebt.amount - splitToRemove.share_amount;
                if (newAmount <= 0.01) {
                  await base44.entities.Debt.delete(existingDebt.id);
                } else {
                  await base44.entities.Debt.update(existingDebt.id, { amount: newAmount });
                }
              }
            }
          }
        }
      }

      // Re-check always-approved list
      let alwaysApprovedRecords: any[] = [];
      try {
        alwaysApprovedRecords = await base44.entities.AlwaysApprovedUser.list();
      } catch (e) {}
      const alwaysApprovedByParticipant = new Set(
        alwaysApprovedRecords
          .filter((r: any) => r.approved_user_id === shared?.created_by_user_id)
          .map((r: any) => r.user_id),
      );
      const currentSplitUserIds = data.splits
        .map((s: any) => s.userId)
        .filter((id: string) => id !== shared?.created_by_user_id);
      const newPendingWithUsers = currentSplitUserIds.filter(
        (id: string) => !alwaysApprovedByParticipant.has(id),
      );
      const isStillPending = newPendingWithUsers.length > 0;

      // Update the shared expense
      await base44.entities.SharedExpense.update(sharedExpenseId, {
        total_amount: data.total_amount,
        date: data.date,
        category_id: data.category_id,
        category_name: data.category_name,
        description: data.description,
        paid_by_user_id: data.paid_by_user_id,
        split_method: data.split_method,
        is_pending: isStillPending,
        pending_with_users: newPendingWithUsers,
      });

      // Update/create splits
      for (const split of data.splits) {
        const existingSplits = await base44.entities.SharedExpenseSplit.filter({
          shared_expense_id: sharedExpenseId,
          user_id: split.userId,
        });
        if (existingSplits.length > 0) {
          await base44.entities.SharedExpenseSplit.update(existingSplits[0].id, {
            share_amount: split.shareAmount,
            share_percent: split.sharePercent || null,
          });
        } else {
          await base44.entities.SharedExpenseSplit.create({
            shared_expense_id: sharedExpenseId,
            user_id: split.userId,
            user_name: split.userName,
            share_amount: split.shareAmount,
            share_percent: split.sharePercent || null,
          });
        }
      }

      // Update/create participant expenses
      const allCategoriesForUpdate = await base44.entities.Category.list();
      for (const split of data.splits) {
        const existingExpense = await base44.entities.Expense.filter({
          source_shared_expense_id: sharedExpenseId,
          user_email: split.userId,
        });

        let categoryIdForParticipant = data.category_id;
        if (split.userId !== shared?.created_by_user_id) {
          const participantCategory = allCategoriesForUpdate.find(
            (c: any) => c.name === data.category_name && c.user_email === split.userId,
          );
          if (participantCategory) {
            categoryIdForParticipant = participantCategory.id;
          }
        }

        const isParticipantPending = newPendingWithUsers.includes(split.userId);
        const isThisUserCreator = split.userId === shared?.created_by_user_id;
        const isPendingForThisUser = isThisUserCreator ? isStillPending : isParticipantPending;

        if (existingExpense.length > 0) {
          await base44.entities.Expense.update(existingExpense[0].id, {
            amount: split.shareAmount,
            date: data.date,
            category_id: categoryIdForParticipant,
            category_name: data.category_name,
            description: data.description,
            paid_by_user_id: data.paid_by_user_id,
            is_pending: isPendingForThisUser,
            approval_status: isPendingForThisUser ? 'pending' : 'approved',
          });
        } else {
          await base44.entities.Expense.create({
            amount: split.shareAmount,
            date: data.date,
            category_id: categoryIdForParticipant,
            category_name: data.category_name,
            description: data.description,
            user_email: split.userId,
            household_id: shared?.household_id,
            source_shared_expense_id: sharedExpenseId,
            paid_by_user_id: data.paid_by_user_id,
            is_shared: true,
            is_pending: isPendingForThisUser,
            approval_status: isPendingForThisUser ? 'pending' : 'approved',
          });
        }
      }

      // Recalculate debts: reverse old, create new
      const remainingOldSplits = oldSplits.filter(
        (os: any) => !data.removedParticipants?.includes(os.user_id),
      );
      for (const oldSplit of remainingOldSplits) {
        if (oldSplit.user_id === shared?.paid_by_user_id) continue;
        const allDebts = await base44.entities.Debt.list();
        const oldSplitUserIdTrimmed = oldSplit.user_id.trim();
        const paidByTrimmed = shared?.paid_by_user_id?.trim();
        const existingDebt = allDebts.find(
          (d: any) =>
            d.from_user_id?.trim() === oldSplitUserIdTrimmed &&
            d.to_user_id?.trim() === paidByTrimmed,
        );
        if (existingDebt) {
          const newAmount = existingDebt.amount - oldSplit.share_amount;
          if (newAmount <= 0.01) {
            await base44.entities.Debt.delete(existingDebt.id);
          } else {
            await base44.entities.Debt.update(existingDebt.id, { amount: newAmount });
          }
        }
      }

      for (const split of data.splits) {
        if (split.userId === data.paid_by_user_id) continue;
        if (newPendingWithUsers.includes(split.userId)) continue;

        const allDebts = await base44.entities.Debt.list();
        const splitUserIdTrimmed = split.userId.trim();
        const paidByUserIdTrimmed = data.paid_by_user_id.trim();

        const oppositeDebt = allDebts.find(
          (d: any) =>
            d.from_user_id?.trim() === paidByUserIdTrimmed &&
            d.to_user_id?.trim() === splitUserIdTrimmed,
        );
        const existingDebt = allDebts.find(
          (d: any) =>
            d.from_user_id?.trim() === splitUserIdTrimmed &&
            d.to_user_id?.trim() === paidByUserIdTrimmed,
        );

        if (oppositeDebt) {
          const oppositeAmount = oppositeDebt.amount;
          if (oppositeAmount > split.shareAmount) {
            await base44.entities.Debt.update(oppositeDebt.id, {
              amount: oppositeAmount - split.shareAmount,
            });
          } else if (oppositeAmount < split.shareAmount) {
            await base44.entities.Debt.delete(oppositeDebt.id);
            await base44.entities.Debt.create({
              from_user_id: split.userId,
              from_user_name: split.userName,
              to_user_id: data.paid_by_user_id,
              to_user_name:
                data.splits.find((s: any) => s.userId === data.paid_by_user_id)?.userName ||
                data.paid_by_user_id,
              amount: split.shareAmount - oppositeAmount,
            });
          } else {
            await base44.entities.Debt.delete(oppositeDebt.id);
          }
        } else if (existingDebt) {
          await base44.entities.Debt.update(existingDebt.id, {
            amount: existingDebt.amount + split.shareAmount,
          });
        } else {
          await base44.entities.Debt.create({
            from_user_id: split.userId.trim(),
            from_user_name: split.userName,
            to_user_id: data.paid_by_user_id.trim(),
            to_user_name:
              data.splits.find((s: any) => s.userId === data.paid_by_user_id)?.userName ||
              data.paid_by_user_id,
            amount: split.shareAmount,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sharedExpenses'] });
      queryClient.invalidateQueries({ queryKey: ['sharedExpenseSplits'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('הוצאה משותפת עודכנה בהצלחה!');
      setEditingExpense(null);
      setEditingExpenseSplits(null);
    },
    onError: () => {
      toast.error('שגיאה בעדכון ההוצאה המשותפת');
    },
  });

  // Compute net balance per user directly from shared expenses
  const balanceByUser: Record<string, { amount: number; name: string; email: string }> = {};

  if (userEmail && (sharedExpenses as any[]).length > 0) {
    for (const expense of sharedExpenses as any[]) {
      // Only approved shared expenses (all participants have accepted) contribute to debts
      // Skip pending and settled expenses
      if (expense.is_pending) continue;
      if (expense.is_settled) continue;

      const splits = (allSplits as any[]).filter((s: any) => s.shared_expense_id === expense.id);
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
    ? (sharedExpenses as any[])
        .filter((expense: any) => {
          if (expense.is_settled) return false;
          const splits = (allSplits as any[]).filter((s: any) => s.shared_expense_id === expense.id);
          const splitUserIds = splits.map((s: any) => s.user_id?.trim());
          const payerId = expense.paid_by_user_id?.trim();
          const selectedEmail = selectedUser.email.trim();

          // Direction 1: current user paid, selected user is a participant in splits
          if (payerId === userEmail && splitUserIds.includes(selectedEmail)) return true;
          // Direction 2: selected user paid, current user is a participant in splits
          if (payerId === selectedEmail && splitUserIds.includes(userEmail)) return true;

          return false;
        })
        .sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
    : [];

  const handleEditExpense = (expense: any) => {
    const splits = allSplits.filter((s: any) => s.shared_expense_id === expense.id);
    setEditingExpense(expense);
    setEditingExpenseSplits(splits);
  };

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
                    className="flex items-center justify-between p-4 bg-green-50 border border-green-100 rounded-xl"
                  >
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => setSelectedUser({ email: debt.email, name: debt.name })}
                    >
                      <div className="font-semibold text-slate-900">
                        {debt.name}
                      </div>
                      <div className="text-sm text-slate-500">{t.owes_you}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-xl font-bold text-green-600">
                        {currencySymbol}{debt.amount.toFixed(2)}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-green-700 border-green-300 hover:bg-green-100 hover:border-green-400 flex items-center gap-1.5 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSettleTarget({ email: debt.email, name: debt.name });
                        }}
                        disabled={settleDebtMutation.isPending}
                      >
                        <CheckCircle className="h-4 w-4" />
                        {(t as any).mark_as_settled || 'Mark as Settled'}
                      </Button>
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
                    className="flex items-center justify-between p-4 bg-red-50 border border-red-100 rounded-xl"
                  >
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => setSelectedUser({ email: debt.email, name: debt.name })}
                    >
                      <div className="font-semibold text-slate-900">
                        {debt.name}
                      </div>
                      <div className="text-sm text-slate-500">{t.you_owe}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-xl font-bold text-red-600">
                        {currencySymbol}{debt.amount.toFixed(2)}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-700 border-red-300 hover:bg-red-100 hover:border-red-400 flex items-center gap-1.5 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSettleTarget({ email: debt.email, name: debt.name });
                        }}
                        disabled={settleDebtMutation.isPending}
                      >
                        <CheckCircle className="h-4 w-4" />
                        {(t as any).mark_as_settled || 'Mark as Settled'}
                      </Button>
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
              {t.shared_expenses_with} {selectedUser?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 space-y-3 pr-1">
            {selectedUserExpenses.length === 0 ? (
              <div className="text-center py-10 text-slate-500">
                <Users className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                <p>{t.no_shared_expenses_found}</p>
              </div>
            ) : (
              selectedUserExpenses.map((expense: any) => {
                const splits = (allSplits as any[]).filter((s: any) => s.shared_expense_id === expense.id);
                const mySplit = splits.find((s: any) => s.user_id?.trim() === userEmail);
                const iPaid = expense.paid_by_user_id?.trim() === userEmail;
                const isCreator = expense.created_by?.trim() === userEmail;
                return (
                  <div key={expense.id} className={`border rounded-xl p-4 bg-white shadow-sm ${expense.is_settled ? 'opacity-60 border-slate-200' : 'border-slate-100'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900 truncate">
                          {expense.description || expense.category_name || t.shared}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {expense.date ? format(new Date(expense.date), 'MMM d, yyyy') : '—'}
                          {expense.category_name && ` · ${expense.category_name}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <div className="text-right">
                          <div className="font-semibold text-slate-900">
                            {currencySymbol}{Number(expense.total_amount).toFixed(2)}
                          </div>
                          <div className={`text-xs font-medium mt-0.5 ${iPaid ? 'text-green-600' : 'text-red-500'}`}>
                            {iPaid ? t.you_paid : `${selectedUser?.name} ${t.they_paid}`}
                          </div>
                        </div>
                        {isCreator && (
                          <div className="flex flex-col gap-1 ml-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditExpense(expense);
                              }}
                              title="ערוך הוצאה"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpenseToDelete(expense);
                              }}
                              title="מחק הוצאה"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                    {mySplit && (
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
                        <span className="text-slate-500">{t.your_share}</span>
                        <span className={`font-semibold ${iPaid ? 'text-green-600' : 'text-red-500'}`}>
                          {iPaid ? '+' : '-'}{currencySymbol}{Number(mySplit.share_amount).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {expense.is_pending && (
                      <div className="mt-2">
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                          {t.pending_approval}
                        </span>
                      </div>
                    )}
                    {expense.is_settled && (
                      <div className="mt-2">
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 w-fit">
                          <CheckCircle className="h-3 w-3" />
                          {(t as any).mark_as_settled || 'Settled'}
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

      {/* Settle Debt Confirmation Dialog */}
      <AlertDialog open={!!settleTarget} onOpenChange={(open) => { if (!open) setSettleTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              {(t as any).settle_debt_title || 'Settle Debt'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {((t as any).settle_debt_confirm || 'Are you sure you want to mark the entire debt with {name} as settled? This will remove all shared expenses between you.')
                .replace('{name}', settleTarget?.name || '')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={settleDebtMutation.isPending}>
              {(t as any).cancel || 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={settleDebtMutation.isPending}
              onClick={() => {
                if (settleTarget) {
                  settleDebtMutation.mutate(settleTarget.email);
                }
              }}
            >
              {settleDebtMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                (t as any).mark_as_settled || 'Mark as Settled'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!expenseToDelete} onOpenChange={(open) => !open && setExpenseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת הוצאה משותפת</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך למחוק הוצאה זו? הפעולה תמחק את ההוצאה עבור כל המשתתפים ולא ניתן לבטלה.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              onClick={() => {
                if (expenseToDelete) {
                  deleteSharedExpenseMutation.mutate(expenseToDelete.id);
                }
              }}
            >
              {deleteSharedExpenseMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'מחק'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Shared Expense Dialog */}
      {editingExpense && editingExpenseSplits && (
        <EditSharedExpenseDialog
          open={!!editingExpense}
          onOpenChange={(open) => {
            if (!open) {
              setEditingExpense(null);
              setEditingExpenseSplits(null);
            }
          }}
          sharedExpense={editingExpense}
          splits={editingExpenseSplits}
          categories={categories}
          onSave={async (data: any) => {
            await updateSharedExpenseMutation.mutateAsync({
              sharedExpenseId: editingExpense.id,
              data,
            });
          }}
          isLoading={updateSharedExpenseMutation.isPending}
        />
      )}
    </div>
  );
}
