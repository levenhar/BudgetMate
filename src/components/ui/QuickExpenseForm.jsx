import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function QuickExpenseForm({ categories, onSubmit, isSubmitting }) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date());
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [merchant, setMerchant] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [installments, setInstallments] = useState(1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || !categoryId) return;

    const category = categories.find(c => c.id === categoryId);
    await onSubmit({
      amount: parseFloat(amount),
      date: format(date, 'yyyy-MM-dd'),
      category_id: categoryId,
      category_name: category?.name || '',
      description: description || undefined,
      merchant: merchant || undefined,
      payment_method: paymentMethod || undefined,
      installments: installments,
    });

    // Reset form
    setAmount('');
    setCategoryId('');
    setDescription('');
    setMerchant('');
    setPaymentMethod('');
    setInstallments(1);
    setShowMore(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-3">
        <div className="flex-1">
          <Input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="text-2xl font-semibold h-14 text-center"
            required
            dir="ltr"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <Select value={categoryId} onValueChange={setCategoryId} required>
          <SelectTrigger className="flex-1 h-12">
            <SelectValue placeholder="קטגוריה" />
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

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-12 px-4">
              <CalendarIcon className="h-4 w-4 ml-2" />
              {format(date, 'MMM d')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => d && setDate(d)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <button
        type="button"
        onClick={() => setShowMore(!showMore)}
        className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
      >
        {showMore ? 'פחות אפשרויות' : 'עוד אפשרויות'}
      </button>

      {showMore && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <Input
            placeholder="תיאור (אופציונלי)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-11"
          />
          <div className="flex gap-3">
            <Input
              placeholder="עסק"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              className="flex-1 h-11"
            />
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="flex-1 h-11">
                <SelectValue placeholder="תשלום" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">מזומן</SelectItem>
                <SelectItem value="credit_card">כרטיס אשראי</SelectItem>
                <SelectItem value="debit_card">כרטיס חיוב</SelectItem>
                <SelectItem value="bank_transfer">העברה בנקאית</SelectItem>
                <SelectItem value="other">אחר</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Input
              type="number"
              min="1"
              max="36"
              placeholder="מספר תשלומים"
              value={installments}
              onChange={(e) => setInstallments(parseInt(e.target.value) || 1)}
              className="h-11"
            />
            {installments > 1 && amount && (
              <p className="text-xs text-slate-500">
                {installments} תשלומים של ₪{(parseFloat(amount) / installments).toFixed(2)} כל אחד
              </p>
            )}
          </div>
        </div>
      )}

      <Button 
        type="submit" 
        className="w-full h-12 text-base font-medium bg-slate-900 hover:bg-slate-800"
        disabled={!amount || !categoryId || isSubmitting}
      >
        {isSubmitting ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            <Plus className="h-5 w-5 ml-2" />
            הוסף הוצאה
          </>
        )}
      </Button>
    </form>
  );
}