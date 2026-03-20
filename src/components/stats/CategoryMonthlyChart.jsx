import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useCurrency } from '@/lib/CurrencyContext';

export default function CategoryMonthlyChart({ data, categoryName }) {
  const { currencySymbol } = useCurrency();

  if (!data || data.length === 0) {
    return null;
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white px-4 py-3 rounded-xl shadow-lg border border-slate-100">
          <div className="font-medium text-slate-900 mb-1">{label}</div>
          <div className="text-lg font-semibold text-gray-900">
            {currencySymbol}{payload[0].value.toFixed(2)}
          </div>
        </div>
      );
    }
    return null;
  };

  const maxAmount = Math.max(...data.map(d => d.amount), 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4">
      {categoryName && (
        <p className="text-sm font-semibold text-slate-700 mb-4">
          {categoryName} — monthly trend
        </p>
      )}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="catBarGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.8} />
              </linearGradient>
              <linearGradient id="catBarGradientHigh" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4f46e5" stopOpacity={1} />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.9} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 11 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 11 }}
              tickFormatter={(v) => `${currencySymbol}${v}`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9', radius: 4 }} />
            <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.amount === maxAmount ? 'url(#catBarGradientHigh)' : 'url(#catBarGradient)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
