import React, { useState } from 'react';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wallet, Loader2, AlertCircle, CheckCircle2, TrendingDown, Target, PieChart, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/components/i18n/LanguageContext';

export default function Login() {
  const { t, dir } = useLanguage();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [message, setMessage]   = useState(null);

  const features = [
    { icon: TrendingDown, label: t.feature_track_title,    desc: t.feature_track_desc },
    { icon: Target,       label: t.feature_goals_title,    desc: t.feature_goals_desc },
    { icon: PieChart,     label: t.feature_insights_title, desc: t.feature_insights_desc },
  ];

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) setError(error.message);
      else setMessage(t.check_email_confirm);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else window.location.href = '/';
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) { setError(t.enter_email_first); return; }
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    setMessage(t.password_reset_sent);
  };

  return (
    <div className="min-h-screen flex" dir={dir}>
      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background circles */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/5 rounded-full" />
        <div className="absolute -bottom-32 -right-16 w-[480px] h-[480px] bg-white/5 rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-white/5 rounded-full" />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <span className="text-white font-bold text-xl tracking-tight">BudgetMate</span>
        </div>

        {/* Hero text */}
        <div className="relative space-y-8">
          <div>
            <h2 className="text-4xl font-bold text-white leading-tight">
              {t.login_hero_line1}<br />{t.login_hero_line2}
            </h2>
            <p className="mt-4 text-indigo-200 text-lg leading-relaxed max-w-sm">
              {t.login_hero_subtitle}
            </p>
          </div>

          <div className="space-y-5">
            {features.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-4">
                <div className="w-9 h-9 bg-white/15 rounded-lg flex items-center justify-center shrink-0 backdrop-blur-sm">
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{label}</p>
                  <p className="text-indigo-200 text-sm mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer note */}
        <div className="relative flex items-center gap-2 text-indigo-200 text-sm">
          <ShieldCheck className="h-4 w-4" />
          <span>{t.data_encrypted}</span>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2.5 justify-center">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
              <Wallet className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="text-slate-900 font-bold text-lg">BudgetMate</span>
          </div>

          {/* Heading */}
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {isSignUp ? t.create_account : t.welcome_back}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {isSignUp ? t.signup_subtitle : t.signin_subtitle}
            </p>
          </div>

          <div className="space-y-4">
            {/* Google */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 h-11 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-sm font-medium text-slate-700 disabled:opacity-60"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {t.continue_with_google}
            </button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-100" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-wide">
                <span className="bg-white px-3 text-slate-400 font-medium">{t.or_separator}</span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-slate-700">{t.email_label}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.email_placeholder}
                  required
                  className="h-11 rounded-xl border-slate-200 focus-visible:ring-indigo-400"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium text-slate-700">{t.password_label}</Label>
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-xs text-indigo-600 hover:underline font-medium"
                    >
                      {t.forgot_password}
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSignUp ? t.password_min_chars : t.password_label}
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
              {message && (
                <div className="flex items-start gap-2.5 text-sm text-green-700 bg-green-50 border border-green-100 p-3 rounded-xl">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{message}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-semibold text-sm transition-colors"
              >
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isSignUp ? t.create_account : t.sign_in}
              </Button>
            </form>
          </div>

          {/* Toggle */}
          <p className="text-center text-sm text-slate-500">
            {isSignUp ? t.already_have_account : t.no_account_yet}{' '}
            <button
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setError(null); setMessage(null); }}
              className="text-indigo-600 hover:underline font-semibold"
            >
              {isSignUp ? t.sign_in : t.sign_up}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
