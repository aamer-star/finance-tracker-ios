import { useState } from 'react';
import { X, Mail, Lock, Loader2, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AuthModal({ onClose, onSuccess }: Props) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmSent, setConfirmSent] = useState(false);

  const submit = async () => {
    if (!supabase) return;
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error: e } = await supabase.auth.signUp({ email, password });
        if (e) throw e;
        setConfirmSent(true);
      } else {
        const { error: e } = await supabase.auth.signInWithPassword({ email, password });
        if (e) throw e;
        onSuccess();
        onClose();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-green-400" />
            <span className="font-bold text-white">Finance Tracker</span>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X size={18} />
          </button>
        </div>

        {confirmSent ? (
          <div className="space-y-4 py-2">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle size={24} className="text-green-400" />
              </div>
              <p className="font-semibold text-white">Check your email</p>
              <p className="text-sm text-gray-400">
                We sent a confirmation link to <span className="text-gray-200">{email}</span>.
                Click it to activate your account, then sign in.
              </p>
            </div>
            <button
              onClick={() => { setConfirmSent(false); setMode('signin'); }}
              className="w-full py-2.5 bg-green-500 hover:bg-green-600 text-black font-medium rounded-xl text-sm transition-colors"
            >
              Go to sign in
            </button>
          </div>
        ) : (
          <>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {mode === 'signin' ? 'Sign in to your account' : 'Create an account'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Your portfolio syncs across all your devices
              </p>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-4 py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:border-green-700"
                />
              </div>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-4 py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:border-green-700"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 border border-red-800/50 rounded-xl px-3 py-2.5">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <button
              onClick={submit}
              disabled={loading || !email || !password}
              className="w-full py-2.5 bg-green-500 hover:bg-green-600 disabled:bg-gray-800 disabled:text-gray-600 text-black font-medium rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>

            <p className="text-center text-sm text-gray-500">
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <button
                onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}
                className="text-green-400 hover:text-green-300"
              >
                {mode === 'signin' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
