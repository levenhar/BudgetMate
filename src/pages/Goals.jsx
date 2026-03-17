import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/components/i18n/LanguageContext';
import { toast } from 'sonner';
import { Plus, MoreVertical, Edit2, Trash2, Target, PiggyBank } from 'lucide-react';
import confetti from 'canvas-confetti';

function ProgressRing({ percent, color, size = 76 }) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90" style={{ flexShrink: 0 }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="#e2e8f0"
        strokeWidth={7}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color || '#6366f1'}
        strokeWidth={7}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  );
}

const EMOJI_OPTIONS = ['🎯', '🏠', '✈️', '🚗', '💍', '📱', '🎓', '💰', '🏋️', '🌴', '🎮', '👶', '🐕', '🎸', '💻'];
const COLOR_OPTIONS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

const DEFAULT_FORM = {
  name: '',
  emoji: '🎯',
  target_amount: '',
  current_amount: '',
  color: '#6366f1',
  deadline: '',
};

export default function Goals() {
  const { t, dir } = useLanguage();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [addFundsGoalId, setAddFundsGoalId] = useState(null);
  const [addFundsAmount, setAddFundsAmount] = useState('');

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

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['savingsGoals', user?.email, settings?.current_household_id, isHouseholdMode],
    queryFn: async () => {
      if (!user?.email) return [];
      if (isHouseholdMode) {
        return base44.entities.SavingsGoal.filter({ household_id: settings.current_household_id });
      }
      return base44.entities.SavingsGoal.filter({ user_email: user.email });
    },
    enabled: !!user?.email,
  });

  const createMutation = useMutation({
    mutationFn: (data) =>
      base44.entities.SavingsGoal.create({
        ...data,
        user_email: user.email,
        household_id: isHouseholdMode ? settings.current_household_id : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savingsGoals'] });
      toast.success(t.goal_added || 'Goal added!');
      setDialogOpen(false);
      setForm(DEFAULT_FORM);
    },
    onError: () => toast.error(t.error_saving || 'Error saving goal'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }) => base44.entities.SavingsGoal.update(id, data),
    onSuccess: (updatedGoal) => {
      queryClient.invalidateQueries({ queryKey: ['savingsGoals'] });
      const pct = updatedGoal?.target_amount > 0
        ? (updatedGoal.current_amount / updatedGoal.target_amount) * 100
        : 0;
      if (pct >= 100) {
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.5 } });
        toast.success(t.goal_completed || '🎉 Goal reached!');
      } else {
        toast.success(t.goal_updated || 'Goal updated!');
      }
      setDialogOpen(false);
      setEditGoal(null);
      setAddFundsGoalId(null);
      setAddFundsAmount('');
    },
    onError: () => toast.error(t.error_saving || 'Error saving goal'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SavingsGoal.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savingsGoals'] });
      toast.success(t.goal_deleted || 'Goal deleted');
    },
  });

  const openAddDialog = () => {
    setEditGoal(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (goal) => {
    setEditGoal(goal);
    setForm({
      name: goal.name || '',
      emoji: goal.emoji || '🎯',
      target_amount: goal.target_amount != null ? String(goal.target_amount) : '',
      current_amount: goal.current_amount != null ? String(goal.current_amount) : '',
      color: goal.color || '#6366f1',
      deadline: goal.deadline || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...form,
      target_amount: parseFloat(form.target_amount) || 0,
      current_amount: parseFloat(form.current_amount) || 0,
    };
    if (editGoal) {
      updateMutation.mutate({ id: editGoal.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleAddFunds = (goal) => {
    const added = parseFloat(addFundsAmount) || 0;
    if (added <= 0) return;
    const newAmount = (goal.current_amount || 0) + added;
    updateMutation.mutate({ id: goal.id, current_amount: newAmount });
  };

  const getDaysRemaining = (deadline) => {
    if (!deadline) return null;
    return Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
  };

  const currency = settings?.currency || 'ILS';
  const fmt = (n) =>
    new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(n);

  const totalSaved = goals.reduce((s, g) => s + (g.current_amount || 0), 0);
  const totalTarget = goals.reduce((s, g) => s + (g.target_amount || 0), 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6" dir={dir}>
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">{t.total_saved || 'Total Saved'}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{fmt(totalSaved)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">{t.total_target || 'Total Target'}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{fmt(totalTarget)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">{t.active_goals || 'Active Goals'}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{goals.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Goals grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-0 shadow-sm animate-pulse">
              <CardContent className="p-6 h-52" />
            </Card>
          ))}
        </div>
      ) : goals.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-12 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center">
              <Target className="h-8 w-8 text-indigo-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">
                {t.no_goals_title || 'No savings goals yet'}
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                {t.no_goals_desc || 'Start by creating your first savings goal'}
              </p>
            </div>
            <Button onClick={openAddDialog} className="bg-slate-900 hover:bg-slate-800">
              <Plus className="h-4 w-4 me-2" />
              {t.add_goal || 'Add Goal'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map((goal) => {
            const pct =
              goal.target_amount > 0
                ? Math.min((goal.current_amount / goal.target_amount) * 100, 100)
                : 0;
            const daysLeft = getDaysRemaining(goal.deadline);
            const isComplete = pct >= 100;
            const isAddingFunds = addFundsGoalId === goal.id;

            return (
              <Card key={goal.id} className="border-0 shadow-sm overflow-hidden">
                <CardContent className="p-5">
                  {/* Header row */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-2xl flex-shrink-0">{goal.emoji || '🎯'}</span>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-900 leading-tight truncate">
                          {goal.name}
                        </h3>
                        {daysLeft !== null && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            {daysLeft > 0
                              ? `${daysLeft} ${t.days_remaining || 'days left'}`
                              : daysLeft === 0
                              ? t.due_today || 'Due today'
                              : t.overdue || 'Overdue'}
                          </p>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 flex-shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(goal)}>
                          <Edit2 className="h-4 w-4 me-2" />
                          {t.edit || 'Edit'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={() => deleteMutation.mutate(goal.id)}
                        >
                          <Trash2 className="h-4 w-4 me-2" />
                          {t.delete || 'Delete'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Progress ring + amounts */}
                  <div className="flex items-center gap-4">
                    <div className="relative flex-shrink-0">
                      <ProgressRing percent={pct} color={goal.color || '#6366f1'} size={76} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold text-slate-900">
                          {Math.round(pct)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold text-slate-900">
                        {fmt(goal.current_amount || 0)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {t.of || 'of'} {fmt(goal.target_amount || 0)}
                      </p>
                      {isComplete && (
                        <span className="inline-block mt-1 text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                          {t.goal_reached || '🎉 Goal Reached!'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Add Funds */}
                  <div className="mt-4">
                    {isAddingFunds ? (
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="0"
                          value={addFundsAmount}
                          onChange={(e) => setAddFundsAmount(e.target.value)}
                          className="h-8 text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddFunds(goal);
                            if (e.key === 'Escape') {
                              setAddFundsGoalId(null);
                              setAddFundsAmount('');
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          className="h-8 px-3 bg-slate-900 hover:bg-slate-800 text-xs shrink-0"
                          onClick={() => handleAddFunds(goal)}
                          disabled={updateMutation.isPending}
                        >
                          {t.add || 'Add'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs shrink-0"
                          onClick={() => {
                            setAddFundsGoalId(null);
                            setAddFundsAmount('');
                          }}
                        >
                          ✕
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-8 text-xs border-slate-200 hover:bg-slate-50"
                        onClick={() => {
                          setAddFundsGoalId(goal.id);
                          setAddFundsAmount('');
                        }}
                      >
                        <PiggyBank className="h-3.5 w-3.5 me-1.5" />
                        {t.add_funds || 'Add Funds'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Add new goal card */}
          <button
            onClick={openAddDialog}
            className="border-2 border-dashed border-slate-200 rounded-xl p-5 flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors min-h-[200px]"
          >
            <Plus className="h-6 w-6" />
            <span className="text-sm font-medium">{t.add_goal || 'Add Goal'}</span>
          </button>
        </div>
      )}

      {/* Add / Edit Goal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editGoal ? t.edit_goal || 'Edit Goal' : t.add_goal || 'Add Goal'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {/* Emoji picker */}
            <div>
              <Label className="text-sm font-medium mb-2 block">{t.emoji || 'Emoji'}</Label>
              <div className="flex flex-wrap gap-1.5">
                {EMOJI_OPTIONS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, emoji: em }))}
                    className={`text-xl w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                      form.emoji === em
                        ? 'bg-slate-900 shadow-md'
                        : 'hover:bg-slate-100'
                    }`}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div>
              <Label htmlFor="goal-name">{t.goal_name || 'Goal Name'}</Label>
              <Input
                id="goal-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t.goal_name_placeholder || 'e.g. Vacation, New Car'}
                required
                className="mt-1.5"
              />
            </div>

            {/* Amounts */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="target-amount">{t.target_amount || 'Target Amount'}</Label>
                <Input
                  id="target-amount"
                  type="number"
                  min="0"
                  value={form.target_amount}
                  onChange={(e) => setForm((f) => ({ ...f, target_amount: e.target.value }))}
                  placeholder="0"
                  required
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="current-amount">{t.current_amount || 'Saved So Far'}</Label>
                <Input
                  id="current-amount"
                  type="number"
                  min="0"
                  value={form.current_amount}
                  onChange={(e) => setForm((f) => ({ ...f, current_amount: e.target.value }))}
                  placeholder="0"
                  className="mt-1.5"
                />
              </div>
            </div>

            {/* Deadline */}
            <div>
              <Label htmlFor="deadline">{t.deadline || 'Deadline (Optional)'}</Label>
              <Input
                id="deadline"
                type="date"
                value={form.deadline}
                onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                className="mt-1.5"
              />
            </div>

            {/* Color picker */}
            <div>
              <Label className="text-sm font-medium mb-2 block">{t.color || 'Color'}</Label>
              <div className="flex gap-2 flex-wrap">
                {COLOR_OPTIONS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color: col }))}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${
                      form.color === col
                        ? 'border-slate-900 scale-110'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: col }}
                  />
                ))}
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editGoal ? t.update || 'Update' : t.add_goal || 'Add Goal'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
