import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Shield, Lock, Mail, ArrowRight, ExternalLink } from 'lucide-react';

interface LoginPageProps {
  onOpenVerify: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onOpenVerify }) => {
  const { login, error } = useAuth();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setLocalError(null);
      await login(email, password);
    } catch (err: any) {
      setLocalError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-neutral-100 flex flex-col justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8 text-neutral-900 font-sans overflow-y-auto">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-2">
          <div className="w-10 h-10 rounded-md bg-neutral-900 text-white flex items-center justify-center font-bold text-lg">
            L
          </div>
        </div>
        <h2 className="text-center text-xl font-bold tracking-tight text-neutral-900">
          LedgerStore Portal
        </h2>
        <p className="mt-1 text-center text-xs text-neutral-500">
          Point of Sale, Real-time Stock Ledger & Bill Verification
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-sm border border-neutral-200 rounded-lg sm:px-8 space-y-5">
          {(localError || error) && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {localError || error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-neutral-700 mb-1">
                Store Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-400 absolute left-2.5 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border border-neutral-300 rounded focus:border-neutral-900 focus:outline-none"
                  placeholder="name@store.in"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-neutral-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-neutral-400 absolute left-2.5 top-2.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border border-neutral-300 rounded focus:border-neutral-900 focus:outline-none"
                  placeholder="••••••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-neutral-900 text-white font-semibold rounded text-xs hover:bg-neutral-800 transition-colors flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In to Store Terminal'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Public Bill Verification Link */}
          <div className="pt-3 border-t border-neutral-100 text-center">
            <button
              type="button"
              onClick={onOpenVerify}
              className="text-xs text-neutral-600 hover:text-neutral-900 underline underline-offset-2 flex items-center justify-center gap-1 mx-auto"
            >
              Customer? Verify Bill Token Online
              <ExternalLink className="w-3 h-3 text-neutral-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
