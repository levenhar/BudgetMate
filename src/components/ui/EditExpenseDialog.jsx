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

export default function EditExpenseDialog({ 
  expense, 
  categories, 
  open, 
  onOpenChange, 
  onSave,
  isLoading,
  isShared = false
}) {
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
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>
            {expense?.is_shared ? 'ערוך הוצאה משותפת' : 'ערוך הוצאה'}
          </DialogTitle>
          {expense?.is_shared && (
            <p className="text-sm text-slate-500 mt-1">
              שינויים ישפיעו על כל המשתתפים
            </p>
          )}
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>סכום</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="text-lg font-semibold"
            />
          </div>

          <div className="space-y-2">
            <Label>קטגוריה</Label>
            <Select 
              value={formData.category_id} 
              onValueChange={(v) => setFormData({ ...formData, category_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="בחר קטגוריה" />
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
            <Label>תאריך</Label>
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
            <Label>תיאור</Label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="אופציונלי"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>עסק</Label>
              <Input
                value={formData.merchant}
                onChange={(e) => setFormData({ ...formData, merchant: e.target.value })}
                placeholder="אופציונלי"
              />
            </div>
            <div className="space-y-2">
              <Label>תשלום</Label>
              <Select 
                value={formData.payment_method} 
                onValueChange={(v) => setFormData({ ...formData, payment_method: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="אמצעי" />
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
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!formData.amount || !formData.category_id || isLoading}
            className="bg-slate-900 hover:bg-slate-800"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'שמור'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}