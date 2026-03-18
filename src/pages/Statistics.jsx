import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, startOfMonth, endOfMonth, subMonths, parseISO, eachMonthOfInterval } from 'date-fns';
import { Calendar, TrendingUp, TrendingDown, DollarSign, BarChart3, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import CategoryPieChart from '@/components/stats/CategoryPieChart';
import MonthlyBarChart from '@/components/stats/MonthlyBarChart';
import StatCard from '@/components/stats/StatCard';
import CategoryBreakdown from '@/components/stats/CategoryBreakdown';

import { useLanguage } from '@/components/i18n/LanguageContext';
import { useCurrency } from '@/lib/CurrencyContext';

export default function Statistics() {
  const { t, dir } = useLanguage();
  const { currencySymbol } = useCurrency();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [monthsRange, setMonthsRange] = useState('12');

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

  // Fetch recurring expenses
  const { data: recurringExpenses = [] } = useQuery({
    queryKey: ['recurringExpenses', user?.email, settings?.current_household_id, isHouseholdMode],
    queryFn: async () => {
      if (!user?.email) return [];
      if (isHouseholdMode) {
        return base44.entities.RecurringExpense.filter({ household_id: settings.current_household_id });
      } else {
        return base44.entities.RecurringExpense.filter({ user_email: user.email, household_id: null });
      }
    },
    enabled: !!user?.email,
  });

  // Generate month options
  const monthOptions = useMemo(() => {
    const options = [];
    for (let i = 0; i < 12; i++) {
      const date = subMonths(new Date(), i);
      options.push({
        value: format(date, 'yyyy-MM'),
        label: format(date, 'MMMM yyyy'),
      });
    }
    return options;
  }, []);

  // Calculate selected month data
  const selectedMonthData = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const monthStart = startOfMonth(new Date(year, month - 1));
    const monthEnd = endOfMonth(new Date(year, month - 1));

    const monthExpenses = expenses.filter(e => {
      const date = parseISO(e.date);
      return date >= monthStart && date <= monthEnd && !e.is_pending;
    });

    // Add active recurring expenses for this month
    const activeRecurring = recurringExpenses.filter(rec => {
      if (!rec.is_active) return false;
      const startDate = parseISO(rec.start_date);
      const endDate = rec.end_date ? parseISO(rec.end_date) : null;
      if (startDate > monthEnd) return false;
      if (endDate && endDate < monthStart) return false;
      return true;
    });

    const regularTotal = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
    const recurringTotal = activeRecurring.reduce((sum, e) => sum + e.amount, 0);
    const total = regularTotal + recurringTotal;

    // By category
    const byCategory = {};
    monthExpenses.forEach(e => {
      const cat = categories.find(c => c.id === e.category_id);
      const name = cat?.name || 'Other';
      const color = cat?.color || '#64748b';
      if (!byCategory[name]) {
        byCategory[name] = { name, color, value: 0 };
      }
      byCategory[name].value += e.amount;
    });

    // Add recurring expenses to categories
    activeRecurring.forEach(e => {
      const cat = categories.find(c => c.id === e.category_id);
      const name = cat?.name || 'Other';
      const color = cat?.color || '#64748b';
      if (!byCategory[name]) {
        byCategory[name] = { name, color, value: 0 };
      }
      byCategory[name].value += e.amount;
    });

    const categoryData = Object.values(byCategory).sort((a, b) => b.value - a.value);

    // Separate recurring expenses info for display
    const recurringInfo = recurringTotal > 0 ? {
      total: recurringTotal,
      count: activeRecurring.length
    } : null;

    return {
      total,
      transactionCount: monthExpenses.length,
      categoryData,
      recurringInfo,
    };
  }, [expenses, categories, selectedMonth, recurringExpenses]);

  // Calculate monthly totals for bar chart
  const monthlyData = useMemo(() => {
    const months = parseInt(monthsRange);
    const now = new Date();
    const startDate = startOfMonth(subMonths(now, months - 1));
    const endDate = endOfMonth(now);

    const allMonths = eachMonthOfInterval({ start: startDate, end: endDate });

    return allMonths.map(monthDate => {
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      const regularTotal = expenses
        .filter(e => {
          const date = parseISO(e.date);
          return date >= monthStart && date <= monthEnd && !e.is_pending;
        })
        .reduce((sum, e) => sum + e.amount, 0);

      // Add recurring expenses for this month
      const recurringTotal = recurringExpenses
        .filter(rec => {
          if (!rec.is_active) return false;
          const startDate = parseISO(rec.start_date);
          const endDate = rec.end_date ? parseISO(rec.end_date) : null;
          if (startDate > monthEnd) return false;
          if (endDate && endDate < monthStart) return false;
          return true;
        })
        .reduce((sum, e) => sum + e.amount, 0);

      return {
        month: format(monthDate, 'MMM'),
        fullMonth: format(monthDate, 'MMMM yyyy'),
        total: regularTotal + recurringTotal,
      };
    });
  }, [expenses, monthsRange, recurringExpenses]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    // Calculate current month total
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const regularCurrentMonthTotal = expenses
      .filter(e => {
        const date = parseISO(e.date);
        return date >= currentMonthStart && date <= currentMonthEnd && !e.is_pending;
      })
      .reduce((sum, e) => sum + e.amount, 0);

    // Add recurring expenses for current month
    const recurringCurrentMonthTotal = recurringExpenses
      .filter(rec => {
        if (!rec.is_active) return false;
        const startDate = parseISO(rec.start_date);
        const endDate = rec.end_date ? parseISO(rec.end_date) : null;
        if (startDate > currentMonthEnd) return false;
        if (endDate && endDate < currentMonthStart) return false;
        return true;
      })
      .reduce((sum, e) => sum + e.amount, 0);

    const currentMonthTotal = regularCurrentMonthTotal + recurringCurrentMonthTotal;

    // Calculate average monthly from user creation to now (including partial months)
    const userCreatedDate = user?.created_date ? parseISO(user.created_date) : null;
    let avgMonthly = 0;
    if (userCreatedDate) {
      const allExpensesSinceJoin = expenses.filter(e => parseISO(e.date) >= userCreatedDate && !e.is_pending);
      const totalSpendingSinceJoin = allExpensesSinceJoin.reduce((sum, e) => sum + e.amount, 0);
      
      // Calculate months between join date and now (including partial months)
      const monthsSinceJoin = Math.max(1, 
        (now.getFullYear() - userCreatedDate.getFullYear()) * 12 + 
        (now.getMonth() - userCreatedDate.getMonth()) + 1
      );
      
      avgMonthly = totalSpendingSinceJoin / monthsSinceJoin;
    } else {
      // Fallback if no user creation date
      const monthlyTotals = monthlyData.map(m => m.total);
      const totalSpending = monthlyTotals.reduce((sum, t) => sum + t, 0);
      avgMonthly = monthlyTotals.length > 0 ? totalSpending / monthlyTotals.length : 0;
    }
    
    let highestMonth = { month: '-', total: 0 };
    monthlyData.forEach(m => {
      if (m.total > highestMonth.total) {
        highestMonth = m;
      }
    });

    // Compare current month to previous month (normalized by day of month)
    const today = now.getDate();
    
    // Calculate current month expenses up to today
    const currentMonthExpensesUpToToday = expenses
      .filter(e => {
        const date = parseISO(e.date);
        return date >= currentMonthStart && date <= now && !e.is_pending;
      })
      .reduce((sum, e) => sum + e.amount, 0);
    
    // Calculate previous month expenses up to same day
    const prevMonth = subMonths(now, 1);
    const prevMonthStart = startOfMonth(prevMonth);
    const prevMonthSameDay = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), today);
    
    const prevMonthExpensesUpToSameDay = expenses
      .filter(e => {
        const date = parseISO(e.date);
        return date >= prevMonthStart && date <= prevMonthSameDay && !e.is_pending;
      })
      .reduce((sum, e) => sum + e.amount, 0);
    
    const trend = prevMonthExpensesUpToSameDay > 0 
      ? ((currentMonthExpensesUpToToday - prevMonthExpensesUpToSameDay) / prevMonthExpensesUpToSameDay) * 100 
      : 0;

    return {
      totalSpending: currentMonthTotal,
      avgMonthly,
      highestMonth,
      trend,
    };
  }, [monthlyData, expenses, user, recurringExpenses]);

  const statAccents = {
    totalExpenses: {
      border: 'border-indigo-500',
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      valueColor: 'text-indigo-700',
    },
    monthlyAvg: {
      border: 'border-violet-500',
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
      valueColor: 'text-violet-700',
    },
    highestMonth: {
      border: 'border-amber-500',
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      valueColor: 'text-amber-700',
    },
    trend: {
      border: summaryStats.trend > 5 ? 'border-red-500' : summaryStats.trend < -5 ? 'border-green-500' : 'border-slate-300',
      iconBg: summaryStats.trend > 5 ? 'bg-red-50' : summaryStats.trend < -5 ? 'bg-green-50' : 'bg-slate-50',
      iconColor: summaryStats.trend > 5 ? 'text-red-600' : summaryStats.trend < -5 ? 'text-green-600' : 'text-slate-500',
      valueColor: summaryStats.trend > 5 ? 'text-red-600' : summaryStats.trend < -5 ? 'text-green-600' : 'text-slate-700',
    },
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50" dir={dir}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">{t.statistics}</h1>
          <p className="text-slate-500 mt-1">{t.statistics_subtitle}</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title={t.total_expenses}
            value={`${currencySymbol}${summaryStats.totalSpending.toFixed(2)}`}
            subtitle={t.incl_recurring}
            icon={DollarSign}
            accentColor={statAccents.totalExpenses}
          />
          <StatCard
            title={t.monthly_average}
            value={`${currencySymbol}${summaryStats.avgMonthly.toFixed(2)}`}
            subtitle={t.per_month_no_recurring}
            icon={BarChart3}
            accentColor={statAccents.monthlyAvg}
          />
          <StatCard
            title={t.highest_month}
            value={`${currencySymbol}${summaryStats.highestMonth.total.toFixed(2)}`}
            subtitle={summaryStats.highestMonth.fullMonth}
            icon={TrendingUp}
            accentColor={statAccents.highestMonth}
          />
          <StatCard
            title={t.vs_prev_month}
            value={`${summaryStats.trend >= 0 ? '+' : ''}${summaryStats.trend.toFixed(1)}%`}
            trend={summaryStats.trend > 5 ? 'up' : summaryStats.trend < -5 ? 'down' : 'neutral'}
            icon={summaryStats.trend >= 0 ? TrendingUp : TrendingDown}
            accentColor={statAccents.trend}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Monthly Trend */}
          <Card className="shadow-sm border border-slate-200/70">
            <CardHeader className="pb-2 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 rounded-full bg-indigo-500" />
                  <CardTitle className="text-lg">{t.monthly_expenses}</CardTitle>
                </div>
                <Select value={monthsRange} onValueChange={setMonthsRange}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6">{t.months_6}</SelectItem>
                    <SelectItem value="12">{t.months_12}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <MonthlyBarChart data={monthlyData} />
            </CardContent>
          </Card>

          {/* Category Breakdown for Selected Month */}
          <Card className="shadow-sm border border-slate-200/70">
            <CardHeader className="pb-2 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 rounded-full bg-violet-500" />
                  <CardTitle className="text-lg">{t.category_breakdown_title}</CardTitle>
                </div>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-40">
                    <Calendar className="h-4 w-4 ml-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <CategoryPieChart data={selectedMonthData.categoryData} selectedMonth={selectedMonth} />
            </CardContent>
          </Card>
        </div>

        {/* Detailed Category Breakdown */}
        <Card className="shadow-sm border border-slate-200/70">
          <CardHeader className="pb-2 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <div className="w-1 h-5 rounded-full bg-amber-500" />
                  <CardTitle className="text-lg">{t.expenses_by_category_title}</CardTitle>
                </div>
                <p className="text-sm text-slate-500 mt-1 ml-3">
                  {monthOptions.find(m => m.value === selectedMonth)?.label}
                  {' · '}
                  <span className="font-semibold text-slate-700">
                    {currencySymbol}{selectedMonthData.total.toFixed(2)}
                  </span>
                  {' '}{t.total_label}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <CategoryBreakdown
              data={selectedMonthData.categoryData}
              total={selectedMonthData.total}
              selectedMonth={selectedMonth}
            />

            {/* Recurring Expenses Info */}
            {selectedMonthData.recurringInfo && (
              <div className="mt-6 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full mt-1.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-indigo-900">{t.recurring_expenses_info}</span>
                      <span className="text-lg font-bold text-indigo-700">
                        {currencySymbol}{selectedMonthData.recurringInfo.total.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-indigo-600">
                      {selectedMonthData.recurringInfo.count} {t.recurring_expenses_info} ·
                      {((selectedMonthData.recurringInfo.total / selectedMonthData.total) * 100).toFixed(1)}% {t.of_total_expenses} ·
                      {t.included_in_categories}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}