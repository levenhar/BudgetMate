import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { User, Users, LogOut, Loader2, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import CategoryManager from '@/components/ui/CategoryManager';
import AlwaysApprovedList from '@/components/ui/AlwaysApprovedList';
import { useLanguage } from '@/components/i18n/LanguageContext';
import { supportedLanguages, getTranslations } from '@/components/i18n/translations';

const getDefaultCategories = (t) => [
  { name: t.category_supermarket, color: '#22c55e', icon: 'ShoppingCart' },
  { name: t.category_shopping, color: '#8b5cf6', icon: 'ShoppingBag' },
  { name: t.category_utilities, color: '#ef4444', icon: 'Receipt' },
  { name: t.category_rent, color: '#06b6d4', icon: 'Home' },
  { name: t.category_dining, color: '#f97316', icon: 'Utensils' },
  { name: t.category_entertainment, color: '#ec4899', icon: 'Sparkles' },
  { name: t.category_insurance, color: '#10b981', icon: 'Shield' },
  { name: t.category_education, color: '#eab308', icon: 'GraduationCap' },
  { name: t.category_transport, color: '#3b82f6', icon: 'Car' },
  { name: t.category_grooming, color: '#f43f5e', icon: 'Sparkles' },
  { name: t.category_fitness, color: '#14b8a6', icon: 'Dumbbell' },
  { name: t.category_donation, color: '#a855f7', icon: 'Heart' },
  { name: t.category_software, color: '#6366f1', icon: 'Laptop' },
  { name: t.category_gifts, color: '#f59e0b', icon: 'Gift' },
];

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

export default function Settings() {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const { lang, setLang, t } = useLanguage();

  // Fetch user
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
  });

  // Auto-create UserProfile so this user is discoverable by others
  useQuery({
    queryKey: ['userProfile', user?.email],
    queryFn: async () => {
      const existing = await base44.entities.UserProfile.filter({ user_email: user.email });
      if (existing.length === 0) {
        await base44.entities.UserProfile.create({
          user_email: user.email,
          full_name: user.full_name || '',
          status: 'active',
        });
      } else if (existing[0].full_name !== user.full_name) {
        await base44.entities.UserProfile.update(existing[0].id, {
          full_name: user.full_name || '',
        });
      }
      return true;
    },
    enabled: !!user?.email,
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      
      const cats = await base44.entities.Category.filter({ user_email: user.email, household_id: null });
      
      if (cats.length === 0) {
        // Create default categories
        const defaultCats = getDefaultCategories(t);
        const newCats = await base44.entities.Category.bulkCreate(
          defaultCats.map(cat => ({
            ...cat,
            user_email: user.email,
            household_id: null,
          }))
        );
        return newCats;
      }
      return cats;
    },
    enabled: !!user?.email,
  });



  // Category mutations
  const handleAddCategory = async (data) => {
    setIsLoading(true);
    const newCategory = await base44.entities.Category.create({
      ...data,
      user_email: user.email,
      household_id: null,
    });
    
    // Reconnect orphaned expenses with this category name
    const allExpenses = await base44.entities.Expense.filter({ user_email: user.email, household_id: null });
    
    const expensesToUpdate = allExpenses.filter(expense => 
      expense.category_name === newCategory.name && expense.category_id !== newCategory.id
    );
    
    if (expensesToUpdate.length > 0) {
      await Promise.all(
        expensesToUpdate.map(expense => 
          base44.entities.Expense.update(expense.id, { category_id: newCategory.id })
        )
      );
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    }
    
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    toast.success('הקטגוריה נוספה בהצלחה!');
    setIsLoading(false);
    return newCategory;
  };

  const handleEditCategory = async (id, data) => {
    setIsLoading(true);
    await base44.entities.Category.update(id, data);
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    toast.success('הקטגוריה עודכנה בהצלחה!');
    setIsLoading(false);
  };

  const handleDeleteCategory = async (id) => {
    setIsLoading(true);
    await base44.entities.Category.delete(id);
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    toast.success('הקטגוריה נמחקה בהצלחה!');
    setIsLoading(false);
  };

  const reconnectOrphanedExpenses = async (updatedCategories) => {
    // Get all expenses
    const allExpenses = await base44.entities.Expense.filter({ user_email: user.email, household_id: null });
    
    // Find expenses where category_id doesn't match any existing category but category_name matches
    const categoryMap = new Map(updatedCategories.map(c => [c.name, c.id]));
    const expensesToUpdate = allExpenses.filter(expense => {
      const categoryExists = updatedCategories.some(c => c.id === expense.category_id);
      const nameMatches = categoryMap.has(expense.category_name);
      return !categoryExists && nameMatches;
    });
    
    // Update orphaned expenses with correct category_id
    if (expensesToUpdate.length > 0) {
      const updatePromises = expensesToUpdate.map(expense => 
        base44.entities.Expense.update(expense.id, {
          category_id: categoryMap.get(expense.category_name)
        })
      );
      await Promise.all(updatePromises);
    }
  };

  const handleResetCategories = async () => {
    setIsLoading(true);
    
    // Find categories that are NOT in default list
    const defaultCats = getDefaultCategories(t);
    const defaultNames = defaultCats.map(c => c.name);
    const categoriesToDelete = categories.filter(cat => !defaultNames.includes(cat.name));
    
    // Delete only non-default categories
    if (categoriesToDelete.length > 0) {
      const deletePromises = categoriesToDelete.map(cat => base44.entities.Category.delete(cat.id));
      await Promise.all(deletePromises);
    }
    
    // Find which default categories are missing
    const existingNames = categories.map(c => c.name);
    const missingCategories = defaultCats.filter(cat => !existingNames.includes(cat.name));
    
    // Create only missing default categories
    if (missingCategories.length > 0) {
      await base44.entities.Category.bulkCreate(
        missingCategories.map(cat => ({
          ...cat,
          user_email: user.email,
          household_id: null,
        }))
      );
    }
    
    // Get updated categories and reconnect orphaned expenses
    const updatedCategories = await base44.entities.Category.filter({ user_email: user.email, household_id: null });
    
    await reconnectOrphanedExpenses(updatedCategories);
    
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    toast.success('הקטגוריות אופסו לברירת המחדל!');
    setIsLoading(false);
  };

  const handleLogout = () => {
    base44.auth.logout();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">{t.settings}</h1>
          <p className="text-slate-500 mt-1">{t.manage_account}</p>
        </div>

        <div className="space-y-6">
          {/* Account */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                {t.account}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-slate-900">{user?.full_name || t.user_label}</p>
                  <p className="text-sm text-slate-500">{user?.email}</p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={handleLogout}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4 me-2" />
                  {t.logout}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Language */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="h-5 w-5" />
                {t.language}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500 mb-3">{t.language_description}</p>
              <Select value={lang} onValueChange={async (newLang) => {
                // Translate default categories before changing language
                const oldT = t;
                const newT = getTranslations(newLang);
                
                if (categories.length > 0) {
                  const oldDefaultCats = getDefaultCategories(oldT);
                  const newDefaultCats = getDefaultCategories(newT);
                  const oldDefaultNames = oldDefaultCats.map(c => c.name);
                  
                  const categoriesToUpdate = categories.filter(cat => 
                    oldDefaultNames.includes(cat.name)
                  );
                  
                  if (categoriesToUpdate.length > 0) {
                    for (const cat of categoriesToUpdate) {
                      const keyIndex = DEFAULT_CATEGORY_KEYS.findIndex(key => oldT[key] === cat.name);
                      if (keyIndex !== -1) {
                        const newName = newT[DEFAULT_CATEGORY_KEYS[keyIndex]];
                        await base44.entities.Category.update(cat.id, { name: newName });
                      }
                    }
                    queryClient.invalidateQueries({ queryKey: ['categories'] });
                  }
                }
                
                setLang(newLang);
              }}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {supportedLanguages.map(l => (
                    <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Always Approved Users */}
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6">
              <AlwaysApprovedList user={user} />
            </CardContent>
          </Card>

          {/* Categories */}
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6">
              <CategoryManager
                categories={categories}
                onAdd={handleAddCategory}
                onEdit={handleEditCategory}
                onDelete={handleDeleteCategory}
                onReset={handleResetCategories}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}