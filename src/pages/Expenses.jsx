import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Plus, Receipt, Loader2, ChevronDown, ChevronRight, Calendar } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import ExpenseCard from '@/components/ui/ExpenseCard';
import ExpenseFilters from '@/components/ui/ExpenseFilters';
import EditExpenseDialog from '@/components/ui/EditExpenseDialog';
import UnifiedExpenseDialog from '@/components/ui/UnifiedExpenseDialog';
import EditSharedExpenseDialog from '@/components/ui/EditSharedExpenseDialog';
import CategoryMonthlyChart from '@/components/stats/CategoryMonthlyChart';
import NotificationsPanel from '@/components/ui/NotificationsPanel';
import PendingExpenseApprovalDialog from '@/components/ui/PendingExpenseApprovalDialog';

import { useLanguage } from '@/components/i18n/LanguageContext';
import { useCurrency } from '@/lib/CurrencyContext';

export default function Expenses() {
  const { t, dir } = useLanguage();
  const { currencySymbol } = useCurrency();
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [editingSharedExpense, setEditingSharedExpense] = useState(null);
  const [editingSharedSplits, setEditingSharedSplits] = useState(null);
  const [pendingApprovalExpense, setPendingApprovalExpense] = useState(null);
  const [recurringExpanded, setRecurringExpanded] = useState(false);
  const [dialogDefaultTab, setDialogDefaultTab] = useState('expense');
  const [deleteConfirmExpense, setDeleteConfirmExpense] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  
  // Read URL parameters via React Router (reactive, avoids stale window.location)
  const [searchParams] = useSearchParams();
  const categoryFromUrl = searchParams.get('category');
  const dateFromUrl = searchParams.get('dateFrom');
  const dateToUrl = searchParams.get('dateTo');
  
  // Default to current month if no date params in URL
  const now = new Date();
  const defaultDateFrom = dateFromUrl || format(startOfMonth(now), 'yyyy-MM-dd');
  const defaultDateTo = dateToUrl || format(endOfMonth(now), 'yyyy-MM-dd');
  
  const [filters, setFilters] = useState({
    search: '',
    categoryId: '',
    dateFrom: defaultDateFrom,
    dateTo: defaultDateTo,
    sortBy: 'date_desc',
    sharedWithUser: '',
  });
  const queryClient = useQueryClient();

  // Fetch user and settings
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

  // Fetch categories
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

  // Apply category filter from URL when categories are loaded.
  // Uses functional setFilters to avoid stale-closure on filters.categoryId.
  React.useEffect(() => {
    if (categoryFromUrl && categories.length > 0) {
      const category = categories.find(c => c.name === categoryFromUrl);
      if (category) {
        setFilters(prev => {
          if (prev.categoryId === category.id) return prev;
          return { ...prev, categoryId: category.id };
        });
      }
    }
  }, [categoryFromUrl, categories]);

  // Fetch all expenses
  const { data: expenses = [], isLoading } = useQuery({
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

  // Fetch shared expenses (to cross-reference is_settled status)
  const { data: sharedExpensesList = [] } = useQuery({
    queryKey: ['sharedExpenses', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.SharedExpense.list();
    },
    enabled: !!user?.email,
  });

  // Fetch all splits to build participant map for shared-with-user filter
  const { data: splits = [] } = useQuery({
    queryKey: ['sharedExpenseSplits', user?.email],
    queryFn: () => base44.entities.SharedExpenseSplit.list(),
    enabled: !!user?.email,
  });

  // Fetch user profiles to get picture_url for participant chips
  const { data: userProfiles = [] } = useQuery({
    queryKey: ['userProfiles'],
    queryFn: () => base44.entities.UserProfile.list(),
    enabled: !!user?.email,
  });

  // Build maps from shared expense id to is_settled and is_pending status
  const sharedExpenseStatusMap = useMemo(() => {
    const map = {};
    for (const se of sharedExpensesList) {
      map[se.id] = { is_settled: !!se.is_settled, is_pending: !!se.is_pending };
    }
    return map;
  }, [sharedExpensesList]);

  const settledSharedExpenseIds = useMemo(() => {
    const ids = new Set();
    for (const se of sharedExpensesList) {
      if (se.is_settled) ids.add(se.id);
    }
    return ids;
  }, [sharedExpensesList]);

  // Map email → { name, picture_url } for participant chip rendering
  const userProfileMap = useMemo(() =>
    new Map(userProfiles.map(p => [p.user_email, {
      name: p.full_name || p.user_email,
      picture_url: p.picture_url || null,
    }])),
    [userProfiles]
  );

  // Map each shared_expense_id to an array of full participant objects.
  // Only includes shared expenses the current user participates in.
  const splitParticipantsMap = useMemo(() => {
    const mySharedExpenseIds = new Set(
      splits
        .filter(s => s.user_id === user?.email)
        .map(s => s.shared_expense_id)
    );
    const map = new Map();
    for (const split of splits) {
      if (!mySharedExpenseIds.has(split.shared_expense_id)) continue;
      if (!map.has(split.shared_expense_id)) {
        map.set(split.shared_expense_id, []);
      }
      const profile = userProfileMap.get(split.user_id);
      map.get(split.shared_expense_id).push({
        email: split.user_id,
        name: profile?.name || split.user_name || split.user_id,
        picture_url: profile?.picture_url || null,
      });
    }
    return map;
  }, [splits, user?.email, userProfileMap]);

  // Fetch recurring expenses
  const { data: recurringExpenses = [] } = useQuery({
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

  // Mutations
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

      // Create multiple expenses for installments
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
      setShowAddExpense(false);
    },
  });

  const createRecurringMutation = useMutation({
    mutationFn: (data) => base44.entities.RecurringExpense.create({
      ...data,
      household_id: isHouseholdMode ? settings.current_household_id : null,
      user_email: user.email
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['recurringExpenses']);
      toast.success('הוצאה קבועה נוספה בהצלחה');
      setShowAddExpense(false);
    },
  });

  const updateExpenseMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      await base44.entities.Expense.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('ההוצאה עודכנה בהצלחה!');
      setEditingExpense(null);
    },
  });

  const updateSharedExpenseMutation = useMutation({
    mutationFn: async ({ sharedExpenseId, data }) => {
      const sharedExpense = await base44.entities.SharedExpense.list();
      const shared = sharedExpense.find(s => s.id === sharedExpenseId);
      
      // Get old splits before any changes
      const oldSplits = await base44.entities.SharedExpenseSplit.filter({
        shared_expense_id: sharedExpenseId
      });

      // Handle removed participants
      if (data.removedParticipants && data.removedParticipants.length > 0) {
        for (const removedUserId of data.removedParticipants) {
          // Find and delete the removed user's split
          const splitToRemove = oldSplits.find(s => s.user_id === removedUserId);
          if (splitToRemove) {
            await base44.entities.SharedExpenseSplit.delete(splitToRemove.id);
            
            // Delete the removed user's expense
            const expenseToRemove = await base44.entities.Expense.filter({
              source_shared_expense_id: sharedExpenseId,
              user_email: removedUserId
            });
            if (expenseToRemove.length > 0) {
              await base44.entities.Expense.delete(expenseToRemove[0].id);
            }
            
            // Reverse debt for removed user
              if (removedUserId !== shared.paid_by_user_id) {
                const allDebts = await base44.entities.Debt.list();
                const removedUserIdTrimmed = removedUserId.trim();
                const sharedPaidByUserIdTrimmed = shared.paid_by_user_id.trim();

                const existingDebt = allDebts.find(d => 
                  d.from_user_id?.trim() === removedUserIdTrimmed && 
                  d.to_user_id?.trim() === sharedPaidByUserIdTrimmed
                );

              if (existingDebt) {
                const newAmount = existingDebt.amount - splitToRemove.share_amount;
                if (newAmount <= 0.01) {
                  await base44.entities.Debt.delete(existingDebt.id);
                } else {
                  await base44.entities.Debt.update(existingDebt.id, {
                    amount: newAmount
                  });
                }
              }
            }
          }
        }
      }

      // Re-check always-approved list to determine current pending users
      let alwaysApprovedRecords = [];
      try { alwaysApprovedRecords = await base44.entities.AlwaysApprovedUser.list(); } catch (e) {}
      const alwaysApprovedByParticipant = new Set(
        alwaysApprovedRecords.filter(r => r.approved_user_id === shared.created_by_user_id).map(r => r.user_id)
      );
      // Keep pending only for participants who haven't always-approved (excluding creator and payer)
      const currentSplitUserIds = data.splits.map(s => s.userId).filter(id => id !== shared.created_by_user_id);
      const newPendingWithUsers = currentSplitUserIds.filter(id => !alwaysApprovedByParticipant.has(id));
      const isStillPending = newPendingWithUsers.length > 0;

      // Update the shared expense — preserve pending state correctly
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
          user_id: split.userId
        });
        
        if (existingSplits.length > 0) {
          // Update existing split
          await base44.entities.SharedExpenseSplit.update(existingSplits[0].id, {
            share_amount: split.shareAmount,
            share_percent: split.sharePercent || null,
          });
        } else {
          // Create new split for new participant
          await base44.entities.SharedExpenseSplit.create({
            shared_expense_id: sharedExpenseId,
            user_id: split.userId,
            user_name: split.userName,
            share_amount: split.shareAmount,
            share_percent: split.sharePercent || null,
          });
        }
      }

      // Get all available categories for matching
      const allCategoriesForUpdate = await base44.entities.Category.list();

      // Update/create participant expenses
      for (const split of data.splits) {
        const existingExpense = await base44.entities.Expense.filter({
          source_shared_expense_id: sharedExpenseId,
          user_email: split.userId
        });

        // Find category with matching name for this participant
        let categoryIdForParticipant = data.category_id;
        if (split.userId !== shared.created_by_user_id) {
          const participantCategory = allCategoriesForUpdate.find(c => 
            c.name === data.category_name && 
            c.user_email === split.userId
          );
          if (participantCategory) {
            categoryIdForParticipant = participantCategory.id;
          }
        }

        const isParticipantPending = newPendingWithUsers.includes(split.userId);
        const isThisUserCreator = split.userId === shared.created_by_user_id;
        const isPendingForThisUser = isThisUserCreator ? isStillPending : isParticipantPending;

        if (existingExpense.length > 0) {
          // Update existing expense — preserve pending status correctly
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
          // Create new expense for new participant
          await base44.entities.Expense.create({
            amount: split.shareAmount,
            date: data.date,
            category_id: categoryIdForParticipant,
            category_name: data.category_name,
            description: data.description,
            user_email: split.userId,
            household_id: shared.household_id,
            source_shared_expense_id: sharedExpenseId,
            paid_by_user_id: data.paid_by_user_id,
            is_shared: true,
            is_pending: isPendingForThisUser,
            approval_status: isPendingForThisUser ? 'pending' : 'approved',
          });
        }
      }

      // Recalculate all debts from scratch
      const remainingOldSplits = oldSplits.filter(os => 
        !data.removedParticipants?.includes(os.user_id)
      );

      for (const oldSplit of remainingOldSplits) {
        if (oldSplit.user_id === shared.paid_by_user_id) continue;

        const allDebts = await base44.entities.Debt.list();
        const oldSplitUserIdTrimmed = oldSplit.user_id.trim();
        const sharedPaidByUserIdTrimmed = shared.paid_by_user_id.trim();

        const existingDebt = allDebts.find(d => 
          d.from_user_id?.trim() === oldSplitUserIdTrimmed && 
          d.to_user_id?.trim() === sharedPaidByUserIdTrimmed
        );

        if (existingDebt) {
          const newAmount = existingDebt.amount - oldSplit.share_amount;
          if (newAmount <= 0.01) {
            await base44.entities.Debt.delete(existingDebt.id);
          } else {
            await base44.entities.Debt.update(existingDebt.id, {
              amount: newAmount
            });
          }
        }
      }

      // Create new debts — only for non-pending participants
      for (const split of data.splits) {
        if (split.userId === data.paid_by_user_id) continue;
        if (newPendingWithUsers.includes(split.userId)) continue;

        const allDebts = await base44.entities.Debt.list();
        const splitUserIdTrimmed = split.userId.trim();
        const paidByUserIdTrimmed = data.paid_by_user_id.trim();

        const oppositeDebt = allDebts.find(d => 
          d.from_user_id?.trim() === paidByUserIdTrimmed && 
          d.to_user_id?.trim() === splitUserIdTrimmed
        );

        const existingDebt = allDebts.find(d => 
          d.from_user_id?.trim() === splitUserIdTrimmed && 
          d.to_user_id?.trim() === paidByUserIdTrimmed
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
                to_user_name: data.splits.find(s => s.userId === data.paid_by_user_id)?.userName || data.paid_by_user_id,
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
            to_user_name: data.splits.find(s => s.userId === data.paid_by_user_id)?.userName || data.paid_by_user_id,
            amount: split.shareAmount,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('הוצאה משותפת עודכנה בהצלחה!');
      setEditingSharedExpense(null);
      setEditingSharedSplits(null);
    },
    });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (id) => {
      const expense = expenses.find(e => e.id === id);

      if (expense?.is_shared && expense?.source_shared_expense_id) {
        // Delete shared expense and all related data
        const sharedExpense = await base44.entities.SharedExpense.list();
        const shared = sharedExpense.find(s => s.id === expense.source_shared_expense_id);

        if (shared) {
          // Get all splits
          const splits = await base44.entities.SharedExpenseSplit.filter({
            shared_expense_id: shared.id
          });

          // Delete all participant expenses
          const allParticipantExpenses = await base44.entities.Expense.filter({
            source_shared_expense_id: shared.id
          });

          for (const exp of allParticipantExpenses) {
            await base44.entities.Expense.delete(exp.id);
          }

          // Delete all splits
          for (const split of splits) {
            await base44.entities.SharedExpenseSplit.delete(split.id);
          }

          // Reverse debts
          for (const split of splits) {
            if (split.user_id === shared.paid_by_user_id) continue;

            const allDebts = await base44.entities.Debt.list();
            const splitUserIdTrimmed = split.user_id.trim();
            const sharedPaidByUserIdTrimmed = shared.paid_by_user_id.trim();

            const existingDebt = allDebts.find(d => 
              d.from_user_id?.trim() === splitUserIdTrimmed && 
              d.to_user_id?.trim() === sharedPaidByUserIdTrimmed
            );

            if (existingDebt) {
              const newAmount = existingDebt.amount - split.share_amount;
              if (newAmount <= 0.01) {
                await base44.entities.Debt.delete(existingDebt.id);
              } else {
                await base44.entities.Debt.update(existingDebt.id, {
                  amount: newAmount
                });
              }
            }
          }

          // Delete shared expense
          await base44.entities.SharedExpense.delete(shared.id);

          toast.success('הוצאה משותפת נמחקה עבור כל המשתתפים');
        }
      } else {
        await base44.entities.Expense.delete(id);
        toast.success('ההוצאה נמחקה בהצלחה!');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['debts'] });
    },
    });

  const createSharedExpenseMutation = useMutation({
    mutationFn: async (data) => {

      // Determine which participants have always-approved the current user
      let alwaysApprovedRecords = [];
      try {
        alwaysApprovedRecords = await base44.entities.AlwaysApprovedUser.list();
      } catch (e) {}

      const alwaysApprovedByParticipant = new Set(
        alwaysApprovedRecords
          .filter(r => r.approved_user_id === user.email)
          .map(r => r.user_id)
      );

      const pendingWithUsers = (data.participants || [])
        .filter(p => !alwaysApprovedByParticipant.has(p.email))
        .map(p => p.email);

      const isPending = pendingWithUsers.length > 0;

      // Create shared expense
      const sharedExpense = await base44.entities.SharedExpense.create({
        created_by_user_id: user.email,
        total_amount: data.total_amount,
        date: data.date,
        category_id: data.category_id,
        category_name: data.category_name,
        description: data.description,
        paid_by_user_id: data.paid_by_user_id,
        split_method: data.split_method,
        household_id: data.household_id,
        is_pending: isPending,
        pending_with_users: pendingWithUsers,
      });

      // Send notifications for participants requiring approval
      if (pendingWithUsers.length > 0) {
        for (const pendingUserId of pendingWithUsers) {
          const userSplit = data.splits.find(s => s.userId === pendingUserId);
          await base44.entities.Notification.create({
            to_user_id: pendingUserId,
            from_user_id: user.email,
            from_user_name: user.full_name || user.email,
            type: 'shared_expense_request',
            shared_expense_id: sharedExpense.id,
            total_amount: data.total_amount,
            user_share_amount: userSplit?.shareAmount || 0,
            description: data.description || '',
            category_name: data.category_name || '',
            is_read: false,
            action_taken: 'none'
          });
        }
      }

      // Create splits
      await base44.entities.SharedExpenseSplit.bulkCreate(
        data.splits.map(s => ({
          shared_expense_id: sharedExpense.id,
          user_id: s.userId,
          user_name: s.userName,
          share_amount: s.shareAmount,
          share_percent: s.sharePercent || null,
        }))
      );

      // Get all available categories for matching
     const allCategoriesData = await base44.entities.Category.list();

     // Create expense records for ALL participants:
     // - Creator: marked is_pending=true if there are pending participants
     // - Pending participants: created immediately with is_pending=true so they see it in their list
     // - Already-approved participants: created with is_pending=false
     const expenseRecords = [];

     for (const s of data.splits) {
       const isParticipantPending = pendingWithUsers.includes(s.userId);
       const isPendingForThisUser = s.userId === user.email
         ? isPending
         : isParticipantPending;

       const participantCategory = s.userId !== user.email
         ? allCategoriesData.find(c => c.name === data.category_name && c.user_email === s.userId)
         : null;

       expenseRecords.push({
         amount: s.shareAmount,
         date: data.date,
         category_id: participantCategory?.id || data.category_id,
         category_name: data.category_name,
         description: data.description,
         user_email: s.userId,
         household_id: data.household_id,
         source_shared_expense_id: sharedExpense.id,
         paid_by_user_id: data.paid_by_user_id,
         is_shared: true,
         is_pending: isPendingForThisUser,
         approval_status: isPendingForThisUser ? 'pending' : 'approved',
       });
     }

     if (expenseRecords.length > 0) {
       await base44.entities.Expense.bulkCreate(expenseRecords);
     }

      // Create/update debts with netting — skip pending users
       for (const split of data.splits) {
           if (split.userId === data.paid_by_user_id) {
             continue;
           }
           // Skip users who haven't approved yet
           if (pendingWithUsers.includes(split.userId)) {
             continue;
           }

           const debtAmount = split.shareAmount;
           const fromUserId = split.userId;
           const toUserId = data.paid_by_user_id;

           const allDebts = await base44.entities.Debt.list();

        // חפש חוב הפוך (אם toUserId חייב ל-fromUserId)
        const fromUserIdTrimmed = fromUserId.trim();
        const toUserIdTrimmed = toUserId.trim();

        const oppositeDebts = allDebts.filter(d => 
          d.from_user_id?.trim() === toUserIdTrimmed && 
          d.to_user_id?.trim() === fromUserIdTrimmed
        );

        // חפש חוב קיים
        const existingDebts = allDebts.filter(d => 
          d.from_user_id?.trim() === fromUserIdTrimmed && 
          d.to_user_id?.trim() === toUserIdTrimmed
        );

        const oppositeDebt = oppositeDebts.length > 0 ? oppositeDebts[0] : null;
        const existingDebt = existingDebts.length > 0 ? existingDebts[0] : null;

        if (oppositeDebt) {
          const oppositeAmount = oppositeDebt.amount;

          if (oppositeAmount > debtAmount) {
            // הוקטן החוב ההפוך
            await base44.entities.Debt.update(oppositeDebt.id, {
              amount: oppositeAmount - debtAmount,
            });
          } else if (oppositeAmount < debtAmount) {
            // מחק חוב הפוך והוצר חוב חדש בכיוון ההפוך
            await base44.entities.Debt.delete(oppositeDebt.id);
            await base44.entities.Debt.create({
              from_user_id: fromUserIdTrimmed,
              from_user_name: split.userName,
              to_user_id: toUserIdTrimmed,
              to_user_name: data.splits.find(s => s.userId === toUserId)?.userName || toUserId,
              amount: debtAmount - oppositeAmount,
            });
          } else {
            // חובות מבטלים זה את זה
            await base44.entities.Debt.delete(oppositeDebt.id);
          }
        } else if (existingDebt) {
          // הוסף לחוב הקיים
          await base44.entities.Debt.update(existingDebt.id, {
            amount: existingDebt.amount + debtAmount,
          });
        } else {
          // צור חוב חדש
           const debtPayload = {
             from_user_id: fromUserId.trim(),
             from_user_name: split.userName,
             to_user_id: toUserId.trim(),
             to_user_name: data.splits.find(s => s.userId === toUserId)?.userName || toUserId,
             amount: debtAmount,
           };
           await base44.entities.Debt.create(debtPayload);
        }
      }
    },
    onSuccess: () => {
     queryClient.invalidateQueries({ queryKey: ['expenses'] });
     queryClient.invalidateQueries({ queryKey: ['debts'] });
     toast.success('הוצאה משותפת נוצרה בהצלחה!');
     setShowAddExpense(false);
    },
    });

  // Filter and sort expenses
  const filteredExpenses = useMemo(() => {
    let result = expenses.map(e => {
      if (!e.source_shared_expense_id) return e;
      const seStatus = sharedExpenseStatusMap[e.source_shared_expense_id];
      return {
        ...e,
        is_settled: seStatus?.is_settled || false,
        // Fix stale is_pending: if the SharedExpense is no longer pending, clear the expense's is_pending too
        is_pending: seStatus ? (e.is_pending && seStatus.is_pending) : e.is_pending,
      };
    });

    // Text search
    if (filters.search) {
      const search = filters.search.toLowerCase();
      result = result.filter(e => 
        e.category_name?.toLowerCase().includes(search) ||
        e.description?.toLowerCase().includes(search) ||
        e.merchant?.toLowerCase().includes(search)
      );
    }

    // Category filter
    if (filters.categoryId && filters.categoryId !== 'all') {
      result = result.filter(e => e.category_id === filters.categoryId);
    }

    // Date filters
    if (filters.dateFrom) {
      result = result.filter(e => e.date >= filters.dateFrom);
    }
    if (filters.dateTo) {
      result = result.filter(e => e.date <= filters.dateTo);
    }

    // Shared-with-user filter
    if (filters.sharedWithUser === 'all_shared') {
      // Show all shared expenses regardless of who paid
      result = result.filter(e => e.is_shared);
    } else if (filters.sharedWithUser) {
      const selectedUser = filters.sharedWithUser;
      result = result.filter(e => {
        if (!e.is_shared) return false;
        // Expenses with is_shared=true but no source_shared_expense_id are legacy records — skip.
        if (!e.source_shared_expense_id) return false;
        const participants = splitParticipantsMap.get(e.source_shared_expense_id);
        return participants?.some(p => p.email === selectedUser) ?? false;
      });
    }

    // Sort
    result.sort((a, b) => {
      switch (filters.sortBy) {
        case 'date_asc':
          return new Date(a.date) - new Date(b.date);
        case 'amount_desc':
          return b.amount - a.amount;
        case 'amount_asc':
          return a.amount - b.amount;
        default: // date_desc
          return new Date(b.date) - new Date(a.date);
      }
    });

    return result;
  }, [expenses, filters, sharedExpenseStatusMap, splitParticipantsMap]);

  const clearFilters = () => {
    setFilters({
      search: '',
      categoryId: '',
      dateFrom: '',
      dateTo: '',
      sortBy: 'date_desc',
      sharedWithUser: '',
    });
  };

  const filterCurrentMonth = () => {
    const now = new Date();
    setFilters({
      ...filters,
      dateFrom: format(startOfMonth(now), 'yyyy-MM-dd'),
      dateTo: format(endOfMonth(now), 'yyyy-MM-dd'),
    });
  };

  const totalFiltered = filteredExpenses.filter(e => !e.is_pending).reduce((sum, e) => sum + e.amount, 0);

  // Build dropdown options from splitParticipantsMap — all co-participants except self.
  const sharedUsers = useMemo(() => {
    const userMap = new Map();
    for (const [, participants] of splitParticipantsMap) {
      for (const p of participants) {
        if (p.email === user?.email) continue;
        if (!userMap.has(p.email)) {
          userMap.set(p.email, { email: p.email, name: p.name });
        }
      }
    }
    return Array.from(userMap.values());
  }, [splitParticipantsMap, user?.email]);
  
  // Filter recurring expenses by category and date range
  const activeRecurring = recurringExpenses.filter(r => {
    if (!r.is_active) return false;
    
    // Check if recurring is active during the filtered date range
    const startDate = new Date(r.start_date);
    const endDate = r.end_date ? new Date(r.end_date) : null;
    const rangeStart = filters.dateFrom ? new Date(filters.dateFrom) : null;
    const rangeEnd = filters.dateTo ? new Date(filters.dateTo) : null;
    
    if (rangeEnd && startDate > rangeEnd) return false;
    if (rangeStart && endDate && endDate < rangeStart) return false;
    
    if (filters.categoryId && filters.categoryId !== 'all') {
      return r.category_id === filters.categoryId;
    }
    return true;
  });
  
  const recurringTotal = activeRecurring.reduce((sum, r) => sum + r.amount, 0);

  // Check if only category filter is active (and optional date range)
  const isCategoryOnlyFilter = filters.categoryId && filters.categoryId !== 'all' && !filters.search;

  // Calculate monthly statistics for filtered category
  const monthlyStats = useMemo(() => {
    if (!isCategoryOnlyFilter) return [];

    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    const monthlyData = {};
    
    expenses
      .filter(e => {
        if (e.category_id !== filters.categoryId) return false;
        if (e.is_pending) return false;
        const expenseDate = new Date(e.date);
        return expenseDate <= today; // Only past and current expenses
      })
      .forEach(expense => {
        const date = new Date(expense.date);
        const monthKey = format(date, 'yyyy-MM');
        const monthLabel = format(date, 'MM/yyyy');
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = {
            month: monthLabel,
            amount: 0,
            sortKey: monthKey
          };
        }
        monthlyData[monthKey].amount += expense.amount;
      });

    return Object.values(monthlyData)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .slice(-12); // Last 12 months
  }, [expenses, filters.categoryId, isCategoryOnlyFilter]);

  return (
    <div className="min-h-screen bg-slate-50" dir={dir}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t.all_expenses}</h1>
            <p className="text-slate-500 mt-1">
              {filteredExpenses.length} {t.expenses} · {currencySymbol}{totalFiltered.toFixed(2)} {t.total}
              {recurringTotal > 0 && <span className="ms-1">· {t.recurring_active}: {currencySymbol}{recurringTotal.toFixed(2)}</span>}
            </p>
          </div>

        </div>

        {/* Notifications */}
        <NotificationsPanel user={user} />

        {/* Filters */}
        <div className="mb-6">
          <ExpenseFilters
            filters={filters}
            onFilterChange={setFilters}
            categories={categories}
            onClear={clearFilters}
            onCurrentMonth={filterCurrentMonth}
            sharedUsers={sharedUsers}
            t={t}
            dir={dir}
          />
        </div>

        {/* Recurring Expenses */}
        {activeRecurring.length > 0 && (
          <div className="mb-6">
            <button
              onClick={() => setRecurringExpanded(!recurringExpanded)}
              className="w-full flex items-center justify-between bg-slate-100 rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-all mb-3"
            >
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 bg-slate-500 rounded-full animate-pulse" />
                <span className="text-sm font-semibold text-slate-900">{t.recurring_active}</span>
                <span className="text-sm text-slate-500">({activeRecurring.length})</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-slate-900">{currencySymbol}{recurringTotal.toFixed(2)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-slate-500 hover:text-slate-900 hover:bg-slate-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDialogDefaultTab('recurring');
                    setShowAddExpense(true);
                  }}
                  title="Add recurring expense"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                {recurringExpanded ? (
                  <ChevronDown className="h-5 w-5 text-slate-400" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-slate-400" />
                )}
              </div>
            </button>

            {recurringExpanded && (
              <div className="space-y-2">
                {activeRecurring.map((rec) => {
                  const category = categories.find(c => c.id === rec.category_id);
                  return (
                    <div
                      key={rec.id}
                      className="flex items-center justify-between px-3 py-2 bg-slate-100 rounded-lg border border-slate-200"
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div 
                          className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${category?.color || '#8b5cf6'}20` }}
                        >
                          <div 
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: category?.color || '#8b5cf6' }}
                          />
                        </div>
                        <div className="flex items-center gap-1.5 text-xs flex-1 min-w-0">
                          <span className="font-semibold text-slate-900 whitespace-nowrap">{currencySymbol}{rec.amount.toFixed(2)}</span>
                          <span className="text-slate-300">|</span>
                          <span className="text-slate-600 truncate">{rec.name}</span>
                          <span className="text-slate-300">|</span>
                          <span className="text-slate-500 truncate">
                            {rec.frequency === 'daily' ? t.daily : rec.frequency === 'weekly' ? t.weekly : rec.frequency === 'monthly' ? t.monthly_freq : t.yearly}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Expense List */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
            <Receipt className="h-16 w-16 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-medium text-slate-700">{t.no_expenses_found}</h3>
            <p className="text-slate-500 mt-1">
              {expenses.length === 0 
                ? t.add_first_expense
                : t.try_change_filters
              }
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredExpenses.map((expense) => {
              // For shared expenses, use category by name if available in user's categories
              let cat = categories.find(c => c.id === expense.category_id);
              if (!cat && expense.category_name) {
                cat = categories.find(c => c.name === expense.category_name);
              }
              return (
                <ExpenseCard
                   key={expense.id}
                   expense={expense}
                   categoryColor={cat?.color || '#64748b'}
                   currentUserEmail={user?.email}
                   isExpanded={expandedId === expense.id}
                   onToggleExpand={(id) => setExpandedId(prev => prev === id ? null : id)}
                   onApprovePending={expense.is_pending && expense.is_shared && expense.created_by !== user?.email
                     ? (e) => setPendingApprovalExpense(e)
                     : undefined}
                   onEdit={async (e) => {
                     // If pending and I'm the approver (not creator), open approval dialog
                     if (e.is_pending && e.is_shared && e.created_by !== user?.email) {
                       setPendingApprovalExpense(e);
                       return;
                     }
                     // If shared, open edit shared dialog (creator can always edit)
                     if (e.is_shared && e.source_shared_expense_id) {
                       const sharedExpenses = await base44.entities.SharedExpense.filter({ id: e.source_shared_expense_id });
                       const shared = sharedExpenses[0];
                       if (shared) {
                         const splits = await base44.entities.SharedExpenseSplit.filter({ shared_expense_id: shared.id });
                         setEditingSharedExpense(shared);
                         setEditingSharedSplits(splits);
                       }
                     } else {
                       setEditingExpense(e);
                     }
                   }}
                  onDelete={(e) => {
                    if (e.is_shared) {
                      setDeleteConfirmExpense(e);
                    } else {
                      deleteExpenseMutation.mutate(e.id);
                    }
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Monthly Chart - Show only when filtering by category */}
        {isCategoryOnlyFilter && monthlyStats.length > 0 && (
          <div className="mt-6">
            <CategoryMonthlyChart 
              data={monthlyStats} 
              categoryName={categories.find(c => c.id === filters.categoryId)?.name || ''}
            />
          </div>
        )}
      </div>

      {/* Add Expense Dialog */}
      <UnifiedExpenseDialog
        open={showAddExpense}
        onOpenChange={(open) => {
          setShowAddExpense(open);
          if (!open) setDialogDefaultTab('expense');
        }}
        categories={categories}
        onSubmitExpense={(data) => createExpenseMutation.mutate(data)}
        onSubmitRecurring={(data) => createRecurringMutation.mutate(data)}
        onSubmitShared={(data) => createSharedExpenseMutation.mutate(data)}
        isSubmittingExpense={createExpenseMutation.isPending}
        isSubmittingRecurring={createRecurringMutation.isPending}
        isSubmittingShared={createSharedExpenseMutation.isPending}
        defaultTab={dialogDefaultTab}
        user={user}
        isHouseholdMode={isHouseholdMode}
        householdId={settings?.current_household_id}
      />

      {/* Edit Expense Dialog */}
      <EditExpenseDialog
        expense={editingExpense}
        categories={categories}
        open={!!editingExpense && !editingExpense?.is_shared}
        onOpenChange={() => setEditingExpense(null)}
        onSave={(data) => updateExpenseMutation.mutate({ id: editingExpense.id, data })}
        isLoading={updateExpenseMutation.isPending}
      />

      {/* Edit Shared Expense Dialog */}
      <EditSharedExpenseDialog
        open={!!editingSharedExpense}
        onOpenChange={() => {
          setEditingSharedExpense(null);
          setEditingSharedSplits(null);
        }}
        sharedExpense={editingSharedExpense}
        splits={editingSharedSplits}
        categories={categories}
        onSave={(data) => updateSharedExpenseMutation.mutate({ 
          sharedExpenseId: editingSharedExpense.id, 
          data 
        })}
        isLoading={updateSharedExpenseMutation.isPending}
      />

      {/* Delete Shared Expense Confirmation Dialog */}
      <Dialog open={!!deleteConfirmExpense} onOpenChange={(open) => { if (!open) setDeleteConfirmExpense(null); }}>
        <DialogContent className="sm:max-w-md" dir={dir}>
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <DialogTitle className="text-slate-900">{t.delete_shared_expense_title}</DialogTitle>
            </div>
            <DialogDescription className="text-slate-600 mt-2 text-sm leading-relaxed">
              {t.delete_shared_expense_desc}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 mt-4 flex-row-reverse">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmExpense(null)}
              className="flex-1"
            >
              {t.cancel}
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                deleteExpenseMutation.mutate(deleteConfirmExpense.id);
                setDeleteConfirmExpense(null);
              }}
              disabled={deleteExpenseMutation.isPending}
            >
              {t.delete_expense}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pending Expense Approval Dialog */}
      <PendingExpenseApprovalDialog
        expense={pendingApprovalExpense}
        user={user}
        open={!!pendingApprovalExpense}
        onOpenChange={(open) => { if (!open) setPendingApprovalExpense(null); }}
      />


    </div>
  );
}