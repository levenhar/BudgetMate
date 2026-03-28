import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { CalendarIcon, Plus, Loader2, Users, X, Star } from "lucide-react";
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useCurrency } from '@/lib/CurrencyContext';
import { useLanguage } from '@/components/i18n/LanguageContext';

// Generate a stable background color from a string
function colorFromString(str) {
  const colors = [
    'bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500',
    'bg-rose-500', 'bg-cyan-500', 'bg-pink-500', 'bg-teal-500',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Avatar({ name, size = 'md', src = null }) {
  const sizeClass = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
  return (
    <div className={`${sizeClass} rounded-full overflow-hidden flex items-center justify-center text-white font-semibold flex-shrink-0 relative ${colorFromString(name || '?')}`}>
      {getInitials(name)}
      {src && (
        <img src={src} alt={name} className="absolute inset-0 w-full h-full object-cover" onError={e => e.currentTarget.remove()} />
      )}
    </div>
  );
}

export default function SharedExpenseDialog({
  open,
  onOpenChange,
  categories,
  onSubmit,
  isSubmitting = false,
  user,
  isHouseholdMode,
  householdId
}) {
  const { currencySymbol } = useCurrency();
  const { t, dir } = useLanguage();
  const [form, setForm] = useState({
    amount: '',
    date: new Date(),
    categoryId: '',
    description: '',
    paidByUserId: '',
    splitMethod: 'equal',
    participants: [],
    splits: []
  });

  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Favorites state
  const [settingsId, setSettingsId] = useState(null);
  const [favoriteEmails, setFavoriteEmails] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);

  // Load settings + all profiles once when dialog opens
  useEffect(() => {
    if (!open || !user?.email) return;
    (async () => {
      try {
        const [settingsList, profiles] = await Promise.all([
          base44.entities.UserSettings.filter({ user_email: user.email }),
          base44.entities.User.list(),
        ]);
        const settings = settingsList[0];
        if (settings) {
          setSettingsId(settings.id);
          setFavoriteEmails(settings.favorite_participants || []);
        }
        setAllProfiles(profiles);
      } catch (e) {
        // non-critical
      }
    })();
  }, [open, user?.email]);

  // Derived: favorite user objects (excluding current user)
  const favoriteUsers = favoriteEmails
    .filter(email => email !== user?.email)
    .map(email => allProfiles.find(p => p.email === email || p.user_email === email))
    .filter(Boolean)
    .map(p => ({ email: p.email || p.user_email, name: p.full_name || p.email || p.user_email, picture_url: p.picture_url || null }));

  const toggleFavorite = useCallback(async (email) => {
    const isFav = favoriteEmails.includes(email);
    const updated = isFav
      ? favoriteEmails.filter(e => e !== email)
      : [...favoriteEmails, email];
    setFavoriteEmails(updated);
    try {
      if (settingsId) {
        await base44.entities.UserSettings.update(settingsId, { favorite_participants: updated });
      }
    } catch (e) {
      // revert on error
      setFavoriteEmails(favoriteEmails);
      toast.error('Failed to update favorites');
    }
  }, [favoriteEmails, settingsId]);

  // Search users
  const searchUsers = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    const users = allProfiles.length > 0 ? allProfiles : await base44.entities.User.list();
    const filtered = users.filter(u => {
      const email = u.email || u.user_email;
      const name = u.full_name;
      return (
        email !== user?.email &&
        (name?.toLowerCase().includes(query.toLowerCase()) ||
         email?.toLowerCase().includes(query.toLowerCase())) &&
        !form.participants.find(p => p.email === email)
      );
    });
    setSearchResults(filtered);
  };

  const buildSplitsAfterParticipantChange = (newParticipants, currentSplits, method) => {
    const total = parseFloat(form.amount) || 0;
    if (method === 'equal') {
      return calculateDefaultSplits(newParticipants, form.amount, 'equal');
    }
    const allP = [{ email: user?.email, name: user?.full_name }, ...newParticipants];
    const perPerson = allP.length > 0 ? total / allP.length : 0;
    return allP.map(p => {
      const existing = currentSplits.find(s => s.userId === p.email);
      return existing
        ? existing
        : { userId: p.email, userName: p.name, shareAmount: parseFloat(perPerson.toFixed(2)), sharePercent: allP.length > 0 ? 100 / allP.length : 0 };
    });
  };

  const addParticipant = (selectedUser) => {
    const email = selectedUser.email || selectedUser.user_email;
    const name = selectedUser.full_name || selectedUser.name || email;
    if (form.participants.find(p => p.email === email)) return;
    const newParticipants = [...form.participants, { email, name }];
    setForm(prev => ({
      ...prev,
      participants: newParticipants,
      splits: buildSplitsAfterParticipantChange(newParticipants, prev.splits, prev.splitMethod)
    }));
    setUserSearch('');
    setSearchResults([]);
  };

  const removeParticipant = (email) => {
    const newParticipants = form.participants.filter(p => p.email !== email);
    const newSplits = form.splitMethod === 'equal'
      ? calculateDefaultSplits(newParticipants, form.amount, 'equal')
      : form.splits.filter(s => s.userId !== email);
    setForm({
      ...form,
      participants: newParticipants,
      splits: newSplits,
      paidByUserId: form.paidByUserId === email ? '' : form.paidByUserId
    });
  };

  const calculateDefaultSplits = (participants, totalAmount, method) => {
    if (!totalAmount || participants.length === 0) return [];

    const total = parseFloat(totalAmount);
    if (method === 'equal') {
      const allParticipants = [{ email: user?.email, name: user?.full_name }, ...participants];
      const perPerson = total / allParticipants.length;
      const remainder = total - (perPerson * allParticipants.length);

      return allParticipants.map((p, i) => ({
        userId: p.email,
        userName: p.name,
        shareAmount: i === allParticipants.length - 1
          ? perPerson + remainder
          : perPerson,
        sharePercent: 100 / allParticipants.length
      }));
    }
    return [];
  };

  useEffect(() => {
    if (form.amount && form.splitMethod === 'equal') {
      setForm(prev => ({
        ...prev,
        splits: calculateDefaultSplits(prev.participants, prev.amount, 'equal')
      }));
    }
  }, [form.amount, form.participants.length]);

  const updateSplit = (index, field, value) => {
    const newSplits = [...form.splits];
    newSplits[index] = { ...newSplits[index], [field]: parseFloat(value) || 0 };
    setForm({ ...form, splits: newSplits });
  };

  const validateAndSubmit = async (e) => {
    e.preventDefault();

    if (form.participants.length === 0) {
      toast.error('הוסף לפחות משתתף אחד');
      return;
    }

    if (!form.paidByUserId) {
      toast.error('בחר מי שילם');
      return;
    }

    const totalAmount = parseFloat(form.amount);
    let finalSplits = form.splits;

    if (form.splitMethod === 'custom_amount') {
      const splitSum = form.splits.reduce((sum, s) => sum + (s.shareAmount || 0), 0);
      if (Math.abs(splitSum - totalAmount) > 0.01) {
        toast.error(`סכום החלוקה (${splitSum.toFixed(2)}) לא שווה לסכום הכולל (${totalAmount.toFixed(2)})`);
        return;
      }
    }

    if (form.splitMethod === 'custom_percent') {
      const percentSum = form.splits.reduce((sum, s) => sum + (s.sharePercent || 0), 0);
      if (Math.abs(percentSum - 100) > 0.01) {
        toast.error(`סכום האחוזים (${percentSum.toFixed(1)}%) חייב להיות 100%`);
        return;
      }
      finalSplits = form.splits.map((s, i) => ({
        ...s,
        shareAmount: i === form.splits.length - 1
          ? totalAmount - form.splits.slice(0, -1).reduce((sum, split) => sum + (totalAmount * split.sharePercent / 100), 0)
          : totalAmount * s.sharePercent / 100
      }));
    }

    const category = categories.find(c => c.id === form.categoryId);

    await onSubmit({
      total_amount: totalAmount,
      date: format(form.date, 'yyyy-MM-dd'),
      category_id: form.categoryId,
      category_name: category?.name || '',
      description: form.description,
      paid_by_user_id: form.paidByUserId,
      split_method: form.splitMethod,
      household_id: isHouseholdMode ? householdId : null,
      splits: finalSplits
    });

    resetForm();
  };

  const resetForm = () => {
    setForm({
      amount: '',
      date: new Date(),
      categoryId: '',
      description: '',
      paidByUserId: '',
      splitMethod: 'equal',
      participants: [],
      splits: []
    });
  };

  const allParticipants = [
    { email: user?.email, name: user?.full_name || 'אתה' },
    ...form.participants
  ];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir={dir}>
        <DialogHeader>
          <DialogTitle>הוצאה משותפת</DialogTitle>
        </DialogHeader>

        <form onSubmit={validateAndSubmit} className="space-y-4" dir={dir}>
          {/* Amount & Category */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>סכום כולל</Label>
              <Input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="text-lg font-semibold"
                dir="ltr"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>קטגוריה</Label>
              <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })} required>
                <SelectTrigger>
                  <SelectValue placeholder="בחר קטגוריה" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                        {cat.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date & Description */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>תאריך</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="h-4 w-4 ml-2" />
                    {format(form.date, 'dd/MM/yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={form.date}
                    onSelect={(d) => d && setForm({ ...form, date: d })}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>תיאור</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t.description_placeholder}
              />
            </div>
          </div>

          {/* Add Participants */}
          <div className="space-y-2">
            <Label>משתתפים</Label>
            <div className="relative">
              <Input
                value={userSearch}
                onChange={(e) => {
                  setUserSearch(e.target.value);
                  searchUsers(e.target.value);
                }}
                placeholder={t.search_participant}
                className="pl-10"
              />
              <Users className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
            </div>

            {searchResults.length > 0 && (
              <div className="border border-slate-200 rounded-lg max-h-40 overflow-y-auto">
                {searchResults.map((u) => {
                  const email = u.email || u.user_email;
                  const isFav = favoriteEmails.includes(email);
                  return (
                    <div
                      key={email}
                      className="w-full text-start px-3 py-2 hover:bg-slate-50 flex items-center justify-between"
                    >
                      <button
                        type="button"
                        onClick={() => addParticipant(u)}
                        className="flex items-center gap-2 flex-1"
                      >
                        <Avatar name={u.full_name || email} size="sm" />
                        <div>
                          <div className="font-medium">{u.full_name}</div>
                          <div className="text-sm text-slate-500">{email}</div>
                        </div>
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(email); }}
                          className={`p-1.5 rounded-full hover:bg-slate-100 transition-colors ${isFav ? 'text-amber-400' : 'text-slate-400 hover:text-amber-400'}`}
                          title={isFav ? 'הסר מהמועדפים' : 'הוסף למועדפים'}
                        >
                          <Star className="h-4 w-4" fill={isFav ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          type="button"
                          onClick={() => addParticipant(u)}
                          className="p-1.5 text-slate-400 hover:text-slate-700"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Current participants chips */}
            <div className="flex flex-wrap gap-2">
              <div className="px-3 py-1 bg-slate-900 text-white rounded-full text-sm">
                אתה
              </div>
              {form.participants.map((p) => (
                <div key={p.email} className="px-3 py-1 bg-slate-100 rounded-full text-sm flex items-center gap-2">
                  {p.name}
                  <button
                    type="button"
                    onClick={() => removeParticipant(p.email)}
                    className="hover:text-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>

            {/* Favorites quick-add row */}
            {favoriteUsers.length > 0 && (
              <div className="pt-1">
                <p className="text-xs text-slate-400 mb-1.5">מועדפים</p>
                <TooltipProvider delayDuration={300}>
                  <div className="flex flex-wrap gap-2">
                    {favoriteUsers.map((fav) => {
                      const alreadyAdded = form.participants.some(p => p.email === fav.email);
                      return (
                        <Tooltip key={fav.email}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => !alreadyAdded && addParticipant(fav)}
                              className={`relative transition-all ${alreadyAdded ? 'opacity-40 cursor-default' : 'hover:scale-110 active:scale-95'}`}
                            >
                              <Avatar name={fav.name} size="sm" src={fav.picture_url} />
                              {alreadyAdded && (
                                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
                                  <span className="text-white text-[8px] font-bold">✓</span>
                                </span>
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            <p className="text-xs">{fav.name}</p>
                            {alreadyAdded && <p className="text-xs text-slate-400">כבר נוסף</p>}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </TooltipProvider>
              </div>
            )}
          </div>

          {/* Who Paid */}
          <div className="space-y-2">
            <Label>מי שילם?</Label>
            <Select value={form.paidByUserId} onValueChange={(v) => setForm({ ...form, paidByUserId: v })} required>
              <SelectTrigger>
                <SelectValue placeholder="בחר מי שילם" />
              </SelectTrigger>
              <SelectContent>
                {allParticipants.map((p) => (
                  <SelectItem key={p.email} value={p.email}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Split Method */}
          <div className="space-y-2">
            <Label>שיטת חלוקה</Label>
            <Select value={form.splitMethod} onValueChange={(v) => {
              const total = parseFloat(form.amount) || 0;
              const allP = [{ email: user?.email, name: user?.full_name }, ...form.participants];
              let newSplits = form.splits;
              if (v === 'equal') {
                newSplits = calculateDefaultSplits(form.participants, form.amount, 'equal');
              } else if (v === 'custom_amount') {
                const perPerson = allP.length > 0 ? total / allP.length : 0;
                newSplits = allP.map(p => ({
                  userId: p.email,
                  userName: p.name,
                  shareAmount: parseFloat(perPerson.toFixed(2)),
                  sharePercent: allP.length > 0 ? 100 / allP.length : 0
                }));
              } else if (v === 'custom_percent') {
                newSplits = allP.map(p => ({
                  userId: p.email,
                  userName: p.name,
                  shareAmount: allP.length > 0 ? total / allP.length : 0,
                  sharePercent: allP.length > 0 ? 100 / allP.length : 0
                }));
              }
              setForm({ ...form, splitMethod: v, splits: newSplits });
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equal">חלוקה שווה</SelectItem>
                <SelectItem value="custom_amount">סכומים מותאמים</SelectItem>
                <SelectItem value="custom_percent">אחוזים מותאמים</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Splits Table */}
          {form.splits.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-start p-2 text-sm font-medium">משתתף</th>
                    <th className="text-start p-2 text-sm font-medium">
                      {form.splitMethod === 'custom_percent' ? 'אחוז (%)' : `סכום (${currencySymbol})`}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {form.splits.map((split, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="p-2">{split.userName}</td>
                      <td className="p-2">
                        {form.splitMethod === 'equal' ? (
                          <span className="font-semibold">{currencySymbol}{split.shareAmount.toFixed(2)}</span>
                        ) : (
                          <Input
                            type="number"
                            step={form.splitMethod === 'custom_percent' ? '0.1' : '0.01'}
                            value={form.splitMethod === 'custom_percent' ? split.sharePercent : split.shareAmount}
                            onChange={(e) => updateSplit(i, form.splitMethod === 'custom_percent' ? 'sharePercent' : 'shareAmount', e.target.value)}
                            className="w-24"
                            dir="ltr"
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-12 text-base font-medium bg-slate-900 hover:bg-slate-800"
            disabled={isSubmitting || form.participants.length === 0}
          >
            {isSubmitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Plus className="h-5 w-5 ml-2" />
                צור הוצאה משותפת
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
