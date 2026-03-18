import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function StatCard({ title, value, subtitle, icon: Icon, trend, accentColor }) {
  const trendColor =
    trend === 'up' ? 'text-red-500' : trend === 'down' ? 'text-green-500' : 'text-slate-400';
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  // accentColor drives the left border and icon background
  const borderClass = accentColor ? `border-l-4 ${accentColor.border}` : 'border-0';
  const iconBgClass = accentColor ? accentColor.iconBg : 'bg-slate-50';
  const iconColorClass = accentColor ? accentColor.iconColor : 'text-slate-500';
  const valueColorClass =
    trend === 'up'
      ? 'text-red-600'
      : trend === 'down'
      ? 'text-green-600'
      : accentColor?.valueColor || 'text-slate-900';

  return (
    <Card className={`shadow-sm ${borderClass}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-sm text-slate-500">{title}</p>
          {Icon && (
            <div className={`w-8 h-8 rounded-lg ${iconBgClass} flex items-center justify-center shrink-0`}>
              <Icon className={`h-4 w-4 ${iconColorClass}`} />
            </div>
          )}
        </div>
        <p className={`text-2xl font-bold mb-1 ${valueColorClass}`}>{value}</p>
        <div className="flex items-center gap-1">
          {trend && <TrendIcon className={`h-3.5 w-3.5 ${trendColor}`} />}
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
