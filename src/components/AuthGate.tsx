import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LogOut,
  Mail,
  Moon,
  RefreshCw,
  Sun,
} from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import {
  CoffeeCatSticker,
  PeekingCatSticker,
} from './CatStickers';

type AuthMode = 'signin' | 'signup' | 'forgot';

interface AuthGateProps {
  authError?: string | null;
  themeMode: 'light' | 'dark';
  onToggleThemeMode: () => void;
  unverifiedUser?: User | null;
  onRefreshVerification?: () => Promise<void>;
}

function mapAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'Google sign-in popup was closed before finishing.';
    case 'auth/popup-blocked':
      return 'Popup was blocked by your browser. Please allow popups and retry.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password. Try again or reset your password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Switch to Sign In.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters long.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a moment and try again.';
    case 'auth/operation-not-allowed':
      return 'Email sign-in is temporarily unavailable. Please try again or continue with Google.';
    default:
      return 'Could not sign in right now. Please check your details and try again.';
  }
}

export const AuthGate: React.FC<AuthGateProps> = ({
  authError,
  themeMode,
  onToggleThemeMode,
  unverifiedUser,
  onRefreshVerification,
}) => {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [buttonHovered, setButtonHovered] = useState(false);
  const [error, setError] = useState<string | null>(authError || null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleModeSwitch = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError(null);
    setNotice(null);
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      if (mode === 'forgot') {
        await sendPasswordResetEmail(auth, cleanEmail);
        setNotice(`Password reset link sent to ${cleanEmail}. Check your inbox or spam folder.`);
      } else if (mode === 'signup') {
        if (password.length < 6) {
          setError('Password must be at least 6 characters long.');
          setIsSubmitting(false);
          return;
        }
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        if (displayName.trim()) {
          await updateProfile(cred.user, { displayName: displayName.trim().slice(0, 60) });
        }
        await sendEmailVerification(cred.user);
        setNotice(`Verification link sent to ${cleanEmail}.`);
      } else {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
      }
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    if (!unverifiedUser) return;
    setIsSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await sendEmailVerification(unverifiedUser);
      setNotice(`Verification link re-sent to ${unverifiedUser.email}.`);
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckVerified = async () => {
    if (!onRefreshVerification) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onRefreshVerification();
      if (auth.currentUser && !auth.currentUser.emailVerified) {
        setError('Your email is not verified yet. Open the link in your inbox, then tap Continue.');
      }
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOutUnverified = async () => {
    setIsSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await signOut(auth);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[var(--bg-canvas)] px-4 py-3 text-[var(--text-primary)]">
      {/* Single Unified Auth Box (Fits 1 Mobile Screen Without Scrolling) */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        className="tactile-card relative z-10 w-full max-w-[430px] p-4 sm:p-6"
      >
        {/* Top Row: Brand + Day/Night Toggle */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <img
              src="/icon.svg"
              alt="Grid logo"
              className="h-10 w-10 shrink-0 drop-shadow-[2px_2px_0px_var(--border-subtle)]"
            />
            <div>
              <span className="font-display text-xl font-extrabold tracking-tight text-[var(--text-primary)]">
                GRID
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleThemeMode}
            aria-label={themeMode === 'dark' ? 'Switch to Day mode' : 'Switch to Night mode'}
            title={themeMode === 'dark' ? 'Switch to Day mode' : 'Switch to Night mode'}
            className="comic-btn inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--bg-subtle)] text-[var(--text-primary)]"
          >
            {themeMode === 'dark' ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Compact Pixel Arcade Banner + Cat Stickers */}
        <div className="relative mt-3">
          <div className="absolute -bottom-3 -left-2 z-20">
            <CoffeeCatSticker className="h-11 w-11 sm:h-12 sm:w-12" />
          </div>
          <div className="absolute -right-1 -top-4 z-20">
            <PeekingCatSticker
              className="h-9 w-14 sm:h-10 sm:w-16"
              perked={buttonHovered || isSubmitting}
            />
          </div>
          <div className="overflow-hidden rounded-xl border-2 border-[var(--border-subtle)] bg-[#2864E6] shadow-[3px_3px_0px_var(--border-subtle)]">
            <img
              src="/assets/aistudio/image_41cb3d53.png"
              alt="Hop In pixel-art mountain scene with character and cat"
              referrerPolicy="no-referrer"
              className="h-24 w-full object-cover object-center [image-rendering:pixelated] sm:h-28"
            />
          </div>
        </div>

        {unverifiedUser ? (
          /* Email Verification Gate Inside Same Box */
          <div className="mt-4 space-y-3">
            <div className="flex items-start gap-2.5 rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3.5">
              <Mail className="mt-0.5 h-5 w-5 shrink-0" style={{ color: 'var(--accent)' }} />
              <div className="min-w-0">
                <h1 className="font-display text-base font-extrabold text-[var(--text-primary)]">
                  Verify your email
                </h1>
                <p className="mt-0.5 truncate text-xs font-semibold text-[var(--text-secondary)]">
                  Link sent to {unverifiedUser.email}
                </p>
              </div>
            </div>

            {notice && (
              <div className="flex items-start gap-2 rounded-xl border-2 border-[var(--border-subtle)] bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{notice}</span>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border-2 border-[var(--border-subtle)] bg-red-100 p-2.5 text-xs font-medium text-red-900 dark:bg-red-950/60 dark:text-red-200"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleCheckVerified}
              disabled={isSubmitting}
              className="comic-btn flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold disabled:opacity-60"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-contrast)',
              }}
            >
              <RefreshCw className="h-4 w-4" />
              <span>{isSubmitting ? 'Checking…' : 'I’ve Verified — Continue'}</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={isSubmitting}
                className="comic-btn min-h-[40px] rounded-xl bg-[var(--bg-subtle)] px-3 py-2 text-xs font-bold text-[var(--text-primary)]"
              >
                Resend Email
              </button>
              <button
                type="button"
                onClick={handleSignOutUnverified}
                disabled={isSubmitting}
                className="comic-btn inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-[var(--bg-surface)] px-3 py-2 text-xs font-bold text-[var(--text-primary)]"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Switch Account</span>
              </button>
            </div>
          </div>
        ) : (
          /* Standard Single-Box Auth Form */
          <div className="mt-3.5">
            {mode !== 'forgot' ? (
              <div className="grid grid-cols-2 gap-1 rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-1">
                <button
                  type="button"
                  onClick={() => handleModeSwitch('signin')}
                  className={`min-h-[36px] rounded-lg text-xs font-extrabold transition-colors ${
                    mode === 'signin'
                      ? 'shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  style={
                    mode === 'signin'
                      ? { backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }
                      : undefined
                  }
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => handleModeSwitch('signup')}
                  className={`min-h-[36px] rounded-lg text-xs font-extrabold transition-colors ${
                    mode === 'signup'
                      ? 'shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  style={
                    mode === 'signup'
                      ? { backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }
                      : undefined
                  }
                >
                  Create Account
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <h1 className="font-display text-base font-extrabold text-[var(--text-primary)]">
                  Reset Password
                </h1>
                <button
                  type="button"
                  onClick={() => handleModeSwitch('signin')}
                  className="text-xs font-bold underline underline-offset-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Back to Sign In
                </button>
              </div>
            )}

            <form onSubmit={handleEmailAuth} className="mt-3 space-y-2.5">
              {mode === 'signup' && (
                <input
                  type="text"
                  autoComplete="name"
                  maxLength={60}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  aria-label="Full name"
                  className="min-h-[42px] w-full rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3.5 text-sm font-medium text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                />
              )}

              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                aria-label="Email address"
                className="min-h-[42px] w-full rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3.5 text-sm font-medium text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              />

              {mode !== 'forgot' && (
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'signup' ? 'Create password (6+ chars)' : 'Password'}
                    aria-label="Password"
                    className="min-h-[42px] w-full rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-canvas)] pl-3.5 pr-11 text-sm font-medium text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              )}

              {mode === 'signin' && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleModeSwitch('forgot')}
                    className="text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {(error || authError) && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border-2 border-[var(--border-subtle)] bg-red-100 p-2.5 text-xs font-medium text-red-900 dark:bg-red-950/60 dark:text-red-200"
                >
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{error || authError}</span>
                </div>
              )}

              {notice && (
                <div
                  role="status"
                  className="flex items-start gap-2 rounded-xl border-2 border-[var(--border-subtle)] bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                >
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{notice}</span>
                </div>
              )}

              <motion.button
                type="submit"
                whileTap={{ x: 2, y: 2 }}
                onMouseEnter={() => setButtonHovered(true)}
                onMouseLeave={() => setButtonHovered(false)}
                disabled={isSubmitting}
                className="comic-btn flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold disabled:opacity-60"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-contrast)',
                }}
              >
                <span>
                  {isSubmitting
                    ? 'Please wait…'
                    : mode === 'forgot'
                    ? 'Send Password Reset Link'
                    : mode === 'signup'
                    ? 'Create Account'
                    : 'Sign In'}
                </span>
                {!isSubmitting && <ArrowRight className="h-4 w-4" />}
              </motion.button>
            </form>

            {/* Divider + Google OAuth */}
            <div className="my-3 flex items-center gap-3">
              <div className="h-0.5 flex-1 bg-[var(--border-subtle)]/20" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                or
              </span>
              <div className="h-0.5 flex-1 bg-[var(--border-subtle)]/20" />
            </div>

            <motion.button
              type="button"
              whileTap={{ x: 2, y: 2 }}
              onClick={handleGoogleSignIn}
              disabled={isSubmitting}
              className="comic-btn flex min-h-[44px] w-full items-center justify-center gap-2.5 rounded-xl bg-[var(--bg-subtle)] px-4 py-2.5 text-xs font-extrabold text-[var(--text-primary)] disabled:opacity-60"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z"
                />
              </svg>
              <span>Continue with Google</span>
            </motion.button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
