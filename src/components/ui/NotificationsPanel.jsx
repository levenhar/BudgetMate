import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Bell, Check, X, Loader2, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useCurrency } from '@/lib/CurrencyContext';

export default function NotificationsPanel({ user }) {
  const { currencySymbol } = useCurrency();
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();

  const doApprove = async (notification, alwaysApprove = false) => {
    // 1. Mark notification as read + approved
    await base44.entities.Notification.update(notification.id, {
      is_read: true,
      action_taken: 'approved'
    });

    // 2. If always approve, add to AlwaysApprovedUser list
    if (alwaysApprove) {
      const existing = await base44.entities.AlwaysApprovedUser.filter({
        user_id: user.email
      });
      const alreadyExists = existing.some(a => a.approved_user_id === notification.from_user_id);
      if (!alreadyExists) {
        await base44.entities.AlwaysApprovedUser.create({
          user_id: user.email,
          approved_user_id: notification.from_user_id,
          approved_user_name: notification.from_user_name || notification.from_user_id,
        });
        queryClient.invalidateQueries({ queryKey: ['alwaysApproved'] });
      }
    }

    // 3. Get the shared expense and splits
    const sharedExpenses = await base44.entities.SharedExpense.filter({ id: notification.shared_expense_id });
    const sharedExpense = sharedExpenses[0];
    if (!sharedExpense) return;

    const splits = await base44.entities.SharedExpenseSplit.filter({
      shared_expense_id: sharedExpense.id
    });

    const userSplit = splits.find(s => s.user_id?.trim() === user.email?.trim());
    if (!userSplit) return;

    // 4. Mark this user's expense as approved (keep is_pending until all approve)
    const remaining = (sharedExpense.pending_with_users || []).filter(u => u !== user.email);
    const allApproved = remaining.length === 0;

    const existingExpenses = await base44.entities.Expense.filter({
      source_shared_expense_id: sharedExpense.id,
      user_email: user.email
    });

    if (existingExpenses.length > 0) {
      await base44.entities.Expense.update(existingExpenses[0].id, {
        approval_status: 'approved',
        is_pending: !allApproved,
      });
    }

    // 5. Update pending_with_users on SharedExpense
    await base44.entities.SharedExpense.update(sharedExpense.id, {
      pending_with_users: remaining,
      is_pending: !allApproved,
    });

    // 6. If ALL approved — finalize everything (debts, clear is_pending for all)
    if (allApproved) {
      // Clear creator expense
      const creatorExpenses = await base44.entities.Expense.filter({
        source_shared_expense_id: sharedExpense.id,
        user_email: sharedExpense.created_by_user_id
      });
      if (creatorExpenses.length > 0) {
        await base44.entities.Expense.update(creatorExpenses[0].id, { is_pending: false, approval_status: 'approved' });
      }

      // Clear all participants' pending flags
      const allParticipantExpenses = await base44.entities.Expense.filter({ source_shared_expense_id: sharedExpense.id });
      for (const pExp of allParticipantExpenses) {
        if (pExp.is_pending) {
          await base44.entities.Expense.update(pExp.id, { is_pending: false, approval_status: 'approved' });
        }
      }

      // Create debts for ALL participants
      const allDebts = await base44.entities.Debt.list();
      for (const split of splits) {
        if (split.user_id?.trim() === sharedExpense.paid_by_user_id?.trim()) continue;
        const fromId = split.user_id.trim();
        const toId = sharedExpense.paid_by_user_id.trim();
        const amt = split.share_amount;
        const existingDebt = allDebts.find(d => d.from_user_id?.trim() === fromId && d.to_user_id?.trim() === toId);
        const oppositeDebt = allDebts.find(d => d.from_user_id?.trim() === toId && d.to_user_id?.trim() === fromId);
        if (oppositeDebt) {
          if (oppositeDebt.amount > amt) {
            await base44.entities.Debt.update(oppositeDebt.id, { amount: oppositeDebt.amount - amt });
          } else if (oppositeDebt.amount < amt) {
            await base44.entities.Debt.delete(oppositeDebt.id);
            await base44.entities.Debt.create({ from_user_id: fromId, from_user_name: split.user_name || fromId, to_user_id: toId, to_user_name: sharedExpense.paid_by_user_id, amount: amt - oppositeDebt.amount });
          } else {
            await base44.entities.Debt.delete(oppositeDebt.id);
          }
        } else if (existingDebt) {
          await base44.entities.Debt.update(existingDebt.id, { amount: existingDebt.amount + amt });
        } else {
          await base44.entities.Debt.create({ from_user_id: fromId, from_user_name: split.user_name || fromId, to_user_id: toId, to_user_name: sharedExpense.paid_by_user_id, amount: amt });
        }
      }
    }
  };

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.email],
    queryFn: async () => {
      const notifs = await base44.entities.Notification.filter({ to_user_id: user.email });
      // Auto-approve notifications from always-approved users
      const alwaysApproved = await base44.entities.AlwaysApprovedUser.filter({ user_id: user.email });
      const alwaysApprovedIds = new Set(alwaysApproved.map(a => a.approved_user_id));
      const pendingNotifs = notifs.filter(n => n.action_taken === 'none' && !n.is_read && alwaysApprovedIds.has(n.from_user_id));
      for (const notif of pendingNotifs) {
        doApprove(notif, false).catch(() => {});
      }
      return notifs;
    },
    enabled: !!user?.email,
    refetchInterval: 30000,
  });

  const unread = notifications.filter(n => !n.is_read && n.action_taken === 'none');

  const approveMutation = useMutation({
    mutationFn: (notification) => doApprove(notification, false),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      toast.success('אישרת! ממתין לשאר המשתתפים...');
    }
  });

  const alwaysApproveMutation = useMutation({
    mutationFn: (notification) => doApprove(notification, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['alwaysApproved'] });
      toast.success('אישרת ותמיד תאשר ממשתמש זה!');
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async (notification) => {
      await base44.entities.Notification.update(notification.id, { is_read: true, action_taken: 'rejected' });

      const sharedExpenses = await base44.entities.SharedExpense.filter({ id: notification.shared_expense_id });
      const sharedExpense = sharedExpenses[0];
      if (!sharedExpense) return;

      const allSplits = await base44.entities.SharedExpenseSplit.filter({ shared_expense_id: sharedExpense.id });

      // 1. Delete this user's expense record
      const userExpenses = await base44.entities.Expense.filter({
        source_shared_expense_id: sharedExpense.id,
        user_email: user.email,
      });
      if (userExpenses.length > 0) await base44.entities.Expense.delete(userExpenses[0].id);

      // 2. Remove this user's split record
      const userSplitRecord = allSplits.find(s => s.user_id?.trim() === user.email?.trim());
      if (userSplitRecord) await base44.entities.SharedExpenseSplit.delete(userSplitRecord.id);

      const remainingSplits = allSplits.filter(s => s.user_id?.trim() !== user.email?.trim());
      const totalAmount = sharedExpense.total_amount;

      if (remainingSplits.length <= 1) {
        // Convert to regular expense for last user
        const lastSplit = remainingSplits[0];
        if (lastSplit) {
          const lastUserExpenses = await base44.entities.Expense.filter({
            source_shared_expense_id: sharedExpense.id,
            user_email: lastSplit.user_id,
          });
          if (lastUserExpenses.length > 0) {
            await base44.entities.Expense.update(lastUserExpenses[0].id, {
              amount: totalAmount,
              is_shared: false,
              is_pending: false,
              approval_status: 'approved',
              source_shared_expense_id: null,
              paid_by_user_id: null,
            });
          }
          await base44.entities.SharedExpenseSplit.update(lastSplit.id, { share_amount: totalAmount, share_percent: 100 });
        }
        await base44.entities.SharedExpense.update(sharedExpense.id, { is_pending: false, pending_with_users: [] });
      } else {
        // Recalculate splits for remaining
        const splitMethod = sharedExpense.split_method || 'equal';
        const rejectedSplit = allSplits.find(s => s.user_id?.trim() === user.email?.trim());

        for (const split of remainingSplits) {
          let newAmount;
          if (splitMethod === 'equal') {
            newAmount = totalAmount / remainingSplits.length;
          } else if (splitMethod === 'custom_percent') {
            const rejectedPercent = rejectedSplit?.share_percent || 0;
            const newPercent = (split.share_percent || 0) + rejectedPercent / remainingSplits.length;
            newAmount = (newPercent / 100) * totalAmount;
            await base44.entities.SharedExpenseSplit.update(split.id, { share_amount: newAmount, share_percent: newPercent });
          } else {
            const rejectedAmount = rejectedSplit?.share_amount || 0;
            newAmount = split.share_amount + rejectedAmount / remainingSplits.length;
            await base44.entities.SharedExpenseSplit.update(split.id, { share_amount: newAmount, share_percent: (newAmount / totalAmount) * 100 });
          }
          if (splitMethod !== 'custom_percent') {
            await base44.entities.SharedExpenseSplit.update(split.id, { share_amount: newAmount, share_percent: (newAmount / totalAmount) * 100 });
          }
          const splitExpenses = await base44.entities.Expense.filter({
            source_shared_expense_id: sharedExpense.id,
            user_email: split.user_id,
          });
          if (splitExpenses.length > 0) await base44.entities.Expense.update(splitExpenses[0].id, { amount: newAmount });
        }

        const remainingPending = (sharedExpense.pending_with_users || []).filter(u => u !== user.email);
        await base44.entities.SharedExpense.update(sharedExpense.id, {
          pending_with_users: remainingPending,
          is_pending: remainingPending.length > 0,
        });

        if (remainingPending.length === 0) {
          const allParticipantExpenses = await base44.entities.Expense.filter({ source_shared_expense_id: sharedExpense.id });
          for (const pExp of allParticipantExpenses) {
            if (pExp.is_pending) await base44.entities.Expense.update(pExp.id, { is_pending: false, approval_status: 'approved' });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.info('דחית את ההוצאה המשותפת. החלקים חושבו מחדש.');
    }
  });

  if (notifications.length === 0) return null;

  return (
    <div className="mb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl p-4 hover:bg-amber-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-amber-600" />
          <span className="font-semibold text-amber-900">
            התראות
            {unread.length > 0 && (
              <span className="mr-2 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">
                {unread.length}
              </span>
            )}
          </span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-amber-600" /> : <ChevronDown className="h-4 w-4 text-amber-600" />}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`border rounded-xl p-4 ${
                notif.action_taken === 'none' && !notif.is_read
                  ? 'bg-white border-amber-200'
                  : 'bg-slate-50 border-slate-200 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 text-right">
                  {notif.type === 'shared_expense_request' && (
                    <>
                      <p className="text-sm font-semibold text-slate-900">
                        {notif.from_user_name || notif.from_user_id} מבקש/ת את אישורך
                      </p>
                      <p className="text-xs text-slate-600 mt-1">
                        {notif.description || 'הוצאה משותפת'} · {notif.category_name}
                      </p>
                      <p className="text-sm font-bold text-slate-900 mt-1">
                        סה"כ: {currencySymbol}{notif.total_amount?.toFixed(2)} · החלק שלך: {currencySymbol}{notif.user_share_amount?.toFixed(2)}
                      </p>
                      {notif.action_taken === 'approved' && notif.pending_with_users?.length > 0 && (
                        <div className="mt-2 text-xs text-blue-600 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          ממתין לאישור מ: {notif.pending_with_users.join(', ')}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {notif.action_taken === 'none' && (
                  <div className="flex gap-1 flex-shrink-0 flex-col">
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 h-8 px-3 text-xs"
                        onClick={() => approveMutation.mutate(notif)}
                        disabled={approveMutation.isPending || alwaysApproveMutation.isPending}
                      >
                        {approveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-300 text-red-600 hover:bg-red-50 h-8 px-3"
                        onClick={() => rejectMutation.mutate(notif)}
                        disabled={rejectMutation.isPending}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      className="bg-emerald-700 hover:bg-emerald-800 h-7 px-2 text-xs w-full"
                      onClick={() => alwaysApproveMutation.mutate(notif)}
                      disabled={approveMutation.isPending || alwaysApproveMutation.isPending}
                    >
                      {alwaysApproveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'תמיד אשר'}
                    </Button>
                  </div>
                )}

                {notif.action_taken !== 'none' && (
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    notif.action_taken === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {notif.action_taken === 'approved' ? 'אושר' : 'נדחה'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}