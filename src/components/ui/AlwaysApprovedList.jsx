import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Trash2, CheckCheck, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { toast } from 'sonner';
import { useLanguage } from '@/components/i18n/LanguageContext';

export default function AlwaysApprovedList({ user }) {
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  const { data: alwaysApproved = [], isLoading } = useQuery({
    queryKey: ['alwaysApproved', user?.email],
    queryFn: async () => {
      const all = await base44.entities.AlwaysApprovedUser.filter({ user_id: user.email });
      // Deduplicate by approved_user_id (keep only one per person)
      const seen = new Set();
      return all.filter(entry => {
        if (seen.has(entry.approved_user_id)) return false;
        seen.add(entry.approved_user_id);
        return true;
      });
    },
    enabled: !!user?.email,
  });

  const removeMutation = useMutation({
    mutationFn: async (entry) => {
      // Delete all duplicate entries for the same approved_user_id
      const all = await base44.entities.AlwaysApprovedUser.filter({ user_id: user.email });
      const duplicates = all.filter(a => a.approved_user_id === entry.approved_user_id);
      await Promise.all(duplicates.map(d => base44.entities.AlwaysApprovedUser.delete(d.id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alwaysApproved'] });
      toast.success(t.always_approved_removed);
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <CheckCheck className="h-5 w-5 text-emerald-600" />
        <h3 className="font-semibold text-slate-900">{t.always_approved_title}</h3>
      </div>

      {alwaysApproved.length === 0 ? (
        <div className="text-center py-6 text-slate-500 text-sm bg-slate-50 rounded-xl">
          <CheckCheck className="h-8 w-8 mx-auto mb-2 text-slate-300" />
          <p>{t.always_approved_empty}</p>
          <p className="text-xs mt-1 text-slate-400">{t.always_approved_placeholder}</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {alwaysApproved.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-100 rounded-xl"
            >
              <div>
                <p className="font-medium text-slate-900 text-sm">
                  {entry.approved_user_name || entry.approved_user_id}
                </p>
                <p className="text-xs text-slate-500">{entry.approved_user_id}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeMutation.mutate(entry)}
                disabled={removeMutation.isPending}
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                {removeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}