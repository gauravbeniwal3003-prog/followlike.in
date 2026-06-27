/// <reference types="vite/client" />
import { API_BASE } from '../config';
import React, { useState, useEffect } from 'react';
import { Mail, Phone, Lock, Eye, EyeOff, Shield, User, RefreshCw, CheckCircle } from 'lucide-react';
import { UserSession } from '../types';

declare global {
  interface Window {
    google: any;
  }
}

interface GmailAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (session: UserSession) => void;
  userEmail?: string;
}

export default function GmailAuthModal({ isOpen, onClose, onSuccess }: GmailAuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  
  // Inputs
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loginIdentifier, setLoginIdentifier] = useState('');
  
  // States
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Handle standard reset
  useEffect(() => {
    if (!isOpen) {
      setMode('signin');
      setName('');
      setEmail('');
      setPhone('');
      setPassword('');
      setConfirmPassword('');
      setLoginIdentifier('');
      setError('');
      setSuccessMsg('');
      setLoading(false);
    }
  }, [isOpen]);

  // Load and initialize Google Identity Services
  useEffect(() => {
    if (!isOpen) return;

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "188819967487-2tk0hgu4p5m3eo2npummaqq0523cehh0.apps.googleusercontent.com";

    const initializeGoogleSignIn = () => {
      if (!clientId) {
        console.warn("VITE_GOOGLE_CLIENT_ID environment variable is not defined.");
        return;
      }

      try {
        if (window.google?.accounts?.id) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          const buttonDiv = document.getElementById('google-signin-button-container');
          if (buttonDiv) {
            window.google.accounts.id.renderButton(
              buttonDiv,
              { 
                theme: 'filled_black', 
                size: 'large', 
                text: 'signin_with', 
                width: '320', 
                shape: 'pill' 
              }
            );
          }
        }
      } catch (err) {
        console.error("Failed to initialize Google Sign In:", err);
      }
    };

    if (!document.getElementById('google-gsi-client')) {
      const script = document.createElement('script');
      script.id = 'google-gsi-client';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initializeGoogleSignIn;
      document.body.appendChild(script);
    } else {
      // Small timeout to ensure container is fully rendered in DOM
      const timer = setTimeout(initializeGoogleSignIn, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, mode]);

  const handleGoogleCredentialResponse = async (response: any) => {
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("Authentication server returned a non-JSON response. Please ensure your backend changes are fully deployed and the server is running.");
      }

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        setError(resData.error || 'Google authentication failed.');
        setLoading(false);
        return;
      }
      
      setSuccessMsg('Signed in successfully with Google!');
      setTimeout(() => {
        onSuccess(resData.user);
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error("Google Auth API Error:", err);
      setError(err.message || 'Connection to authentication server failed. Please ensure your backend is deployed.');
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!loginIdentifier.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loginIdentifier: loginIdentifier.trim(),
          password
        })
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        setError(resData.error || 'Invalid credentials. Please try again.');
        setLoading(false);
        return;
      }

      setSuccessMsg('Signed in successfully! Redirecting...');
      setTimeout(() => {
        onSuccess(resData.user);
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setError('Server connection error. Please try again.');
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!email.trim() || !phone.trim() || !password || !confirmPassword) {
      setError('Please fill in all required fields.');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid Gmail address.');
      return;
    }

    if (phone.trim().length < 10) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim(),
          phone: phone.trim(),
          password
        })
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        setError(resData.error || 'Failed to create account.');
        setLoading(false);
        return;
      }

      setSuccessMsg('Account created successfully! Auto-signing you in...');
      setTimeout(() => {
        onSuccess(resData.user);
        onClose();
      }, 1200);
    } catch (err) {
      console.error(err);
      setError('Server connection error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div id="auth-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div id="auth-modal-container" className="relative w-full max-w-md overflow-hidden rounded-2xl glass-card transition-all duration-300 border border-white/10 bg-neutral-900/90 text-white shadow-2xl">
        
        {/* Glow accent top */}
        <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
        
        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex flex-col items-center mb-6 text-center">
            <div className="flex items-center justify-center w-12 h-12 mb-3 bg-white/5 border border-white/10 rounded-full text-white font-black tracking-widest text-sm">
              FL
            </div>
            <h3 className="text-xl font-bold tracking-tight text-white font-sans uppercase">
              FollowLike Everywhere
            </h3>
            <p className="mt-1 text-xs text-neutral-400">Sign in to your account</p>
          </div>

          {/* Tab Selection */}
          <div className="grid grid-cols-2 bg-white/[0.04] p-1 rounded-xl border border-white/5 mb-6">
            <button
              id="auth-tab-signin"
              type="button"
              onClick={() => {
                setMode('signin');
                setError('');
                setSuccessMsg('');
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === 'signin'
                  ? 'bg-white text-black shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              id="auth-tab-signup"
              type="button"
              onClick={() => {
                setMode('signup');
                setError('');
                setSuccessMsg('');
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === 'signup'
                  ? 'bg-white text-black shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Status Messages */}
          {error && (
            <div id="auth-error-block" className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-500/20 text-xs text-red-400 text-center font-medium">
              {error}
            </div>
          )}
          {successMsg && (
            <div id="auth-success-block" className="mb-4 p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/20 text-xs text-emerald-400 text-center font-medium flex items-center justify-center gap-2">
              <CheckCircle className="w-3.5 h-3.5 animate-bounce" />
              {successMsg}
            </div>
          )}

          {/* Form Content */}
          {mode === 'signin' ? (
            <form id="signin-form" onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                  Gmail / Phone Number
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    id="signin-identifier-input"
                    type="text"
                    required
                    disabled={loading}
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="Enter registered Email or Phone"
                    className="w-full pl-9 pr-4 py-2.5 text-xs text-white bg-black/40 border border-white/10 rounded-xl focus:border-white/30 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                  Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    id="signin-password-input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    disabled={loading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2.5 text-xs text-white bg-black/40 border border-white/10 rounded-xl focus:border-white/30 focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  id="signin-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-white text-black font-bold uppercase tracking-widest text-xs rounded-xl hover:bg-neutral-200 active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Signing In...
                    </>
                  ) : (
                    'Verify Credentials'
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form id="signup-form" onSubmit={handleSignUp} className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
              <div>
                <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                  Full Name (Optional)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    id="signup-name-input"
                    type="text"
                    disabled={loading}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Gaurav Beniwal"
                    className="w-full pl-9 pr-4 py-2.5 text-xs text-white bg-black/40 border border-white/10 rounded-xl focus:border-white/30 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                  Gmail Address *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    id="signup-email-input"
                    type="email"
                    required
                    disabled={loading}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="username@gmail.com"
                    className="w-full pl-9 pr-4 py-2.5 text-xs text-white bg-black/40 border border-white/10 rounded-xl focus:border-white/30 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                  Phone Number *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                    <Phone className="w-4 h-4" />
                  </span>
                  <input
                    id="signup-phone-input"
                    type="tel"
                    required
                    disabled={loading}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit number"
                    className="w-full pl-9 pr-4 py-2.5 text-xs text-white bg-black/40 border border-white/10 rounded-xl focus:border-white/30 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                  Password (6+ chars) *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    id="signup-password-input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    disabled={loading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2.5 text-xs text-white bg-black/40 border border-white/10 rounded-xl focus:border-white/30 focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                  Confirm Password *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    id="signup-confirm-password-input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    disabled={loading}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2.5 text-xs text-white bg-black/40 border border-white/10 rounded-xl focus:border-white/30 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  id="signup-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-white text-black font-bold uppercase tracking-widest text-xs rounded-xl hover:bg-neutral-200 active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Generating Secure Profile...
                    </>
                  ) : (
                    'Establish Membership'
                  )}
                </button>
              </div>
            </form>
          )}

          {/* OR separator and Google Sign-In */}
          <div className="my-5 flex items-center justify-center gap-3">
            <div className="h-[1px] flex-1 bg-white/10"></div>
            <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider font-mono">OR CONTINUE WITH</span>
            <div className="h-[1px] flex-1 bg-white/10"></div>
          </div>

          <div className="w-full flex justify-center mb-2">
            <div id="google-signin-button-container" className="flex justify-center w-full min-h-[44px]"></div>
          </div>

          {/* Bottom links */}
          <div className="flex items-center justify-between pt-5 mt-5 border-t border-white/5 text-[10px] text-neutral-500">
            <span className="flex items-center">
              <Shield className="w-3 h-3 mr-1" />
              Secure SHA-256 Auth
            </span>
            <button
              id="auth-cancel-btn"
              type="button"
              onClick={onClose}
              className="hover:underline hover:text-neutral-300 transition-colors"
            >
              Cancel Connection
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
