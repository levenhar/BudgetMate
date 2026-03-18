import React from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useCurrency } from '@/lib/CurrencyContext';
import { useLanguage } from '@/components/i18n/LanguageContext';

export default function CategoryBreakdown({ data, total, selectedMonth }) {
  const navigate = useNavigate();
  const { currencySymbol } = useCurrency();
  const { t } = useLanguage();
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        {t.no_expenses_for_period}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((item, index) => {
        const percentage = total > 0 ? (item.value / total) * 100 : 0;
        return (
          <div 
            key={index} 
            className="group cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors"
            onClick={() => {
              const params = new URLSearchParams();
              params.set('category', item.name);
              if (selectedMonth) {
                const [year, month] = selectedMonth.split('-');
                const date = new Date(parseInt(year), parseInt(month) - 1, 1);
                const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
                const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
                params.set('dateFrom', monthStart.toISOString().split('T')[0]);
                params.set('dateTo', monthEnd.toISOString().split('T')[0]);
              }
              navigate(`${createPageUrl('Expenses')}?${params.toString()}`);
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm font-medium text-slate-700">{item.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">{percentage.toFixed(1)}%</span>
                <span className="text-sm font-semibold text-slate-900 w-20 text-end">
                  {currencySymbol}{item.value.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{ 
                  width: `${percentage}%`,
                  backgroundColor: item.color 
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}