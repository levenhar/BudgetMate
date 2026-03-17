import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Copy, Check, Plus, LogOut, Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function HouseholdManager({ 
  household,
  userEmail,
  onCreateHousehold,
  onJoinHousehold,
  onLeaveHousehold,
  isLoading
}) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [householdName, setHouseholdName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [copied, setCopied] = useState(false);

  const isOwner = household?.owner_email === userEmail;

  const copyInviteCode = () => {
    if (household?.invite_code) {
      navigator.clipboard.writeText(household.invite_code);
      setCopied(true);
      toast.success('קוד ההזמנה הועתק!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCreate = async () => {
    await onCreateHousehold(householdName);
    setHouseholdName('');
    setShowCreateDialog(false);
  };

  const handleJoin = async () => {
    await onJoinHousehold(inviteCode);
    setInviteCode('');
    setShowJoinDialog(false);
  };

  if (household) {
    return (
      <Card className="bg-gradient-to-br from-violet-50 to-indigo-50 border-0">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm">
                <Users className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">{household.name}</h3>
                <p className="text-sm text-slate-500">
                  {(household.member_emails?.length || 0) + 1} חברים
                </p>
              </div>
            </div>
            {isOwner && (
              <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                <Crown className="h-3 w-3" />
                בעלים
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-white rounded-lg px-4 py-2 text-sm font-mono text-slate-700">
                {household.invite_code}
              </div>
              <Button 
                variant="outline" 
                size="icon"
                onClick={copyInviteCode}
                className="shrink-0"
              >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              שתף קוד זה עם בני משפחה כדי להזמין אותם
            </p>

            <div className="pt-2">
              <Button 
                variant="outline" 
                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={onLeaveHousehold}
              >
                <LogOut className="h-4 w-4 ml-2" />
                {isOwner ? 'מחק משק בית' : 'עזוב משק בית'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50">
        <CardContent className="p-6 text-center">
          <Users className="h-10 w-10 mx-auto text-slate-400 mb-3" />
          <h3 className="font-medium text-slate-700 mb-1">אין משק בית</h3>
          <p className="text-sm text-slate-500 mb-4">
            צור או הצטרף למשק בית כדי לשתף הוצאות עם המשפחה
          </p>
          <div className="flex gap-2 justify-center">
            <Button 
              variant="outline"
              onClick={() => setShowJoinDialog(true)}
            >
              הצטרף בקוד
            </Button>
            <Button 
              className="bg-slate-900 hover:bg-slate-800"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="h-4 w-4 ml-1" />
              צור
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>צור משק בית</DialogTitle>
            <DialogDescription>
              צור משק בית חדש כדי לשתף הוצאות עם המשפחה שלך
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>שם משק הבית</Label>
            <Input
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              placeholder="לדוגמה: משפחת כהן"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>ביטול</Button>
            <Button 
              onClick={handleCreate} 
              disabled={!householdName || isLoading}
              className="bg-slate-900 hover:bg-slate-800"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'צור'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Join Dialog */}
      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>הצטרף למשק בית</DialogTitle>
            <DialogDescription>
              הזן את קוד ההזמנה שקיבלת מבן משפחה
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>קוד הזמנה</Label>
            <Input
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="הזן קוד"
              className="mt-2 font-mono"
              dir="ltr"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowJoinDialog(false)}>ביטול</Button>
            <Button 
              onClick={handleJoin} 
              disabled={!inviteCode || isLoading}
              className="bg-slate-900 hover:bg-slate-800"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'הצטרף'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}