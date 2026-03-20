import React from 'react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Pencil, Trash2, CreditCard, Banknote, Building2, ArrowRightLeft, Users, Clock, Send, ChevronDown, ChevronRight, Tag, CalendarDays, FileText, Wallet, CheckCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useLanguage } from '@/components/i18n/LanguageContext';
import { useCurrency, CURRENCY_SYMBOLS } from '@/lib/CurrencyContext';

const paymentIcons = {
  cash: Banknote,
  credit_card: CreditCard,
  debit_card: CreditCard,
  bank_transfer: Building2,
  other: ArrowRightLeft,
};

const paymentMethodLabels = {
  cash: 'Cash',
  credit_card: 'Credit Card',
  debit_card: 'Debit Card',
  bank_transfer: 'Bank Transfer',
  other: 'Other',
};

export default function ExpenseCard({ expense, categoryColor, onEdit, onDelete, onApprovePending, currentUserEmail, sharedExpensePendingUsers, isExpanded, onToggleExpand }) {
  const { t } = useLanguage();
  const { currencySymbol } = useCurrency();
  const PaymentIcon = paymentIcons[expense.payment_method] || null;

  const isCreator = expense.is_shared && expense.created_by === currentUserEmail;
  // Needs my approval: pending AND I haven't approved yet (approval_status !== 'approved')
  const isPendingAwaitingMyApproval = expense.is_pending && expense.is_shared && expense.approval_status !== 'approved' && !isCreator && onApprovePending;
  // I already approved but waiting for others
  const isWaitingForOthers = expense.is_pending && expense.is_shared && (expense.approval_status === 'approved' || isCreator);
  const isPendingAsCreator = expense.is_pending && expense.is_shared && isCreator;

  // The main label: description (or notes) first, fallback to category name
  const mainLabel = expense.description || expense.notes || expense.category_name;

  const handleCardClick = () => {
    if (isPendingAwaitingMyApproval || isWaitingForOthers) {
      onApprovePending && onApprovePending(expense);
      return;
    }
    onToggleExpand && onToggleExpand(expense.id);
  };

  return (
    <div className="rounded-lg overflow-hidden">
      {/* Row */}
      <div
        className={`group flex items-center px-3 py-2 bg-white border transition-all duration-200 cursor-pointer ${
          expense.is_settled
            ? 'opacity-60 border-green-200 bg-green-50/30 rounded-lg'
            : isExpanded
            ? 'border-b-0 rounded-t-lg border-slate-200 shadow-sm'
            : isPendingAwaitingMyApproval
            ? 'border-amber-200 bg-amber-50 rounded-lg hover:border-amber-300 hover:shadow-sm'
            : isWaitingForOthers
            ? 'border-blue-100 bg-blue-50/40 rounded-lg hover:border-blue-200 hover:shadow-sm'
            : 'border-slate-100 rounded-lg hover:border-slate-200 hover:shadow-sm'
        }`}
        onClick={handleCardClick}
      >
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${categoryColor}20` }}
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: categoryColor }}
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-slate-900 whitespace-nowrap">
              {currencySymbol}{expense.amount.toFixed(2)}
            </span>
            {expense.original_currency && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-slate-400 text-xs whitespace-nowrap">
                  {`${CURRENCY_SYMBOLS[expense.original_currency] || ''}${expense.original_amount?.toFixed(2) ?? ''} ${expense.original_currency}`}
                </span>
              </>
            )}
            {expense.is_shared && (
              <>
                <span className="text-slate-300">|</span>
                {expense.is_settled ? (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap border bg-green-50 border-green-200 text-green-700">
                    <CheckCircle className="h-3 w-3" />
                  </div>
                ) : isPendingAwaitingMyApproval ? (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap border bg-amber-50 border-amber-200 text-amber-700">
                    <Clock className="h-3 w-3" />
                  </div>
                ) : isWaitingForOthers ? (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap border bg-blue-50 border-blue-200 text-blue-600">
                    <Send className="h-3 w-3" />
                  </div>
                ) : (
                  <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap border ${
                    expense.paid_by_user_id === currentUserEmail
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : 'bg-red-50 border-red-200 text-red-600'
                  }`}>
                    <Users className="h-3 w-3" />
                  </div>
                )}
              </>
            )}
            <span className="text-slate-300">|</span>
            <span className="text-slate-600 whitespace-nowrap">{mainLabel}</span>
          </div>
        </div>

        <div className="flex-1 min-w-0 overflow-hidden flex items-center justify-start px-2">
          <span className="text-xs text-slate-400 whitespace-nowrap">
            {format(new Date(expense.date), 'd MMM', { locale: he })}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400 hover:text-slate-600"
              onClick={(ev) => { ev.stopPropagation(); onEdit(expense); }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400 hover:text-red-500"
              onClick={(ev) => { ev.stopPropagation(); onDelete(expense); }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </div>

      {/* Expanded detail panel */}
      {isExpanded && (
        <div className="bg-slate-50 border border-t-0 border-slate-200 rounded-b-lg px-4 py-3">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
            {/* Category */}
            <div className="flex items-center gap-2">
              <Tag className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
              <span className="text-slate-500">{t.category || 'Category'}:</span>
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: categoryColor }} />
                <span className="font-medium text-slate-700 truncate">{expense.category_name}</span>
              </div>
            </div>

            {/* Amount */}
            <div className="flex items-center gap-2">
              <Wallet className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
              <span className="text-slate-500">{t.amount || 'Amount'}:</span>
              <span className="font-semibold text-slate-800">{currencySymbol}{expense.amount.toFixed(2)}</span>
            </div>

            {/* Original currency */}
            {expense.original_currency && (
              <div className="flex items-center gap-2 col-span-2">
                <ArrowRightLeft className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                <span className="text-slate-500">{t.original_amount_label || 'Original'}:</span>
                <span className="font-medium text-slate-700">
                  {`${CURRENCY_SYMBOLS[expense.original_currency] || ''}${expense.original_amount?.toFixed(2) ?? ''} ${expense.original_currency}`}
                  {expense.exchange_rate && (
                    <span className="text-slate-400 ml-1">· {t.exchange_rate_label || 'rate:'} {expense.exchange_rate.toFixed(4)}</span>
                  )}
                </span>
              </div>
            )}

            {/* Description / Notes */}
            {(expense.description || expense.notes) ? (
              <div className="flex items-start gap-2">
                <FileText className="h-3.5 w-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                <span className="text-slate-500 flex-shrink-0">{t.notes || 'הערה'}:</span>
                <span className="text-slate-600 break-words">{expense.description || expense.notes}</span>
              </div>
            ) : <div />}

            {/* Date */}
            <div className="flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
              <span className="text-slate-500">{t.date || 'תאריך'}:</span>
              <span className="font-medium text-slate-700">{format(new Date(expense.date), 'd MMMM yyyy', { locale: he })}</span>
            </div>

            {/* Payment method */}
            {expense.payment_method && (
              <div className="flex items-center gap-2">
                {PaymentIcon ? (
                  <PaymentIcon className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                ) : (
                  <CreditCard className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                )}
                <span className="text-slate-500">{t.payment_method || 'Payment'}:</span>
                <span className="font-medium text-slate-700">{paymentMethodLabels[expense.payment_method] || expense.payment_method}</span>
              </div>
            )}

            {/* Merchant */}
            {expense.merchant && (
              <div className="flex items-center gap-2 col-span-2">
                <Building2 className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                <span className="text-slate-500">{t.merchant || 'Merchant'}:</span>
                <span className="font-medium text-slate-700 truncate">{expense.merchant}</span>
              </div>
            )}

            {/* Shared info */}
            {expense.is_shared && (
              <div className="flex items-center gap-2 col-span-2">
                <Users className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                <span className="text-slate-500">{t.shared || 'Shared'}:</span>
                {expense.paid_by_user_id && expense.paid_by_user_id !== currentUserEmail && (
                  <span className="text-slate-600">{t.paid_by || 'Paid by'} {expense.paid_by_user_id}</span>
                )}
                {(!expense.paid_by_user_id || expense.paid_by_user_id === currentUserEmail) && (
                  <span className="text-slate-600">{t.paid_by_you || 'Paid by you'}</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}