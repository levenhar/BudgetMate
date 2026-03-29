import React, { useState, useRef } from 'react';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Wallet, Loader2, AlertCircle, CheckCircle2,
  TrendingDown, Target, PieChart, ShieldCheck, Camera,
} from 'lucide-react';
import { useLanguage } from '@/components/i18n/LanguageContext';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Resize + compress an image file to max 256×256 JPEG at 80% quality (~10–30 KB) */
function compressAvatar(file) {
  return new Promise((resolve) => {
    const MAX = 256;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(MAX / img.width, MAX / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.8);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

async function uploadAvatar(file) {
  const compressed = await compressAvatar(file);
  const path = `${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from('avatars').upload(path, compressed, { contentType: 'image/jpeg' });
  if (error) return null;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}

// ─── component ──────────────────────────────────────────────────────────────

export default function Login() {
  const { t, dir } = useLanguage();

  const [isSignUp, setIsSignUp]           = useState(false);
  const [email, setEmail]                 = useState('');
  const [password, setPassword]           = useState('');
  const [fullName, setFullName]           = useState('');
  const [avatarFile, setAvatarFile]       = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState(null);
  const [message, setMessage]             = useState(null);
  const fileInputRef                      = useRef(null);

  // Gradient changes per mode
  const gradientFrom = isSignUp
    ? 'from-violet-600 via-purple-500 to-pink-600'
    : 'from-indigo-600 via-violet-600 to-purple-700';

  const signInFeatures = [
    { icon: TrendingDown, label: t.feature_track_title,    desc: t.feature_track_desc },
    { icon: Target,       label: t.feature_goals_title,    desc: t.feature_goals_desc },
    { icon: PieChart,     label: t.feature_insights_title, desc: t.feature_insights_desc },
  ];

  const signUpFeatures = [
    t.signup_feature_1,
    t.signup_feature_2,
    t.signup_feature_3,
    t.signup_feature_4,
  ];

  // ── handlers ──────────────────────────────────────────────────────────────

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (isSignUp) {
      let avatarUrl = null;
      if (avatarFile) {
        avatarUrl = await uploadAvatar(avatarFile); // non-blocking failure — null = no photo
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: fullName,
            ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
          },
        },
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
    if (error) { setError(error.message); setLoading(false); }
  };

  const handleForgotPassword = async () => {
    if (!email) { setError(t.enter_email_first); return; }
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setMessage(t.password_reset_sent);
  };

  const switchMode = (toSignUp) => {
    setIsSignUp(toSignUp);
    setError(null);
    setMessage(null);
  };

  // ── shared form elements ───────────────────────────────────────────────────

  const alertError = error && (
    <div className="flex items-start gap-2.5 text-sm text-red-700 bg-red-50 border border-red-100 p-3 rounded-xl">
      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
      <span>{error}</span>
    </div>
  );

  const alertMessage = message && (
    <div className="flex items-start gap-2.5 text-sm text-green-700 bg-green-50 border border-green-100 p-3 rounded-xl">
      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );

  const googleButton = (
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
  );

  const divider = (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-slate-100" />
      </div>
      <div className="relative flex justify-center text-xs uppercase tracking-wide">
        <span className="bg-white px-3 text-slate-400 font-medium">{t.or_separator}</span>
      </div>
    </div>
  );

  // ── sub-views ─────────────────────────────────────────────────────────────

  const signInForm = (
    <form onSubmit={handleEmailAuth} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email-si" className="text-sm font-medium text-slate-700">{t.email_label}</Label>
        <Input id="email-si" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder={t.email_placeholder} required
          className="h-11 rounded-xl border-slate-200 focus-visible:ring-indigo-400" />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password-si" className="text-sm font-medium text-slate-700">{t.password_label}</Label>
          <button type="button" onClick={handleForgotPassword}
            className="text-xs text-indigo-600 hover:underline font-medium">
            {t.forgot_password}
          </button>
        </div>
        <Input id="password-si" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder={t.password_label} required minLength={6}
          className="h-11 rounded-xl border-slate-200 focus-visible:ring-indigo-400" />
      </div>
      {alertError}
      {alertMessage}
      <Button type="submit" disabled={loading}
        className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-semibold text-sm">
        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {t.sign_in}
      </Button>
    </form>
  );

  const signUpForm = (
    <form onSubmit={handleEmailAuth} className="space-y-4">
      {/* Photo upload */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
      <button type="button" onClick={() => fileInputRef.current?.click()}
        className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-violet-300 bg-violet-50 hover:bg-violet-100 transition-colors">
        <div className="w-10 h-10 rounded-full bg-violet-100 border-2 border-violet-300 flex items-center justify-center overflow-hidden shrink-0">
          {avatarPreview
            ? <img src={avatarPreview} alt="preview" className="w-full h-full object-cover" />
            : <Camera className="h-4 w-4 text-violet-400" />}
        </div>
        <div className="text-start">
          <p className="text-sm font-medium text-violet-700">{t.add_photo_optional}</p>
          <p className="text-xs text-violet-400">{t.tap_to_upload}</p>
        </div>
      </button>

      {/* Full name */}
      <div className="space-y-1.5">
        <Label htmlFor="fullname" className="text-sm font-medium text-slate-700">{t.full_name_label}</Label>
        <Input id="fullname" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
          placeholder={t.full_name_placeholder} required
          className="h-11 rounded-xl border-slate-200 focus-visible:ring-violet-400" />
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <Label htmlFor="email-su" className="text-sm font-medium text-slate-700">{t.email_label}</Label>
        <Input id="email-su" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder={t.email_placeholder} required
          className="h-11 rounded-xl border-slate-200 focus-visible:ring-violet-400" />
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <Label htmlFor="password-su" className="text-sm font-medium text-slate-700">{t.password_label}</Label>
        <Input id="password-su" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder={t.password_min_chars} required minLength={6}
          className="h-11 rounded-xl border-slate-200 focus-visible:ring-violet-400" />
      </div>

      {googleButton}
      {divider}

      {alertError}
      {alertMessage}

      <Button type="submit" disabled={loading}
        className="w-full h-11 rounded-xl bg-violet-600 hover:bg-violet-700 font-semibold text-sm">
        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {t.create_account}
      </Button>
    </form>
  );

  // ── tabs ──────────────────────────────────────────────────────────────────

  const tabs = (
    <div className="flex border-b-2 border-slate-100">
      <button type="button" onClick={() => switchMode(false)}
        className={`flex-1 py-3 text-sm font-semibold transition-colors ${
          !isSignUp
            ? 'text-indigo-600 border-b-2 border-indigo-600 -mb-0.5'
            : 'text-slate-400 hover:text-slate-600'
        }`}>
        {t.signin_tab}
      </button>
      <button type="button" onClick={() => switchMode(true)}
        className={`flex-1 py-3 text-sm font-semibold transition-colors ${
          isSignUp
            ? 'text-violet-600 border-b-2 border-violet-600 -mb-0.5'
            : 'text-slate-400 hover:text-slate-600'
        }`}>
        {t.signup_tab}
      </button>
    </div>
  );

  // ── left panel ────────────────────────────────────────────────────────────

  const leftPanel = (
    <div className={`hidden lg:flex bg-gradient-to-br ${gradientFrom} flex-col justify-between p-12 relative overflow-hidden transition-all duration-500`}>
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
          {signInFeatures.map(({ icon: Icon, label, desc }) => (
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

      {/* Footer */}
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2 text-white/60 text-sm">
          <ShieldCheck className="h-4 w-4" />
          <span>{t.data_encrypted}</span>
        </div>
        {import.meta.env.VITE_APP_ENV === 'staging' && (
          <span className="text-xs font-bold bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full">STAGING</span>
        )}
      </div>
    </div>
  );

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen lg:h-screen flex lg:grid lg:grid-cols-2" dir={dir}>
      {leftPanel}

      {/* Right panel — desktop white + scrollable, mobile: gradient bg + floating card */}
      <div className={`w-full min-h-screen lg:min-h-0 flex items-center justify-center lg:bg-white lg:bg-none relative lg:overflow-y-auto overflow-y-auto lg:p-8 p-6 bg-gradient-to-br ${gradientFrom} ${isSignUp ? 'lg:items-start' : ''}`}>

        {/* Mobile bg circles (hidden on lg) */}
        <div className="lg:hidden absolute -top-24 -left-24 w-96 h-96 bg-white/5 rounded-full" />
        <div className="lg:hidden absolute -bottom-32 -right-16 w-[480px] h-[480px] bg-white/5 rounded-full" />

        {/* Inner wrapper */}
        <div className="relative w-full max-w-sm">

          {/* Mobile logo (shown above card on gradient) */}
          <div className="lg:hidden flex items-center gap-2.5 justify-center mb-6">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Wallet className="h-4 w-4 text-white" />
            </div>
            <span className="text-white font-bold text-lg">BudgetMate</span>
          </div>

          {/* Card — white on mobile, transparent on desktop */}
          <div className="bg-white rounded-2xl lg:rounded-none lg:bg-transparent shadow-2xl lg:shadow-none overflow-hidden">

            {/* Tabs */}
            {tabs}

            <div className="p-6 lg:p-0 lg:pt-6 space-y-5">
              {/* Heading */}
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {isSignUp ? t.create_account : t.welcome_back}
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                  {isSignUp ? t.signup_subtitle : t.signin_subtitle}
                </p>
              </div>

              {/* Form */}
              {isSignUp ? signUpForm : (
                <>
                  {googleButton}
                  {divider}
                  {signInForm}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
