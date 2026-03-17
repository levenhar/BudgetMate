import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { base44 } from '@/api/base44Client';
import { Check, X, CheckCheck, Loader2, User, Receipt, Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useCurrency } from '@/lib/CurrencyContext';

export default function PendingExpenseApprovalDialog({ expense, user, open, onOpenChange }) {
  const { currencySymbol } = useCurrency();
  const [sharedExpense, setSharedExpense] = useState(null);
  const [userSplit, setUserSplit] = useState(null);
  const [allSplits, setAllSplits] = useState([]);
  const [loadingAction, setLoadingAction] = useState(null);
  const queryClient = useQueryClient();
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (open && expense?.source_shared_expense_id) {
      setLoadingDetails(true);
      Promise.all([
        base44.entities.SharedExpense.filter({ id: expense.source_shared_expense_id }),
        base44.entities.SharedExpenseSplit.filter({ shared_expense_id: expense.source_shared_expense_id }),
      ]).then(([sharedExpenses, splits]) => {
        setSharedExpense(sharedExpenses[0] || null);
        setAllSplits(splits);
        setUserSplit(splits.find(s => s.user_id?.trim() === user.email?.trim()) || null);
      }).finally(() => setLoadingDetails(false));
    }
  }, [open, expense?.source_shared_expense_id, user?.email]);

  const handleAction = async (action) => {
    // action: 'approve_once' | 'always_approve' | 'reject'
    setLoadingAction(action);
    try {
      if (action === 'reject') {
        // 1. Delete this user's expense record (remove from their list entirely)
        await base44.entities.Expense.delete(expense.id);

        // 2. Mark notification as rejected
        const notifications = await base44.entities.Notification.filter({
          shared_expense_id: sharedExpense?.id,
          to_user_id: user.email,
        });
        if (notifications.length > 0) {
          await base44.entities.Notification.update(notifications[0].id, { is_read: true, action_taken: 'rejected' });
        }

        if (sharedExpense) {
          // 3. Remove this user's split record
          const userSplitRecord = allSplits.find(s => s.user_id?.trim() === user.email?.trim());
          if (userSplitRecord) {
            await base44.entities.SharedExpenseSplit.delete(userSplitRecord.id);
          }

          // 4. Remaining splits (excluding rejecting user)
          const remainingSplits = allSplits.filter(s => s.user_id?.trim() !== user.email?.trim());

          if (remainingSplits.length <= 1) {
            // Only one participant left — convert to regular expense for that user
            const lastSplit = remainingSplits[0];
            if (lastSplit) {
              // Update their expense to be a normal (non-shared) expense for the full total
              const lastUserExpenses = await base44.entities.Expense.filter({
                source_shared_expense_id: sharedExpense.id,
                user_email: lastSplit.user_id,
              });
              if (lastUserExpenses.length > 0) {
                await base44.entities.Expense.update(lastUserExpenses[0].id, {
                  amount: sharedExpense.total_amount,
                  is_shared: false,
                  is_pending: false,
                  approval_status: 'approved',
                  source_shared_expense_id: null,
                  paid_by_user_id: null,
                });
              }
              // Update last split's share_amount to full total
              await base44.entities.SharedExpenseSplit.update(lastSplit.id, {
                share_amount: sharedExpense.total_amount,
                share_percent: 100,
              });
            }
            // Mark shared expense as resolved (no longer pending/shared)
            await base44.entities.SharedExpense.update(sharedExpense.id, {
              is_pending: false,
              pending_with_users: [],
            });
          } else {
            // Recalculate splits for remaining participants
            const splitMethod = sharedExpense.split_method || 'equal';
            const totalAmount = sharedExpense.total_amount;

            for (const split of remainingSplits) {
              let newAmount;
              if (splitMethod === 'equal') {
                newAmount = totalAmount / remainingSplits.length;
              } else if (splitMethod === 'custom_percent') {
                // Redistribute this user's percent equally among remaining
                const rejectedSplit = allSplits.find(s => s.user_id?.trim() === user.email?.trim());
                const rejectedPercent = rejectedSplit?.share_percent || 0;
                const addPerParticipant = rejectedPercent / remainingSplits.length;
                const newPercent = (split.share_percent || 0) + addPerParticipant;
                newAmount = (newPercent / 100) * totalAmount;
                await base44.entities.SharedExpenseSplit.update(split.id, {
                  share_amount: newAmount,
                  share_percent: newPercent,
                });
                // Also update each participant's expense record
                const splitExpenses = await base44.entities.Expense.filter({
                  source_shared_expense_id: sharedExpense.id,
                  user_email: split.user_id,
                });
                if (splitExpenses.length > 0) {
                  await base44.entities.Expense.update(splitExpenses[0].id, { amount: newAmount });
                }
                continue;
              } else {
                // absolute / custom_amount: redistribute rejected user's share equally
                const rejectedSplit = allSplits.find(s => s.user_id?.trim() === user.email?.trim());
                const rejectedAmount = rejectedSplit?.share_amount || 0;
                newAmount = split.share_amount + (rejectedAmount / remainingSplits.length);
              }

              await base44.entities.SharedExpenseSplit.update(split.id, {
                share_amount: newAmount,
                share_percent: (newAmount / totalAmount) * 100,
              });

              // Update participant's expense record
              const splitExpenses = await base44.entities.Expense.filter({
                source_shared_expense_id: sharedExpense.id,
                user_email: split.user_id,
              });
              if (splitExpenses.length > 0) {
                await base44.entities.Expense.update(splitExpenses[0].id, { amount: newAmount });
              }
            }

            // Update pending_with_users on shared expense
            const remainingPending = (sharedExpense.pending_with_users || []).filter(u => u !== user.email);
            await base44.entities.SharedExpense.update(sharedExpense.id, {
              pending_with_users: remainingPending,
              is_pending: remainingPending.length > 0,
            });

            // Check if all remaining are now approved → finalize
            if (remainingPending.length === 0) {
              const allParticipantExpenses = await base44.entities.Expense.filter({ source_shared_expense_id: sharedExpense.id });
              for (const pExp of allParticipantExpenses) {
                if (pExp.is_pending) {
                  await base44.entities.Expense.update(pExp.id, { is_pending: false, approval_status: 'approved' });
                }
              }
            }
          }
        }

        toast.info('דחית את ההוצאה המשותפת. החלקים חושבו מחדש.');
      } else {
        // approve_once or always_approve
        const creatorId = sharedExpense?.created_by_user_id || expense.paid_by_user_id;

        if (action === 'always_approve') {
          // Add creator to current user's always-approved list
          if (creatorId) {
            const existing = await base44.entities.AlwaysApprovedUser.filter({ user_id: user.email });
            const alreadyExists = existing.some(a => a.approved_user_id === creatorId);
            if (!alreadyExists) {
              let creatorName = creatorId;
              try {
                const profiles = await base44.entities.UserProfile.filter({ user_email: creatorId });
                if (profiles.length > 0 && profiles[0].full_name) {
                  creatorName = profiles[0].full_name;
                }
              } catch (e) {}
              await base44.entities.AlwaysApprovedUser.create({
                user_id: user.email,
                approved_user_id: creatorId,
                approved_user_name: creatorName,
              });
            }

            // Approve ALL other pending expenses from this creator
            const allMyPendingExpenses = await base44.entities.Expense.filter({
              user_email: user.email,
              is_pending: true,
            });

            const otherPendingFromCreator = allMyPendingExpenses.filter(
              e => e.id !== expense.id && e.source_shared_expense_id
            );

            for (const pendingExp of otherPendingFromCreator) {
              // Verify it's from the same creator
              const [linkedShared] = await base44.entities.SharedExpense.filter({ id: pendingExp.source_shared_expense_id });
              if (!linkedShared) continue;
              const linkedCreatorId = linkedShared.created_by_user_id || linkedShared.paid_by_user_id;
              if (linkedCreatorId !== creatorId) continue;

              // Approve the expense
              await base44.entities.Expense.update(pendingExp.id, { is_pending: false, approval_status: 'approved' });

              // Mark notification as read
              const notifs = await base44.entities.Notification.filter({ to_user_id: user.email, action_taken: 'none' });
              const notif = notifs.find(n => n.shared_expense_id === linkedShared.id);
              if (notif) {
                await base44.entities.Notification.update(notif.id, { is_read: true, action_taken: 'approved' });
              }

              // Create debt for this expense
              const [linkedSplit] = await base44.entities.SharedExpenseSplit.filter({ shared_expense_id: linkedShared.id, user_id: user.email });
              if (linkedSplit && user.email?.trim() !== linkedShared.paid_by_user_id?.trim()) {
                const allDebts = await base44.entities.Debt.list();
                const fromId = user.email.trim();
                const toId = linkedShared.paid_by_user_id.trim();
                const amt = linkedSplit.share_amount;
                const existingDebt = allDebts.find(d => d.from_user_id?.trim() === fromId && d.to_user_id?.trim() === toId);
                const oppositeDebt = allDebts.find(d => d.from_user_id?.trim() === toId && d.to_user_id?.trim() === fromId);
                if (oppositeDebt) {
                  if (oppositeDebt.amount > amt) {
                    await base44.entities.Debt.update(oppositeDebt.id, { amount: oppositeDebt.amount - amt });
                  } else if (oppositeDebt.amount < amt) {
                    await base44.entities.Debt.delete(oppositeDebt.id);
                    await base44.entities.Debt.create({ from_user_id: fromId, from_user_name: user.full_name || user.email, to_user_id: toId, to_user_name: linkedShared.paid_by_user_id, amount: amt - oppositeDebt.amount });
                  } else {
                    await base44.entities.Debt.delete(oppositeDebt.id);
                  }
                } else if (existingDebt) {
                  await base44.entities.Debt.update(existingDebt.id, { amount: existingDebt.amount + amt });
                } else {
                  await base44.entities.Debt.create({ from_user_id: fromId, from_user_name: user.full_name || user.email, to_user_id: toId, to_user_name: linkedShared.paid_by_user_id, amount: amt });
                }
              }

              // Remove from pending_with_users on the linked shared expense
              const remaining = (linkedShared.pending_with_users || []).filter(u => u !== user.email);
              await base44.entities.SharedExpense.update(linkedShared.id, { pending_with_users: remaining, is_pending: remaining.length > 0 });
              if (remaining.length === 0) {
                const creatorExpenses = await base44.entities.Expense.filter({ source_shared_expense_id: linkedShared.id, user_email: linkedShared.created_by_user_id });
                if (creatorExpenses.length > 0) {
                  await base44.entities.Expense.update(creatorExpenses[0].id, { is_pending: false });
                }
              }
            }
          }
        }

        // Mark this user's expense as approved (but keep is_pending=true until ALL approve)
        const remaining = (sharedExpense?.pending_with_users || []).filter(u => u !== user.email);
        const allApproved = remaining.length === 0;

        await base44.entities.Expense.update(expense.id, {
          approval_status: 'approved',
          is_pending: !allApproved, // keep on_hold if others still pending
        });

        // Mark notification as read/approved
        const pendingNotifications = await base44.entities.Notification.filter({
          to_user_id: user.email,
          action_taken: 'none'
        });
        const relevantNotif = pendingNotifications.find(n => n.shared_expense_id === sharedExpense?.id);
        if (relevantNotif) {
          await base44.entities.Notification.update(relevantNotif.id, { is_read: true, action_taken: 'approved' });
        }

        // Remove from pending_with_users on shared expense
        if (sharedExpense) {
          await base44.entities.SharedExpense.update(sharedExpense.id, {
            pending_with_users: remaining,
            is_pending: !allApproved
          });

          if (allApproved) {
            // All participants approved — finalize everything
            // 1. Clear creator's expense pending flag
            const creatorExpenses = await base44.entities.Expense.filter({
              source_shared_expense_id: sharedExpense.id,
              user_email: sharedExpense.created_by_user_id
            });
            if (creatorExpenses.length > 0) {
              await base44.entities.Expense.update(creatorExpenses[0].id, { is_pending: false, approval_status: 'approved' });
            }

            // 2. Clear is_pending for ALL participants' expenses (those already approved)
            const allParticipantExpenses = await base44.entities.Expense.filter({
              source_shared_expense_id: sharedExpense.id
            });
            for (const pExp of allParticipantExpenses) {
              if (pExp.is_pending) {
                await base44.entities.Expense.update(pExp.id, { is_pending: false, approval_status: 'approved' });
              }
            }

            // 3. Create debts only for users who were in the pending list (auto-approved users already got their debt at creation time)
            const originalPendingUsers = new Set([...(sharedExpense.pending_with_users || []), user.email]);
            const allDebts = await base44.entities.Debt.list();
            for (const split of allSplits) {
              if (split.user_id?.trim() === sharedExpense.paid_by_user_id?.trim()) continue;
              // Skip users whose debt was already created at expense creation (not originally pending)
              if (!originalPendingUsers.has(split.user_id?.trim())) continue;
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
        }

        toast.success(allApproved
          ? (action === 'always_approve' ? 'אישרת ותמיד תאשר מהמשתמש הזה! כל המשתתפים אישרו!' : 'כל המשתתפים אישרו! ההוצאה אושרה!')
          : (action === 'always_approve' ? 'אישרת ותמיד תאשר מהמשתמש הזה!' : 'אישרת! ממתין לשאר המשתתפים...')
        );
      }

      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['alwaysApproved'] });
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error('שגיאה בביצוע הפעולה');
    } finally {
      setLoadingAction(null);
    }
  };

  if (!expense) return null;

  // Determine if this user has already approved (expense.approval_status === 'approved' but still is_pending)
  const alreadyApproved = expense.approval_status === 'approved' && expense.is_pending;
  const stillPendingUsers = sharedExpense?.pending_with_users || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <Receipt className="h-5 w-5" />
            {alreadyApproved ? 'הוצאה משותפת - ממתין לאישורים' : 'הוצאה משותפת ממתינה לאישורך'}
          </DialogTitle>
        </DialogHeader>

        {loadingDetails && !sharedExpense ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Expense Details */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">שולח</span>
                <span className="font-medium text-slate-900 flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {sharedExpense?.created_by_user_id || expense.paid_by_user_id}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">תיאור</span>
                <span className="font-medium text-slate-900">{expense.description || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">קטגוריה</span>
                <span className="font-medium text-slate-900">{expense.category_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">תאריך</span>
                <span className="font-medium text-slate-900 flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(expense.date), 'dd/MM/yyyy')}
                </span>
              </div>
              <div className="border-t border-amber-200 pt-3 flex items-center justify-between">
                <span className="text-sm text-slate-600">סכום כולל</span>
                <span className="font-semibold text-slate-900">{currencySymbol}{sharedExpense?.total_amount?.toFixed(2) || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800">החלק שלך</span>
                <span className="text-xl font-bold text-amber-700">{currencySymbol}{expense.amount?.toFixed(2)}</span>
              </div>
            </div>

            {/* Waiting for others banner */}
            {(alreadyApproved || stillPendingUsers.length > 0) && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-1">
                <div className="flex items-center gap-2 text-blue-700 font-semibold text-sm">
                  <Clock className="h-4 w-4" />
                  ממתין לאישור מ:
                </div>
                {stillPendingUsers.map((u) => (
                  <div key={u} className="text-sm text-blue-600 pr-6">• {u}</div>
                ))}
              </div>
            )}

            {/* Action Buttons — only show if not yet approved */}
            {!alreadyApproved && (
              <div className="space-y-2">
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 h-11"
                  onClick={() => handleAction('approve_once')}
                  disabled={loadingAction !== null}
                >
                  {loadingAction === 'approve_once' ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Check className="h-4 w-4 ml-2" />}
                  אשר הפעם
                </Button>
                <Button
                  className="w-full bg-emerald-700 hover:bg-emerald-800 h-11"
                  onClick={() => handleAction('always_approve')}
                  disabled={loadingAction !== null}
                >
                  {loadingAction === 'always_approve' ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <CheckCheck className="h-4 w-4 ml-2" />}
                  אשר תמיד ממשתמש זה
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-red-300 text-red-600 hover:bg-red-50 h-11"
                  onClick={() => handleAction('reject')}
                  disabled={loadingAction !== null}
                >
                  {loadingAction === 'reject' ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <X className="h-4 w-4 ml-2" />}
                  דחה
                </Button>
              </div>
            )}

            {alreadyApproved && (
              <p className="text-center text-sm text-slate-500">אישרת את ההוצאה. ממתין לאישור שאר המשתתפים.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}