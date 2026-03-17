import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, TrendingUp, TrendingDown, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { useLanguage } from '@/components/i18n/LanguageContext';
import { useCurrency } from '@/lib/CurrencyContext';

export default function Debts() {
  const { t, dir } = useLanguage();
  const { currencySymbol } = useCurrency();
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

  const { data: debts = [], isLoading } = useQuery({
     queryKey: ['debts', user?.email],
     queryFn: async () => {
       if (!user?.email) return [];
       return base44.entities.Debt.list();
     },
     enabled: !!user?.email,
   });

  const userEmailTrimmed = user?.email?.trim();
  const debtsOwedToMe = debts.filter(d => d.to_user_id?.trim() === userEmailTrimmed);
  const debtsIOwe = debts.filter(d => d.from_user_id?.trim() === userEmailTrimmed);



  const totalOwedToMe = debtsOwedToMe.reduce((sum, d) => sum + d.amount, 0);
  const totalIOwe = debtsIOwe.reduce((sum, d) => sum + d.amount, 0);
  const netBalance = totalOwedToMe - totalIOwe;

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
                    key={debt.id}
                    className="flex items-center justify-between p-4 bg-green-50 border border-green-100 rounded-xl"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">
                        {debt.from_user_name || debt.from_user_id}
                      </div>
                      <div className="text-sm text-slate-500">{t.owes_you}</div>
                    </div>
                    <div className="text-xl font-bold text-green-600">
                      {currencySymbol}{debt.amount.toFixed(2)}
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
                    key={debt.id}
                    className="flex items-center justify-between p-4 bg-red-50 border border-red-100 rounded-xl"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">
                        {debt.to_user_name || debt.to_user_id}
                      </div>
                      <div className="text-sm text-slate-500">{t.you_owe}</div>
                    </div>
                    <div className="text-xl font-bold text-red-600">
                      {currencySymbol}{debt.amount.toFixed(2)}
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
    </div>
  );
}