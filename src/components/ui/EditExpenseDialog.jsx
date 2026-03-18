import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, parseISO } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { useLanguage } from '@/components/i18n/LanguageContext';

export default function EditExpenseDialog({ 
  expense, 
  categories, 
  open, 
  onOpenChange, 
  onSave,
  isLoading,
  isShared = false
}) {
  const { t, dir } = useLanguage();

  const [formData, setFormData] = useState({
    amount: '',
    date: new Date(),
    category_id: '',
    description: '',
    merchant: '',
    payment_method: '',
  });

  useEffect(() => {
    if (expense) {
      setFormData({
        amount: expense.amount?.toString() || '',
        date: expense.date ? parseISO(expense.date) : new Date(),
        category_id: expense.category_id || '',
        description: expense.description || '',
        merchant: expense.merchant || '',
        payment_method: expense.payment_method || '',
      });
    }
  }, [expense]);

  const handleSave = async () => {
    const category = categories.find(c => c.id === formData.category_id);
    await onSave({
      ...expense,
      amount: parseFloat(formData.amount),
      date: format(formData.date, 'yyyy-MM-dd'),
      category_id: formData.category_id,
      category_name: category?.name || '',
      description: formData.description || undefined,
      merchant: formData.merchant || undefined,
      payment_method: formData.payment_method || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir={dir}>
        <DialogHeader>
          <DialogTitle>
            {expense?.is_shared ? t.edit_shared_expense || 'ערוך הוצאה משותפת' : t.edit_expense || 'ערוך הוצאה'}
          </DialogTitle>
          {expense?.is_shared && (
            <p className="text-sm text-slate-500 mt-1">
              {t.edit_shared_expense_note || 'שינויים ישפיעו על כל המשתתפים'}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-4" dir={dir}>
          <div className="space-y-2">
            <Label>{t.amount}</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="text-lg font-semibold"
            />
          </div>

          <div className="space-y-2">
            <Label>{t.category}</Label>
            <Select
              value={formData.category_id}
              onValueChange={(v) => setFormData({ ...formData, category_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t.category_placeholder} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <span className="flex items-center gap-2">
                      <span 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: cat.color }}
                      />
                      {cat.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t.date_label}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <CalendarIcon className="h-4 w-4 ml-2" />
                  {format(formData.date, 'PPP')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.date}
                  onSelect={(d) => d && setFormData({ ...formData, date: d })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>{t.description_label}</Label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t.description_optional || 'אופציונלי'}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t.merchant_placeholder}</Label>
              <Input
                value={formData.merchant}
                onChange={(e) => setFormData({ ...formData, merchant: e.target.value })}
                placeholder={t.description_optional || 'אופציונלי'}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.payment_method_placeholder}</Label>
              <Select
                value={formData.payment_method}
                onValueChange={(v) => setFormData({ ...formData, payment_method: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t.payment_method_placeholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{t.payment_cash}</SelectItem>
                  <SelectItem value="credit_card">{t.payment_credit_card}</SelectItem>
                  <SelectItem value="debit_card">{t.payment_debit_card}</SelectItem>
                  <SelectItem value="bank_transfer">{t.payment_bank_transfer}</SelectItem>
                  <SelectItem value="other">{t.payment_other}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.cancel}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!formData.amount || !formData.category_id || isLoading}
            className="bg-slate-900 hover:bg-slate-800"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}