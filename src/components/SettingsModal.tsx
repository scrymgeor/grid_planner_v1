import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { sendPasswordResetEmail, updateProfile, User } from 'firebase/auth';
import {
  AlertTriangle,
  Bell,
  BellOff,
  BellRing,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Flame,
  KeyRound,
  LogOut,
  MessageSquare,
  Palette,
  RotateCcw,
  Send,
  Settings,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react';
import { auth } from '../firebase';
import { ThemePresetId } from '../types/grid';
import {
  ACCENT_SWATCHES,
  getContrastForeground,
  normalizeHex,
  normalizePresetAndMode,
  THEME_PRESETS,
} from '../utils/theme';
import {
  AlertLogItem,
  AtRiskTask,
  NotificationPermissionState,
  NotificationPreferences,
} from '../hooks/useDeadlineNotifications';

export type SettingsTabKey = 'account' | 'theme' | 'notifications';

interface SettingsModalProps {
  open: boolean;
  initialTab?: SettingsTabKey;
  onClose: () => void;
  // Account
  user: User;
  onProfileUpdated: () => void;
  onOpenExport: () => void;
  onSignOut: () => void;
  // Theme
  themePreset: ThemePresetId;
  themeMode: 'light' | 'dark';
  accentColor: string;
  onChangeThemePreset: (presetId: ThemePresetId) => void;
  onChangeAccentColor: (hex: string) => void;
  onResetThemeDefaults: () => void;
  // Notifications
  permission: NotificationPermissionState;
  prefs: NotificationPreferences;
  pushSubscribed: boolean;
  atRiskTasks: AtRiskTask[];
  recentAlerts: AlertLogItem[];
  onEnableNotifications: () => Promise<{
    permission: NotificationPermissionState;
    enabled: boolean;
    pushSubscribed: boolean;
  }>;
  onUpdatePrefs: (patch: Partial<NotificationPreferences>) => void;
  onSendTest: () => Promise<{ delivered: boolean; viaBackgroundPush: boolean }>;
  onClearLog: () => void;
  onMarkAlertsRead: () => void;
  onAskEchoAboutTask: (prompt: string) => void;
}

const LEAD_OPTIONS = [
  { minutes: 30, label: '30m' },
  { minutes: 60, label: '1h' },
  { minutes: 120, label: '2h' },
  { minutes: 360, label: '6h' },
  { minutes: 1440, label: '24h' },
];

const HABIT_HOUR_OPTIONS = [
  { hour: 19, label: '7 PM' },
  { hour: 20, label: '8 PM' },
  { hour: 21, label: '9 PM' },
  { hour: 22, label: '10 PM' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  initialTab = 'account',
  onClose,
  user,
  onProfileUpdated,
  onOpenExport,
  onSignOut,
  themePreset,
  themeMode,
  accentColor,
  onChangeThemePreset,
  onChangeAccentColor,
  onResetThemeDefaults,
  permission,
  prefs,
  pushSubscribed,
  atRiskTasks,
  recentAlerts,
  onEnableNotifications,
  onUpdatePrefs,
  onSendTest,
  onClearLog,
  onMarkAlertsRead,
  onAskEchoAboutTask,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTabKey>(initialTab);

  // Account state
  const [nameDraft, setNameDraft] = useState(user.displayName || '');
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [sendingReset, setSendingReset] = useState(false);

  // Theme state
  const [hexDraft, setHexDraft] = useState(accentColor);
  const [hexError, setHexError] = useState('');

  // Notifications state
  const [testing, setTesting] = useState(false);
  const [testFeedback, setTestFeedback] = useState<string | null>(null);

  const normalized = normalizePresetAndMode(themePreset, themeMode);
  const activePresetId = normalized.preset.id;
  const activeMode = normalized.mode;

  const isPasswordUser = user.providerData.some((p) => p.providerId === 'password');
  const userInitial = (user.displayName || user.email || 'G').charAt(0).toUpperCase();

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
      setNameDraft(user.displayName || '');
      setNameSaved(false);
      setAccountMessage(null);
      setHexDraft(accentColor);
      setHexError('');
      if (initialTab === 'notifications') {
        onMarkAlertsRead();
      }
    }
  }, [open, initialTab, user.displayName, accentColor, onMarkAlertsRead]);

  const handleTabChange = (tab: SettingsTabKey) => {
    setActiveTab(tab);
    if (tab === 'notifications') {
      onMarkAlertsRead();
    }
  };

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === (user.displayName || '')) return;
    setSavingName(true);
    setAccountMessage(null);
    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: trimmed });
        onProfileUpdated();
        setNameSaved(true);
        setTimeout(() => setNameSaved(false), 2500);
      }
    } catch {
      setAccountMessage('Could not update your display name right now. Please try again.');
    } finally {
      setSavingName(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user.email) return;
    setSendingReset(true);
    setAccountMessage(null);
    try {
      await sendPasswordResetEmail(auth, user.email);
      setAccountMessage(`Password reset link sent to ${user.email}.`);
    } catch {
      setAccountMessage('Could not send reset email right now. Try again in a moment.');
    } finally {
      setSendingReset(false);
    }
  };

  const handleHexChange = (val: string) => {
    setHexDraft(val);
    const valid = normalizeHex(val);
    if (valid) {
      setHexError('');
      onChangeAccentColor(valid);
    } else if (val.replace(/^#/, '').length >= 6) {
      setHexError('Enter a valid 6-digit hex color (e.g. #E3242B).');
    } else {
      setHexError('');
    }
  };

  const handleToggleMaster = async () => {
    if (!prefs.enabled) {
      await onEnableNotifications();
    } else {
      onUpdatePrefs({ enabled: false });
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestFeedback(null);
    const { delivered, viaBackgroundPush } = await onSendTest();
    setTesting(false);
    setTestFeedback(
      viaBackgroundPush
        ? 'Test reminder sent — alerts will reach you even when Grid is closed.'
        : delivered
        ? 'Test reminder sent!'
        : 'Test reminder shown! Add Grid to your home screen for lock-screen alerts.'
    );
    setTimeout(() => setTestFeedback(null), 4500);
  };

  const tabs: {
    key: SettingsTabKey;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }[] = [
    { key: 'account', label: 'Account', icon: UserIcon },
    { key: 'theme', label: 'Theme', icon: Palette },
    {
      key: 'notifications',
      label: 'Notifications',
      icon: prefs.enabled ? BellRing : Bell,
      badge: atRiskTasks.length,
    },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-xs sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-modal-title"
        >
          <motion.div
            initial={{ y: 32, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="tactile-card scrollbar-sleek flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl sm:rounded-2xl"
          >
            {/* Fixed Header + Tab Bar */}
            <div className="shrink-0 border-b-2 border-[var(--border-subtle)] bg-[var(--bg-surface)] px-5 pb-4 pt-4 sm:px-6 sm:pt-5">
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[var(--border-subtle)]/30 sm:hidden" />

              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="comic-btn flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
                  >
                    <Settings className="h-5 w-5" />
                  </div>
                  <div>
                    <h2
                      id="settings-modal-title"
                      className="font-display text-lg font-extrabold text-[var(--text-primary)]"
                    >
                      Settings
                    </h2>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Manage your account, theme, and deadline reminders
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close settings"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* 3-Tab Segmented Switcher */}
              <div
                className="mt-4 grid grid-cols-3 gap-1.5 rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-1"
                role="tablist"
                aria-label="Settings sections"
              >
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => handleTabChange(tab.key)}
                      className={`relative flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-extrabold transition-all ${
                        active
                          ? 'border-2 border-[var(--border-subtle)] shadow-[2px_2px_0px_var(--border-subtle)]'
                          : 'border-2 border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                      style={
                        active
                          ? { backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }
                          : undefined
                      }
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{tab.label}</span>
                      {tab.badge && tab.badge > 0 ? (
                        <span
                          className={`ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 font-mono text-[10px] font-extrabold ${
                            active
                              ? 'bg-white/25 text-current'
                              : 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                          }`}
                        >
                          {tab.badge > 9 ? '9+' : tab.badge}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scrollable Tab Body */}
            <div className="scrollbar-sleek flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              {/* ACCOUNT TAB */}
              {activeTab === 'account' && (
                <div className="space-y-4">
                  {/* Profile Card */}
                  <div className="rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-4">
                    <div className="flex items-center gap-3.5">
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt={user.displayName || 'Account avatar'}
                          referrerPolicy="no-referrer"
                          className="h-12 w-12 shrink-0 rounded-xl border-2 border-[var(--border-subtle)] object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-[var(--border-subtle)] font-display text-lg font-extrabold"
                          style={{
                            backgroundColor: 'var(--accent)',
                            color: 'var(--accent-contrast)',
                          }}
                        >
                          {userInitial}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-base font-extrabold text-[var(--text-primary)]">
                          {user.displayName || 'Grid User'}
                        </p>
                        <p className="truncate text-xs text-[var(--text-secondary)]">{user.email}</p>
                        <p className="mt-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                          {isPasswordUser ? 'Email & Password account' : 'Google account'} · Verified
                        </p>
                      </div>
                    </div>

                    {/* Display Name Editor */}
                    <form onSubmit={handleSaveName} className="mt-4 border-t-2 border-[var(--border-subtle)]/20 pt-3.5">
                      <label
                        htmlFor="settings-display-name"
                        className="block text-xs font-bold text-[var(--text-primary)]"
                      >
                        Display Name
                      </label>
                      <div className="mt-1.5 flex items-center gap-2">
                        <input
                          id="settings-display-name"
                          type="text"
                          value={nameDraft}
                          onChange={(e) => setNameDraft(e.target.value)}
                          placeholder="Your name"
                          maxLength={50}
                          className="min-h-[42px] flex-1 rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-xs font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                        />
                        <button
                          type="submit"
                          disabled={
                            savingName ||
                            !nameDraft.trim() ||
                            nameDraft.trim() === (user.displayName || '')
                          }
                          className="comic-btn inline-flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-xl px-4 text-xs font-extrabold disabled:opacity-45"
                          style={{
                            backgroundColor: nameSaved ? '#168A45' : 'var(--accent)',
                            color: '#FFFFFF',
                          }}
                        >
                          {nameSaved ? (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              <span>Saved</span>
                            </>
                          ) : (
                            <span>{savingName ? 'Saving…' : 'Save'}</span>
                          )}
                        </button>
                      </div>
                    </form>

                    {isPasswordUser && (
                      <div className="mt-3 flex items-center justify-between gap-3 border-t-2 border-[var(--border-subtle)]/20 pt-3">
                        <div>
                          <p className="text-xs font-bold text-[var(--text-primary)]">Password</p>
                          <p className="text-[11px] text-[var(--text-secondary)]">
                            Send a password reset link to your email
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handlePasswordReset}
                          disabled={sendingReset}
                          className="comic-btn inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-xl bg-[var(--bg-surface)] px-3 text-xs font-bold text-[var(--text-primary)] disabled:opacity-60"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          <span>{sendingReset ? 'Sending…' : 'Reset'}</span>
                        </button>
                      </div>
                    )}

                    {accountMessage && (
                      <p className="mt-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        {accountMessage}
                      </p>
                    )}
                  </div>

                  {/* Export & Backup Card */}
                  <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-[var(--text-primary)]">
                        Export & Backup
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                        Download your calendar (.ics), habit streaks, tasks, or full backup file.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenExport();
                      }}
                      className="comic-btn inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl bg-[var(--bg-surface)] px-3.5 text-xs font-bold text-[var(--text-primary)]"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Export</span>
                    </button>
                  </div>

                  {/* Sign Out */}
                  <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-4">
                    <div>
                      <p className="text-sm font-extrabold text-[var(--text-primary)]">Sign Out</p>
                      <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                        Your tasks, habits, and schedule stay saved to your account.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onSignOut();
                      }}
                      className="comic-btn inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl bg-red-600 px-4 text-xs font-extrabold text-white"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}

              {/* THEME TAB */}
              {activeTab === 'theme' && (
                <div className="space-y-5">
                  {/* Live Card Preview */}
                  <div
                    className="rounded-xl border-2 border-[var(--border-subtle)] p-4 transition-colors"
                    style={{ backgroundColor: 'var(--bg-canvas)' }}
                  >
                    <p className="mb-2 text-[11px] font-bold text-[var(--text-secondary)]">
                      Live look · {activeMode === 'dark' ? 'Night' : 'Day'}
                    </p>
                    <div className="tactile-card flex items-center justify-between gap-3 p-3.5">
                      <div>
                        <p className="text-sm font-bold text-[var(--text-primary)]">
                          Morning Deep Work Sprint
                        </p>
                        <p className="mt-0.5 font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                          08:00 AM · High priority · 60m
                        </p>
                      </div>
                      <span
                        className="comic-btn inline-flex min-h-[36px] items-center rounded-xl px-3.5 text-xs font-extrabold"
                        style={{
                          backgroundColor: 'var(--accent)',
                          color: 'var(--accent-contrast)',
                        }}
                      >
                        Focus
                      </span>
                    </div>
                  </div>

                  {/* Theme Presets */}
                  <div>
                    <p className="text-xs font-bold text-[var(--text-primary)]">Theme Preset</p>
                    <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {THEME_PRESETS.map((preset) => {
                        const selected = preset.id === activePresetId;
                        const palette = activeMode === 'dark' ? preset.night : preset.day;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                              onChangeThemePreset(preset.id);
                              onChangeAccentColor(preset.defaultAccent);
                            }}
                            className="flex min-h-[68px] items-center justify-between gap-3 rounded-xl border-2 p-3.5 text-left transition-transform active:scale-[0.98]"
                            style={{
                              backgroundColor: palette.surface,
                              borderColor: selected ? accentColor : palette.border,
                              boxShadow: preset.isComic
                                ? `3px 3px 0px ${palette.shadowColor}`
                                : undefined,
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2"
                                style={{
                                  backgroundColor: palette.canvas,
                                  borderColor: palette.border,
                                }}
                              >
                                <span
                                  className="h-4 w-4 rounded-sm border border-[#141923]"
                                  style={{
                                    backgroundColor: selected ? accentColor : preset.defaultAccent,
                                  }}
                                />
                              </div>
                              <div>
                                <p className="text-xs font-bold" style={{ color: palette.textPrimary }}>
                                  {preset.name}
                                </p>
                                <p
                                  className="mt-0.5 text-[11px]"
                                  style={{ color: palette.textSecondary }}
                                >
                                  {preset.subtitle}
                                </p>
                              </div>
                            </div>
                            {selected && (
                              <span
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-[#141923]"
                                style={{
                                  backgroundColor: 'var(--accent)',
                                  color: 'var(--accent-contrast)',
                                }}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Accent Color Swatches + Custom Hex */}
                  <div>
                    <p className="text-xs font-bold text-[var(--text-primary)]">Accent Color</p>
                    <div className="mt-2.5 grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {ACCENT_SWATCHES.map((swatch) => {
                        const active = accentColor.toUpperCase() === swatch.hex.toUpperCase();
                        return (
                          <button
                            key={swatch.hex}
                            type="button"
                            onClick={() => onChangeAccentColor(swatch.hex)}
                            aria-label={`Select ${swatch.name} accent`}
                            className="flex min-h-[50px] flex-col items-center justify-center gap-1 rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-2 transition-transform active:scale-95"
                            style={
                              active
                                ? {
                                    boxShadow: '2px 2px 0px var(--border-subtle)',
                                    backgroundColor: 'var(--bg-surface)',
                                  }
                                : undefined
                            }
                          >
                            <span
                              className="flex h-6 w-6 items-center justify-center rounded-md border border-[#141923]"
                              style={{
                                backgroundColor: swatch.hex,
                                color: getContrastForeground(swatch.hex),
                              }}
                            >
                              {active && <Check className="h-3.5 w-3.5" />}
                            </span>
                            <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                              {swatch.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-3 flex items-center gap-2.5">
                      <label
                        htmlFor="settings-custom-accent-picker"
                        className="relative flex h-11 w-12 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-[var(--border-subtle)]"
                        style={{ backgroundColor: accentColor }}
                      >
                        <input
                          id="settings-custom-accent-picker"
                          type="color"
                          value={normalizeHex(accentColor) || '#E3242B'}
                          onChange={(e) => handleHexChange(e.target.value)}
                          aria-label="Pick custom accent color"
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        />
                      </label>
                      <input
                        type="text"
                        value={hexDraft}
                        onChange={(e) => handleHexChange(e.target.value)}
                        placeholder="#E3242B"
                        aria-label="Custom hex color code"
                        className="min-h-[44px] flex-1 rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3.5 font-mono text-xs font-bold uppercase text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                      />
                    </div>
                    {hexError && <p className="mt-1.5 text-xs font-medium text-red-600">{hexError}</p>}
                  </div>

                  <div className="flex justify-start border-t-2 border-[var(--border-subtle)] pt-4">
                    <button
                      type="button"
                      onClick={onResetThemeDefaults}
                      className="comic-btn inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[var(--bg-subtle)] px-4 py-2 text-xs font-bold text-[var(--text-primary)]"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Reset Default Theme</span>
                    </button>
                  </div>
                </div>
              )}

              {/* NOTIFICATIONS TAB */}
              {activeTab === 'notifications' && (
                <div className="space-y-4">
                  {/* Master Notification Toggle Card */}
                  <div className="rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-[var(--text-primary)]">
                          {prefs.enabled ? 'Notifications On' : 'Enable Notifications'}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                          {pushSubscribed && prefs.enabled
                            ? 'You’ll get lock-screen reminders even when Grid is closed.'
                            : permission === 'granted'
                            ? 'Notifications are enabled on this device.'
                            : permission === 'denied'
                            ? 'Notifications are blocked in your browser settings. You’ll still see reminders inside Grid.'
                            : permission === 'unsupported'
                            ? 'Lock-screen alerts aren’t supported on this browser, so you’ll see reminders inside Grid.'
                            : 'Turn on notifications to get reminders before deadlines, even when Grid is closed.'}
                        </p>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={prefs.enabled}
                        aria-label="Toggle deadline notifications"
                        onClick={handleToggleMaster}
                        className={`flex h-8 w-14 shrink-0 items-center rounded-full border-2 border-[var(--border-subtle)] p-1 transition-colors ${
                          prefs.enabled ? 'justify-end' : 'justify-start bg-[var(--bg-subtle)]'
                        }`}
                        style={prefs.enabled ? { backgroundColor: 'var(--accent)' } : undefined}
                      >
                        <span className="h-5 w-5 rounded-full border border-[#141923] bg-white" />
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {permission === 'default' && (
                        <button
                          type="button"
                          onClick={onEnableNotifications}
                          className="comic-btn inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold"
                          style={{
                            backgroundColor: 'var(--accent)',
                            color: 'var(--accent-contrast)',
                          }}
                        >
                          <BellRing className="h-3.5 w-3.5" />
                          <span>Allow Notifications</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleTest}
                        disabled={testing}
                        className="comic-btn inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[var(--bg-surface)] px-3.5 py-2 text-xs font-bold text-[var(--text-primary)] disabled:opacity-60"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>{testing ? 'Sending…' : 'Send Test Reminder'}</span>
                      </button>
                    </div>

                    {testFeedback && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        <span>{testFeedback}</span>
                      </p>
                    )}
                  </div>

                  {/* Live At-Risk Deadlines */}
                  <div>
                    <h3 className="font-display text-sm font-extrabold text-[var(--text-primary)]">
                      Deadlines At Risk Now ({atRiskTasks.length})
                    </h3>

                    {atRiskTasks.length === 0 ? (
                      <div className="mt-2 flex items-center gap-2.5 rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3.5 py-3 text-xs font-medium text-[var(--text-secondary)]">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span>All clear — no deadlines are currently in danger of slipping.</span>
                      </div>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {atRiskTasks.slice(0, 5).map((item) => {
                          const isDanger = item.severity === 'missed' || item.severity === 'urgent';
                          return (
                            <div
                              key={item.task.id}
                              className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-[var(--border-subtle)] p-3 ${
                                isDanger
                                  ? 'bg-red-50 text-red-950 dark:bg-red-950/50 dark:text-red-100'
                                  : 'bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                  <p className="truncate text-xs font-extrabold">{item.task.title}</p>
                                </div>
                                <p className="mt-0.5 font-mono text-[11px] font-semibold opacity-85">
                                  {item.label}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  onAskEchoAboutTask(
                                    `I'm at risk of missing "${item.task.title}" (${item.label}). Please rearrange my schedule to prioritize it.`
                                  );
                                  onClose();
                                }}
                                className="comic-btn inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] font-extrabold text-[var(--text-primary)]"
                              >
                                <MessageSquare className="h-3 w-3" />
                                <span>Ask Echo</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Notification Rules */}
                  <div className="space-y-4 border-t-2 border-[var(--border-subtle)] pt-4">
                    <h3 className="font-display text-sm font-extrabold text-[var(--text-primary)]">
                      Reminder Rules
                    </h3>

                    {/* Lead Time */}
                    <div>
                      <label className="block text-xs font-bold text-[var(--text-secondary)]">
                        Warn me before a task deadline
                      </label>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {LEAD_OPTIONS.map((opt) => {
                          const active = prefs.deadlineLeadMinutes === opt.minutes;
                          return (
                            <button
                              key={opt.minutes}
                              type="button"
                              onClick={() => onUpdatePrefs({ deadlineLeadMinutes: opt.minutes })}
                              className={`min-h-[38px] rounded-xl border-2 px-3 font-mono text-xs font-bold transition-all ${
                                active
                                  ? 'border-[var(--border-subtle)] shadow-[2px_2px_0px_var(--border-subtle)]'
                                  : 'border-transparent bg-[var(--bg-subtle)] text-[var(--text-primary)]'
                              }`}
                              style={
                                active
                                  ? {
                                      backgroundColor: 'var(--accent)',
                                      color: 'var(--accent-contrast)',
                                    }
                                  : undefined
                              }
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Smart At-Risk & Urgent Warnings */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          <span>Smart “about to miss” & 15m final warnings</span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                          Alerts early if time left is shorter than the task’s duration, plus missed
                          deadlines.
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={prefs.urgentAndAtRiskAlerts}
                        onClick={() =>
                          onUpdatePrefs({ urgentAndAtRiskAlerts: !prefs.urgentAndAtRiskAlerts })
                        }
                        className={`flex h-7 w-12 shrink-0 items-center rounded-full border-2 border-[var(--border-subtle)] p-0.5 transition-colors ${
                          prefs.urgentAndAtRiskAlerts
                            ? 'justify-end'
                            : 'justify-start bg-[var(--bg-subtle)]'
                        }`}
                        style={
                          prefs.urgentAndAtRiskAlerts
                            ? { backgroundColor: 'var(--accent)' }
                            : undefined
                        }
                      >
                        <span className="h-4 w-4 rounded-full border border-[#141923] bg-white" />
                      </button>
                    </div>

                    {/* Block Start Reminders */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                          <Clock className="h-3.5 w-3.5 text-sky-500" />
                          <span>Focus block start & missed-slot reminders</span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                          Ping 10m before a scheduled block begins, or if you miss a block.
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={prefs.blockReminders}
                        onClick={() => onUpdatePrefs({ blockReminders: !prefs.blockReminders })}
                        className={`flex h-7 w-12 shrink-0 items-center rounded-full border-2 border-[var(--border-subtle)] p-0.5 transition-colors ${
                          prefs.blockReminders
                            ? 'justify-end'
                            : 'justify-start bg-[var(--bg-subtle)]'
                        }`}
                        style={prefs.blockReminders ? { backgroundColor: 'var(--accent)' } : undefined}
                      >
                        <span className="h-4 w-4 rounded-full border border-[#141923] bg-white" />
                      </button>
                    </div>

                    {/* Evening Habit Nudge */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                            <Flame className="h-3.5 w-3.5 text-orange-500" />
                            <span>Evening habit streak nudge</span>
                          </p>
                          <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                            Reminds you if any habits are still unchecked before the day ends.
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={prefs.habitReminderEnabled}
                          onClick={() =>
                            onUpdatePrefs({ habitReminderEnabled: !prefs.habitReminderEnabled })
                          }
                          className={`flex h-7 w-12 shrink-0 items-center rounded-full border-2 border-[var(--border-subtle)] p-0.5 transition-colors ${
                            prefs.habitReminderEnabled
                              ? 'justify-end'
                              : 'justify-start bg-[var(--bg-subtle)]'
                          }`}
                          style={
                            prefs.habitReminderEnabled
                              ? { backgroundColor: 'var(--accent)' }
                              : undefined
                          }
                        >
                          <span className="h-4 w-4 rounded-full border border-[#141923] bg-white" />
                        </button>
                      </div>

                      {prefs.habitReminderEnabled && (
                        <div className="flex flex-wrap gap-1.5 pl-5">
                          {HABIT_HOUR_OPTIONS.map((opt) => {
                            const active = prefs.habitReminderHour === opt.hour;
                            return (
                              <button
                                key={opt.hour}
                                type="button"
                                onClick={() => onUpdatePrefs({ habitReminderHour: opt.hour })}
                                className={`min-h-[34px] rounded-lg border-2 px-2.5 font-mono text-[11px] font-bold transition-all ${
                                  active
                                    ? 'border-[var(--border-subtle)] shadow-[2px_2px_0px_var(--border-subtle)]'
                                    : 'border-transparent bg-[var(--bg-subtle)] text-[var(--text-secondary)]'
                                }`}
                                style={
                                  active
                                    ? {
                                        backgroundColor: 'var(--accent)',
                                        color: 'var(--accent-contrast)',
                                      }
                                    : undefined
                                }
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Recent Reminders Feed */}
                  <div className="border-t-2 border-[var(--border-subtle)] pt-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-sm font-extrabold text-[var(--text-primary)]">
                        Recent Reminders
                      </h3>
                      {recentAlerts.length > 0 && (
                        <button
                          type="button"
                          onClick={onClearLog}
                          className="inline-flex items-center gap-1 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Clear</span>
                        </button>
                      )}
                    </div>

                    {recentAlerts.length === 0 ? (
                      <div className="mt-2 flex items-center gap-2 rounded-xl border-2 border-dashed border-[var(--border-subtle)]/40 px-3.5 py-4 text-xs text-[var(--text-secondary)]">
                        <BellOff className="h-4 w-4 shrink-0 opacity-60" />
                        <span>No reminders triggered yet. Try “Send Test Reminder” above!</span>
                      </div>
                    ) : (
                      <div className="mt-2 max-h-44 space-y-2 overflow-y-auto pr-1">
                        {recentAlerts.slice(0, 10).map((alert) => (
                          <div
                            key={alert.id}
                            className="rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 py-2.5 text-xs"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-extrabold text-[var(--text-primary)]">
                                {alert.title}
                              </p>
                              <span className="shrink-0 font-mono text-[10px] font-semibold text-[var(--text-secondary)]">
                                {new Date(alert.timestamp).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                              {alert.body}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
