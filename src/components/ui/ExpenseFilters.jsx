import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Search, CalendarIcon, ArrowUpDown, X, Calendar as CalendarMonth, Users } from "lucide-react";

export default function ExpenseFilters({ 
  filters, 
  onFilterChange, 
  categories,
  onClear,
  onCurrentMonth,
  sharedUsers = [],
  t = {},
  dir = 'rtl',
}) {
  const hasFilters = filters.search || filters.categoryName || filters.dateFrom || filters.dateTo || filters.sharedWithUser;
  const [showPicker, setShowPicker] = useState(false);
  const [pickerView, setPickerView] = useState('month');
  const [selectedMonth, setSelectedMonth] = useState(null);

  const months = [
    { value: 0,  label: t.month_jan || 'ינואר' },
    { value: 1,  label: t.month_feb || 'פברואר' },
    { value: 2,  label: t.month_mar || 'מרץ' },
    { value: 3,  label: t.month_apr || 'אפריל' },
    { value: 4,  label: t.month_may || 'מאי' },
    { value: 5,  label: t.month_jun || 'יוני' },
    { value: 6,  label: t.month_jul || 'יולי' },
    { value: 7,  label: t.month_aug || 'אוגוסט' },
    { value: 8,  label: t.month_sep || 'ספטמבר' },
    { value: 9,  label: t.month_oct || 'אוקטובר' },
    { value: 10, label: t.month_nov || 'נובמבר' },
    { value: 11, label: t.month_dec || 'דצמבר' },
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 20 }, (_, i) => currentYear - i);

  const handleMonthSelect = (month) => {
    setSelectedMonth(month);
    setPickerView('year');
  };

  const handleYearSelect = (year) => {
    if (selectedMonth !== null) {
      const date = new Date(year, selectedMonth, 1);
      onFilterChange({ 
        ...filters, 
        dateFrom: format(startOfMonth(date), 'yyyy-MM-dd'),
        dateTo: format(endOfMonth(date), 'yyyy-MM-dd')
      });
    }
    setShowPicker(false);
    setPickerView('month');
    setSelectedMonth(null);
  };

  const getSelectedMonthYear = () => {
    if (filters.dateFrom) {
      const date = new Date(filters.dateFrom);
      return `${months[date.getMonth()].label} ${date.getFullYear()}`;
    }
    return t.select_month || 'בחר חודש';
  };

  return (
    <div className="space-y-3" dir={dir}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400`} />
          <Input
            placeholder={t.search_expenses || 'חפש הוצאות...'}
            value={filters.search}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
            className={`${dir === 'rtl' ? 'pr-10' : 'pl-10'} h-11 bg-white`}
          />
        </div>
        
        <Select
          value={filters.categoryName}
          onValueChange={(v) => onFilterChange({ ...filters, categoryName: v })}
        >
          <SelectTrigger className="w-40 h-11 bg-white">
            <SelectValue placeholder={t.category || 'קטגוריה'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.all_categories || 'כל הקטגוריות'}</SelectItem>
            {categories.filter((c, i, arr) => arr.findIndex(x => x.name === c.name) === i).map((cat) => (
              <SelectItem key={cat.id} value={cat.name}>
                <span className="flex items-center gap-2">
                  <span 
                    className="w-2.5 h-2.5 rounded-full" 
                    style={{ backgroundColor: cat.color }}
                  />
                  {cat.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Popover open={showPicker} onOpenChange={(open) => {
          setShowPicker(open);
          if (!open) {
            setPickerView('month');
            setSelectedMonth(null);
          }
        }}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-10 bg-white min-w-[160px]">
              <CalendarIcon className="h-4 w-4 me-2" />
              {getSelectedMonthYear()}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3">
            {pickerView === 'month' ? (
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-700 mb-2">{t.select_month || 'בחר חודש'}</p>
                <div className="grid grid-cols-3 gap-2">
                  {months.map((month) => (
                    <Button
                      key={month.value}
                      variant="outline"
                      size="sm"
                      className="h-9 text-sm hover:bg-slate-100"
                      onClick={() => handleMonthSelect(month.value)}
                    >
                      {month.label}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-700 mb-2">{t.select_year || 'בחר שנה'}</p>
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {years.map((year) => (
                    <Button
                      key={year}
                      variant="outline"
                      size="sm"
                      className="w-full h-9 text-sm hover:bg-slate-100"
                      onClick={() => handleYearSelect(year)}
                    >
                      {year}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </PopoverContent>
        </Popover>

        <Button 
          variant="outline" 
          className="h-10 bg-white"
          onClick={onCurrentMonth}
        >
          <CalendarMonth className="h-4 w-4 me-2" />
          {t.current_month || 'חודש נוכחי'}
        </Button>

        <Select 
          value={filters.sortBy} 
          onValueChange={(v) => onFilterChange({ ...filters, sortBy: v })}
        >
          <SelectTrigger className="w-36 h-10 bg-white">
            <ArrowUpDown className="h-4 w-4 me-2" />
            <SelectValue placeholder={t.sort || 'מיון'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date_desc">{t.newest || 'החדשים ביותר'}</SelectItem>
            <SelectItem value="date_asc">{t.oldest || 'הישנים ביותר'}</SelectItem>
            <SelectItem value="amount_desc">{t.highest || 'הגבוה ביותר'}</SelectItem>
            <SelectItem value="amount_asc">{t.lowest || 'הנמוך ביותר'}</SelectItem>
          </SelectContent>
        </Select>

        {sharedUsers.length > 0 && (
          <Select
            value={filters.sharedWithUser || 'none'}
            onValueChange={(v) => onFilterChange({ ...filters, sharedWithUser: v === 'none' ? '' : v })}
          >
            <SelectTrigger className="h-10 bg-white min-w-[160px]">
              <Users className="h-4 w-4 me-2 text-slate-500 flex-shrink-0" />
              <SelectValue placeholder={t.shared_with || 'שותף עם'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t.all_expenses || 'כל ההוצאות'}</SelectItem>
              <SelectItem value="all_shared">{t.all_shared || 'כל המשותפות'}</SelectItem>
              {sharedUsers.map((u) => (
                <SelectItem key={u.email} value={u.email}>
                  {u.name || u.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {hasFilters && (
          <Button 
            variant="ghost" 
            className="h-10 text-slate-500"
            onClick={onClear}
          >
            <X className="h-4 w-4 me-1" />
            {t.clear || 'נקה'}
          </Button>
        )}
      </div>
    </div>
  );
}