import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { LayoutDashboard, Receipt, BarChart3, Settings, Wallet, Repeat, Menu, Users, Plus, X, Target } from 'lucide-react';
import { Toaster } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import UnifiedExpenseDialog from '@/components/ui/UnifiedExpenseDialog';
import { LanguageProvider, useLanguage } from '@/components/i18n/LanguageContext';

export default function Layout({ children, currentPageName }) {
  return (
    <LanguageProvider>
      <LayoutInner currentPageName={currentPageName}>{children}</LayoutInner>
    </LanguageProvider>
  );
}

function LayoutInner({ children, currentPageName }) {
  const { t, dir } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [addExpenseTab, setAddExpenseTab] = useState('expense');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { key: 'dashboard', icon: LayoutDashboard, page: 'Dashboard' },
    { key: 'expenses', icon: Receipt, page: 'Expenses' },
    { key: 'recurring_expenses', icon: Repeat, page: 'RecurringExpenses' },
    { key: 'budget', icon: Wallet, page: 'Budget' },
    { key: 'debts', icon: Users, page: 'Debts' },
    { key: 'statistics', icon: BarChart3, page: 'Statistics' },
    { key: 'goals', icon: Target, page: 'Goals' },
    { key: 'settings', icon: Settings, page: 'Settings' },
  ];

  const mobileMainItems = [
    { key: 'dashboard', icon: LayoutDashboard, page: 'Dashboard' },
    { key: 'expenses', icon: Receipt, page: 'Expenses' },
    { key: 'budget', icon: Wallet, page: 'Budget' },
    { key: 'debts', icon: Users, page: 'Debts' },
  ];

  React.useEffect(() => {
    const handler = (e) => {
      setAddExpenseTab(e.detail?.tab || 'expense');
      setShowAddExpense(true);
    };
    window.addEventListener('open-add-expense', handler);
    return () => window.removeEventListener('open-add-expense', handler);
  }, []);
  const queryClient = useQueryClient();

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

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['pendingApprovalCount', user?.email],
    queryFn: async () => {
      if (!user?.email) return 0;
      const expenses = await base44.entities.Expense.filter({
        user_email: user.email,
        is_pending: true,
        approval_status: 'pending',
      });
      return expenses.length;
    },
    enabled: !!user?.email,
    refetchInterval: 30000,
  });

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

  const createExpenseMutation = useMutation({
    mutationFn: async (data) => {
      const { installments = 1, ...expenseData } = data;
      const baseData = {
        ...expenseData,
        user_email: user.email,
        household_id: isHouseholdMode ? settings.current_household_id : null,
      };
      if (installments <= 1) return base44.entities.Expense.create(baseData);
      const installmentAmount = baseData.amount / installments;
      const expenses = [];
      for (let i = 0; i < installments; i++) {
        const installmentDate = new Date(baseData.date);
        installmentDate.setMonth(installmentDate.getMonth() + i);
        expenses.push({
          ...baseData,
          amount: installmentAmount,
          date: format(installmentDate, 'yyyy-MM-dd'),
          description: baseData.description
            ? `${baseData.description} (תשלום ${i + 1}/${installments})`
            : `תשלום ${i + 1}/${installments}`,
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
      user_email: user.email,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['recurringExpenses']);
      toast.success('הוצאה קבועה נוספה בהצלחה');
      setShowAddExpense(false);
    },
  });

  const createSharedExpenseMutation = useMutation({
    mutationFn: async (data) => {
      let alwaysApprovedRecords = [];
      try { alwaysApprovedRecords = await base44.entities.AlwaysApprovedUser.list(); } catch (e) {}
      const alwaysApprovedByParticipant = new Set(
        alwaysApprovedRecords.filter(r => r.approved_user_id === user.email).map(r => r.user_id)
      );
      const pendingWithUsers = (data.participants || [])
        .filter(p => !alwaysApprovedByParticipant.has(p.email))
        .map(p => p.email);
      const isPending = pendingWithUsers.length > 0;

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
            action_taken: 'none',
          });
        }
      }

      await base44.entities.SharedExpenseSplit.bulkCreate(
        data.splits.map(s => ({
          shared_expense_id: sharedExpense.id,
          user_id: s.userId,
          user_name: s.userName,
          share_amount: s.shareAmount,
          share_percent: s.sharePercent || null,
        }))
      );

      const allCategoriesData = await base44.entities.Category.list();
      const expenseRecords = [];
      for (const s of data.splits) {
        // A user is "pending" (needs to explicitly approve) if they are in pendingWithUsers
        const isParticipantPending = pendingWithUsers.includes(s.userId);
        // Always-approved users have already "approved" (not in pendingWithUsers),
        // but the overall expense is still pending if there are other pending users.
        // So is_pending=true (waiting for others), approval_status='approved'.
        const alreadyAutoApproved = !isParticipantPending && s.userId !== user.email;
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
          // Everyone's expense stays pending until ALL pending users approve
          is_pending: isPending,
          // Auto-approved users & creator are already 'approved'; others are 'pending'
          approval_status: isParticipantPending ? 'pending' : 'approved',
        });
      }
      if (expenseRecords.length > 0) {
        await base44.entities.Expense.bulkCreate(expenseRecords);
      }

      for (const split of data.splits) {
        if (split.userId === data.paid_by_user_id) continue;
        if (pendingWithUsers.includes(split.userId)) continue;
        const allDebts = await base44.entities.Debt.list();
        const fromUserIdTrimmed = split.userId.trim();
        const toUserIdTrimmed = data.paid_by_user_id.trim();
        const oppositeDebt = allDebts.find(d => d.from_user_id?.trim() === toUserIdTrimmed && d.to_user_id?.trim() === fromUserIdTrimmed);
        const existingDebt = allDebts.find(d => d.from_user_id?.trim() === fromUserIdTrimmed && d.to_user_id?.trim() === toUserIdTrimmed);
        if (oppositeDebt) {
          if (oppositeDebt.amount > split.shareAmount) {
            await base44.entities.Debt.update(oppositeDebt.id, { amount: oppositeDebt.amount - split.shareAmount });
          } else if (oppositeDebt.amount < split.shareAmount) {
            await base44.entities.Debt.delete(oppositeDebt.id);
            await base44.entities.Debt.create({ from_user_id: fromUserIdTrimmed, from_user_name: split.userName, to_user_id: toUserIdTrimmed, to_user_name: data.splits.find(s => s.userId === data.paid_by_user_id)?.userName || data.paid_by_user_id, amount: split.shareAmount - oppositeDebt.amount });
          } else {
            await base44.entities.Debt.delete(oppositeDebt.id);
          }
        } else if (existingDebt) {
          await base44.entities.Debt.update(existingDebt.id, { amount: existingDebt.amount + split.shareAmount });
        } else {
          await base44.entities.Debt.create({ from_user_id: fromUserIdTrimmed, from_user_name: split.userName, to_user_id: toUserIdTrimmed, to_user_name: data.splits.find(s => s.userId === data.paid_by_user_id)?.userName || data.paid_by_user_id, amount: split.shareAmount });
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

  const userPicture = user?.data?.picture || user?.picture;

  // Dynamic page title from translations
  const pageTitleKeyMap = {
    Dashboard: 'dashboard', Expenses: 'expenses', RecurringExpenses: 'recurring_expenses',
    Budget: 'budget', Debts: 'debts', Statistics: 'statistics', Settings: 'settings',
    Goals: 'goals',
  };
  const pageTitle = t[pageTitleKeyMap[currentPageName]] || currentPageName;

  // Sidebar position depends on direction
  const sidebarPositionClass = dir === 'rtl'
    ? `lg:right-0 ${sidebarOpen ? 'lg:w-64' : 'lg:w-20'}`
    : `lg:left-0 ${sidebarOpen ? 'lg:w-64' : 'lg:w-20'}`;
  const sidebarBorderClass = dir === 'rtl' ? 'border-l' : 'border-r';
  const mainPaddingClass = dir === 'rtl'
    ? (sidebarOpen ? 'lg:pr-64' : 'lg:pr-20')
    : (sidebarOpen ? 'lg:pl-64' : 'lg:pl-20');

  return (
    <div className="min-h-screen bg-slate-50" dir={dir}>
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:fixed lg:inset-y-0 lg:flex lg:flex-col transition-all duration-300 ${sidebarPositionClass}`}>
        <div className={`flex flex-col flex-grow bg-white ${sidebarBorderClass} border-slate-100`}>
          {/* Logo */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex items-center gap-3 px-6 py-5 border-b border-slate-100 hover:bg-slate-50 transition-colors"
          >
            {sidebarOpen ? (
              <>
                {userPicture ? (
                  <img src={userPicture} alt="Profile" className="w-10 h-10 rounded-xl object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                    <Wallet className="h-5 w-5 text-white" />
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="text-base font-bold text-slate-900 truncate">{user?.full_name || 'BudgetMate'}</span>
                  {user?.email && <span className="text-xs text-slate-400 truncate mt-0.5">{user.email}</span>}
                </div>
              </>
            ) : (
              <Menu className="h-6 w-6 text-slate-900 mx-auto" />
            )}
          </button>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1">
            {navItems.map((item) => {
              const isActive = currentPageName === item.page;
              const showBadge = item.page === 'Expenses' && pendingCount > 0;
              return (
                <React.Fragment key={item.page}>
                  <Link
                    to={createPageUrl(item.page)}
                    title={!sidebarOpen ? t[item.key] : undefined}
                    className={`relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                        : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'
                    } ${!sidebarOpen ? 'justify-center' : ''}`}
                  >
                    <span className="relative">
                      <item.icon className="h-5 w-5" />
                      {showBadge && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                          {pendingCount > 99 ? '99+' : pendingCount}
                        </span>
                      )}
                    </span>
                    {sidebarOpen && t[item.key]}
                  </Link>
                </React.Fragment>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-slate-800 z-50">
        <div className="relative flex items-center justify-around h-16">
          {/* Left 2 items */}
          {mobileMainItems.slice(0, 2).map((item) => {
            const isActive = currentPageName === item.page;
            const showBadge = item.page === 'Expenses' && pendingCount > 0;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
                  isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="relative">
                  <item.icon className="h-5 w-5" />
                  {showBadge && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                      {pendingCount > 99 ? '99+' : pendingCount}
                    </span>
                  )}
                </span>
                <span className="text-[11px] font-medium">{t[item.key]}</span>
              </Link>
            );
          })}

          {/* Center spacer for raised button */}
          <div className="w-16" />

          {/* Right 2 items */}
          {mobileMainItems.slice(2).map((item) => {
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
                  isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[11px] font-medium">{t[item.key]}</span>
              </Link>
            );
          })}

          {/* Raised + button (absolute center) */}
          <button
            onClick={() => { setAddExpenseTab('expense'); setShowAddExpense(true); }}
            className="absolute left-1/2 -translate-x-1/2 -top-5 h-14 w-14 rounded-full bg-indigo-600 text-white shadow-lg flex items-center justify-center hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-7 w-7" />
          </button>
        </div>
      </nav>

      {/* Mobile Full Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Slide-up panel */}
          <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <span className="text-base font-bold text-slate-900">{t.navigation}</span>
              <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="py-2 pb-8">
              {navItems.map((item) => {
                const isActive = currentPageName === item.page;
                return (
                  <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-5 py-3.5 transition-colors ${
                      isActive ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    <span className="text-sm">{t[item.key]}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className={`pb-20 lg:pb-0 transition-all duration-300 ${mainPaddingClass}`}>
        {/* Sticky Page Header */}
        <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-slate-100 px-4 lg:px-8 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-900">{pageTitle}</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="focus:outline-none rounded-full">
                <Avatar className="h-9 w-9 cursor-pointer ring-2 ring-transparent hover:ring-indigo-300 transition-all">
                  <AvatarImage
                    src={user?.user_metadata?.avatar_url || user?.avatar_url || userPicture}
                    alt={user?.full_name || 'User'}
                  />
                  <AvatarFallback className="bg-indigo-600 text-white text-sm font-semibold">
                    {(user?.full_name || user?.email || 'U')
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {/* Add Expense shortcut */}
              <DropdownMenuItem
                className="gap-2 font-medium text-indigo-700 focus:text-indigo-700 focus:bg-indigo-50 cursor-pointer"
                onSelect={() => {
                  if (currentPageName === 'RecurringExpenses') setAddExpenseTab('recurring');
                  else if (currentPageName === 'Debts') setAddExpenseTab('shared');
                  else setAddExpenseTab('expense');
                  setShowAddExpense(true);
                }}
              >
                <Plus className="h-4 w-4" />
                {t.add_expense}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {/* Navigation links */}
              {navItems.map((item) => (
                <DropdownMenuItem key={item.page} asChild>
                  <Link
                    to={createPageUrl(item.page)}
                    className={`flex items-center gap-2 w-full cursor-pointer ${
                      currentPageName === item.page ? 'text-indigo-700 font-semibold' : ''
                    }`}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    {t[item.key]}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {children}
      </main>

      <Toaster position="top-center" richColors />

      {/* Global Add Expense Dialog */}
      <UnifiedExpenseDialog
        open={showAddExpense}
        onOpenChange={setShowAddExpense}
        categories={categories}
        onSubmitExpense={(data) => createExpenseMutation.mutate(data)}
        onSubmitRecurring={(data) => createRecurringMutation.mutate(data)}
        onSubmitShared={(data) => createSharedExpenseMutation.mutate(data)}
        isSubmittingExpense={createExpenseMutation.isPending}
        isSubmittingRecurring={createRecurringMutation.isPending}
        isSubmittingShared={createSharedExpenseMutation.isPending}
        defaultTab={addExpenseTab}
        user={user}
        isHouseholdMode={isHouseholdMode}
        householdId={settings?.current_household_id}
      />
    </div>
  );
}