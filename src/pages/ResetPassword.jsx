import { useState, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wallet, Loader2, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';

export default function ResetPassword() {
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [success, setSuccess]     = useState(false);
  const [ready, setReady]         = useState(false);

  useEffect(() => {
    // Supabase automatically exchanges the token in the URL hash.
    // PASSWORD_RECOVERY fires once that exchange completes.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });

    // Handle the case where the page is reloaded after the token was already exchanged.
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      setTimeout(() => { window.location.href = '/'; }, 2500);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-4">

      {/* Background circles */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/5 rounded-full pointer-events-none" />
      <div className="absolute -bottom-32 -right-16 w-[480px] h-[480px] bg-white/5 rounded-full pointer-events-none" />

      <div className="relative w-full max-w-sm">

        {/* Mobile logo */}
        <div className="flex items-center gap-2.5 justify-center mb-6">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <Wallet className="h-4 w-4 text-white" />
          </div>
          <span className="text-white font-bold text-lg">BudgetMate</span>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-6 space-y-5">

            {success ? (
              <div className="py-4 text-center space-y-3">
                <div className="flex justify-center">
                  <div className="w-14 h-14 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center">
                    <CheckCircle2 className="h-7 w-7 text-green-600" />
                  </div>
                </div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Password updated!</h2>
                <p className="text-sm text-slate-500">Redirecting you to the app…</p>
              </div>
            ) : !ready ? (
              <div className="py-4 text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-400 mx-auto" />
                <p className="text-sm text-slate-500">Verifying your reset link…</p>
              </div>
            ) : (
              <>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Set new password</h1>
                  <p className="text-slate-500 text-sm mt-1">Choose a strong password for your account.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-password" className="text-sm font-medium text-slate-700">New password</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showPass ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min. 6 characters"
                        required
                        minLength={6}
                        className="h-11 rounded-xl border-slate-200 focus-visible:ring-indigo-400 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        tabIndex={-1}
                      >
                        {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-password" className="text-sm font-medium text-slate-700">Confirm password</Label>
                    <Input
                      id="confirm-password"
                      type={showPass ? 'text' : 'password'}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Repeat your new password"
                      required
                      minLength={6}
                      className="h-11 rounded-xl border-slate-200 focus-visible:ring-indigo-400"
                    />
                  </div>

                  {error && (
                    <div className="flex items-start gap-2.5 text-sm text-red-700 bg-red-50 border border-red-100 p-3 rounded-xl">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-semibold text-sm"
                  >
                    {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Update password
                  </Button>
                </form>
              </>
            )}

          </div>
        </div>

        <p className="text-center mt-4 text-sm text-white/60">
          <a href="/login" className="hover:text-white transition-colors">← Back to login</a>
        </p>
      </div>
    </div>
  );
}
