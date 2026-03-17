import React from 'react';
import { format } from 'date-fns';
import { Pencil, Trash2, CreditCard, Banknote, Building2, ArrowRightLeft, Users, Clock, Send } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useLanguage } from '@/components/i18n/LanguageContext';
import { useCurrency } from '@/lib/CurrencyContext';

const paymentIcons = {
  cash: Banknote,
  credit_card: CreditCard,
  debit_card: CreditCard,
  bank_transfer: Building2,
  other: ArrowRightLeft,
};

export default function ExpenseCard({ expense, categoryColor, onEdit, onDelete, onApprovePending, currentUserEmail, sharedExpensePendingUsers }) {
  const { t } = useLanguage();
  const { currencySymbol } = useCurrency();
  const PaymentIcon = paymentIcons[expense.payment_method] || null;
  
  const isCreator = expense.is_shared && expense.created_by === currentUserEmail;
  // Needs my approval: pending AND I haven't approved yet (approval_status !== 'approved')
  const isPendingAwaitingMyApproval = expense.is_pending && expense.is_shared && expense.approval_status !== 'approved' && !isCreator && onApprovePending;
  // I already approved but waiting for others
  const isWaitingForOthers = expense.is_pending && expense.is_shared && (expense.approval_status === 'approved' || isCreator);
  const isPendingAsCreator = expense.is_pending && expense.is_shared && isCreator;

  const handleCardClick = () => {
    if (isPendingAwaitingMyApproval || isWaitingForOthers) {
      onApprovePending && onApprovePending(expense);
    }
  };

  return (
    <div 
      className={`group flex items-center justify-between px-3 py-2 bg-white rounded-lg border transition-all duration-200 ${
        isPendingAwaitingMyApproval
          ? 'border-amber-200 bg-amber-50 cursor-pointer hover:border-amber-300 hover:shadow-sm' 
          : isWaitingForOthers
          ? 'border-blue-100 bg-blue-50/40 cursor-pointer hover:border-blue-200 hover:shadow-sm'
          : 'border-slate-100 hover:border-slate-200 hover:shadow-sm'
      }`}
      onClick={handleCardClick}
    >
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <div 
          className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${categoryColor}20` }}
        >
          <div 
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: categoryColor }}
          />
        </div>
        <div className="flex items-center gap-1.5 text-xs flex-1 min-w-0">
          <span className="font-semibold text-slate-900 whitespace-nowrap">
            {currencySymbol}{expense.amount.toFixed(2)}
          </span>
          {expense.is_shared && (
            <>
              <span className="text-slate-300">|</span>
              {isPendingAwaitingMyApproval ? (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap border bg-amber-50 border-amber-200 text-amber-700">
                  <Clock className="h-3 w-3" />
                  <span>{t.awaiting_your_approval}</span>
                </div>
              ) : isWaitingForOthers ? (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap border bg-blue-50 border-blue-200 text-blue-600">
                  <Send className="h-3 w-3" />
                  <span>{t.awaiting_approvals}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap border bg-blue-50 border-blue-200 text-blue-700">
                  <Users className="h-3 w-3" />
                  <span>{t.shared}</span>
                </div>
              )}
            </>
          )}
          <span className="text-slate-300">|</span>
          <span className="text-slate-600 truncate">{expense.category_name}</span>
          {expense.merchant && (
            <>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500 truncate">{expense.merchant}</span>
            </>
          )}
          {expense.description && (
            <>
              <span className="text-slate-300">|</span>
              <span className="text-slate-400 truncate">{expense.description}</span>
            </>
          )}
          {PaymentIcon && (
            <>
              <span className="text-slate-300">|</span>
              <PaymentIcon className="h-3 w-3 text-slate-400 flex-shrink-0" />
            </>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-slate-400 whitespace-nowrap">
          {format(new Date(expense.date), 'MMM d')}
        </span>
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
      </div>
    </div>
  );
}