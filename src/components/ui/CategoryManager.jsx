import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, Plus, Loader2, RotateCcw } from "lucide-react";
import { useLanguage } from '@/components/i18n/LanguageContext';

const DEFAULT_CATEGORY_KEYS = [
  'category_supermarket',
  'category_shopping',
  'category_utilities',
  'category_rent',
  'category_dining',
  'category_entertainment',
  'category_insurance',
  'category_education',
  'category_transport',
  'category_grooming',
  'category_fitness',
  'category_donation',
  'category_software',
  'category_gifts',
];

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
];

const PRESET_ICONS = [
  'ShoppingCart', 'Car', 'Home', 'Utensils', 'Heart',
  'ShoppingBag', 'GraduationCap', 'Plane', 'Gamepad2', 'MoreHorizontal'
];

export default function CategoryManager({ 
  categories, 
  onAdd, 
  onEdit, 
  onDelete,
  onReset,
  isLoading 
}) {
  const { t } = useLanguage();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({ name: '', color: PRESET_COLORS[0], icon: PRESET_ICONS[0] });
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Helper to get display name with translation
  const getDisplayName = (category) => {
    const keyIndex = DEFAULT_CATEGORY_KEYS.findIndex(key => t[key] === category.name);
    if (keyIndex !== -1) {
      return t[DEFAULT_CATEGORY_KEYS[keyIndex]];
    }
    return category.name;
  };

  const handleAdd = async () => {
    const newCategory = await onAdd(formData);
    setFormData({ name: '', color: PRESET_COLORS[0], icon: PRESET_ICONS[0] });
    setShowAddDialog(false);
    return newCategory;
  };

  const handleEdit = async () => {
    await onEdit(editingCategory.id, formData);
    setEditingCategory(null);
  };

  const handleDelete = async (cat) => {
    await onDelete(cat.id);
    setDeleteConfirm(null);
  };

  const openEdit = (cat) => {
    setFormData({ name: cat.name, color: cat.color, icon: cat.icon });
    setEditingCategory(cat);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">{t.personal_categories}</h3>
        <div className="flex gap-2">
          <Button 
            onClick={onReset}
            size="sm"
            variant="outline"
            disabled={isLoading}
          >
            <RotateCcw className="h-4 w-4 ml-1" />
            {t.reset_to_default}
          </Button>
          <Button 
            onClick={() => setShowAddDialog(true)}
            size="sm"
            className="bg-slate-900 hover:bg-slate-800"
          >
            <Plus className="h-4 w-4 ml-1" />
            {t.add_category}
          </Button>
        </div>
      </div>

      <div className="grid gap-2 max-h-64 overflow-y-auto pr-1">
        {categories.map((cat) => (
          <div 
            key={cat.id}
            className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100"
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${cat.color}20` }}
              >
                <div 
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
              </div>
              <span className="font-medium text-slate-900">{getDisplayName(cat)}</span>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-slate-600"
                onClick={() => openEdit(cat)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-red-500"
                onClick={() => setDeleteConfirm(cat)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.add_category_title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t.category_name}</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="שם הקטגוריה"
              />
            </div>
            <div className="space-y-2">
              <Label>{t.category_color}</Label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-8 h-8 rounded-lg transition-transform ${
                      formData.color === color ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>{t.cancel}</Button>
            <Button 
              onClick={handleAdd} 
              disabled={!formData.name || isLoading}
              className="bg-slate-900 hover:bg-slate-800"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.add_category_title}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingCategory} onOpenChange={() => setEditingCategory(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.edit_category_title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t.category_name}</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.category_color}</Label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-8 h-8 rounded-lg transition-transform ${
                      formData.color === color ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCategory(null)}>{t.cancel}</Button>
            <Button 
              onClick={handleEdit} 
              disabled={!formData.name || isLoading}
              className="bg-slate-900 hover:bg-slate-800"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.delete_category_title}</DialogTitle>
          </DialogHeader>
          <p className="text-slate-600 py-4">
            {t.delete_category_confirm.replace('{name}', deleteConfirm?.name)}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>{t.cancel}</Button>
            <Button 
              variant="destructive"
              onClick={() => handleDelete(deleteConfirm)}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}