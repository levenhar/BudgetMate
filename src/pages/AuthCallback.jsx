import { useEffect, useState } from 'react';
import { supabase } from '@/api/supabaseClient';

export default function AuthCallback() {
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setError(`Session error: ${error.message}`);
      } else if (data?.session) {
        window.location.href = '/';
      } else {
        setError('No session found after OAuth callback. URL: ' + window.location.href);
      }
    });
  }, []);

  if (error) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 p-8">
        <p className="text-red-600 font-semibold text-lg">Auth callback error</p>
        <pre className="bg-red-50 border border-red-200 rounded p-4 text-sm text-red-800 max-w-xl break-all whitespace-pre-wrap">
          {error}
        </pre>
        <a href="/login" className="text-indigo-600 underline text-sm">Back to login</a>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
    </div>
  );
}
