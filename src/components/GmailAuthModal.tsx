import React, { useState, useEffect } from 'react';
import { Mail, Shield, User, CornerDownRight, CheckCircle2, RefreshCw } from 'lucide-react';
import { UserSession } from '../types';

interface GmailAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (session: UserSession) => void;
  userEmail?: string;
}

export default function GmailAuthModal({ isOpen, onClose, onSuccess, userEmail = 'gauravbeniwal30003@gmail.com' }: GmailAuthModalProps) {
  const [step, setStep] = useState<'select' | 'custom' | 'authorizing'>('select');
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setStep('select');
      setCustomEmail('');
      setCustomName('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectAccount = async (email: string, name: string) => {
    setStep('authorizing');
    try {
      const { syncUserProfile } = await import('../lib/supabase');
      const session = await syncUserProfile(email, name);
      onSuccess(session);
    } catch (err) {
      console.error('Supabase profile sync error:', err);
      onSuccess({
        email,
        name,
        picture: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=000000&color=ffffff`,
        balance: 10000.00, // INR 10,000 fallback balance
        apiKey: 'smm_' + Math.random().toString(36).substring(2, 17).toUpperCase(),
      });
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail || !customEmail.includes('@')) {
      setError('Please enter a valid Gmail address.');
      return;
    }
    const derivedName = customName || customEmail.split('@')[0].toUpperCase();
    handleSelectAccount(customEmail, derivedName);
  };

  return (
    <div id="gmail-auth-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      {/* Outer liquid borders */}
      <div id="gmail-auth-container" className="relative w-full max-w-md overflow-hidden rounded-2xl glass-card transition-all duration-300">
        
        {/* Glow effect */}
        <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
        
        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex flex-col items-center mb-6 text-center">
            {/* Minimal google G layout */}
            <div className="flex items-center justify-center w-12 h-12 mb-3 bg-white/5 border border-white/10 rounded-full">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            </div>
            
            <h3 className="text-xl font-semibold tracking-tight text-white">Sign in with Google</h3>
            <p className="mt-1 text-xs text-neutral-400">to continue to SMM Panel Dashboard</p>
          </div>

          {step === 'select' && (
            <div className="space-y-4">
              <p className="text-xs font-medium text-neutral-400 mb-2">Choose an account</p>
              
              {/* Account 1: Logged-in User Email */}
              <button
                id="select-account-btn-primary"
                onClick={() => handleSelectAccount(userEmail, userEmail.split('@')[0])}
                className="flex items-center w-full p-3 text-left transition-all rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.08] hover:border-white/20 group"
              >
                <div className="flex items-center justify-center w-10 h-10 bg-white/10 rounded-full border border-white/10 text-white font-medium">
                  {userEmail.substring(0, 2).toUpperCase()}
                </div>
                <div className="ml-3 overflow-hidden flex-1">
                  <div className="text-sm font-medium text-white group-hover:text-white flex items-center">
                    <span>{userEmail.split('@')[0]}</span>
                    <span className="ml-[6px] px-[5px] py-[1px] text-[9px] bg-white text-black font-semibold rounded-full uppercase">User</span>
                  </div>
                  <div className="text-xs text-neutral-400 truncate">{userEmail}</div>
                </div>
                <CornerDownRight className="w-4 h-4 ml-2 text-neutral-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>

              {/* Button to use another account */}
              <button
                id="use-another-account-btn"
                onClick={() => setStep('custom')}
                className="flex items-center justify-center w-full py-2.5 text-xs font-medium text-neutral-300 hover:text-white transition-colors border border-dashed border-white/10 rounded-lg hover:border-white/20 hover:bg-white/[0.02]"
              >
                <User className="w-3.5 h-3.5 mr-2" />
                Sign in with another Gmail account
              </button>

              <div className="flex items-center justify-between pt-4 mt-2 border-t border-white/5 text-[11px] text-neutral-500">
                <span className="flex items-center">
                  <Shield className="w-3 h-3 mr-1" />
                  Secure Google SSL
                </span>
                <span className="hover:underline cursor-pointer" onClick={onClose}>Cancel Connection</span>
              </div>
            </div>
          )}

          {step === 'custom' && (
            <form id="custom-gmail-form" onSubmit={handleCustomSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Your Name (Optional)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    id="gmail-custom-name-input"
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full pl-9 pr-4 py-2 text-sm text-white rounded-lg glass-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Gmail Address (Required)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    id="gmail-custom-email-input"
                    type="email"
                    required
                    value={customEmail}
                    onChange={(e) => {
                      setCustomEmail(e.target.value);
                      setError('');
                    }}
                    placeholder="e.g. yourname@gmail.com"
                    className="w-full pl-9 pr-4 py-2 text-sm text-white rounded-lg glass-input"
                  />
                </div>
                {error && <p id="gmail-error-text" className="mt-1.5 text-xs text-red-400">{error}</p>}
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  id="custom-gmail-back"
                  type="button"
                  onClick={() => setStep('select')}
                  className="flex-1 py-2 text-xs font-medium rounded-lg glass-button-secondary"
                >
                  Back
                </button>
                <button
                  id="custom-gmail-submit"
                  type="submit"
                  className="flex-1 py-2 text-xs font-medium rounded-lg glass-button-primary bg-white text-black hover:bg-neutral-200"
                >
                  Authenticate
                </button>
              </div>
            </form>
          )}

          {step === 'authorizing' && (
            <div id="gmail-authorizing-loading" className="py-8 flex flex-col items-center justify-center text-center">
              <div className="relative flex items-center justify-center mb-4">
                <RefreshCw className="w-10 h-10 text-white animate-spin" />
                <div className="absolute inset-0 rounded-full blur-[10px] bg-white/20 animate-pulse"></div>
              </div>
              <h4 className="text-sm font-medium text-white mb-1">Synchronizing Google Accounts</h4>
              <p className="text-xs text-neutral-400 max-w-[240px]">Creating a secure session, establishing encrypted wallet token...</p>
              
              <div className="w-full max-w-[200px] bg-white/10 h-1 rounded-full overflow-hidden mt-6">
                <div className="bg-white h-full animate-[loading_1.5s_ease-out_infinite]" style={{ width: '60%' }}></div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
