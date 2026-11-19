import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Palette, Download } from 'lucide-react';
import { FreeWindow, GridSettings, WeeklyFreeHours } from '../types/grid';
import { formatDuration, parseTimeToMinutes } from '../utils/scheduler';
import { getPresetById } from '../utils/theme';

interface FreeHoursViewProps {
  weeklyFreeHours: WeeklyFreeHours;
  todayOverrideWindows: FreeWindow[] | null;
  settings: GridSettings;
  onUpdateWeeklyFreeHours: (updated: WeeklyFreeHours) => void;
  onUpdateTodayOverride: (windows: FreeWindow[] | null) => void;
  onUpdateSettings: (settings: GridSettings) => void;
  onOpenAppearance: () => void;
  onOpenExport?: () => void;
}

const DAYS = [
  { dow: 1, short: 'Mon', full: 'Monday' },
  { dow: 2, short: 'Tue', full: 'Tuesday' },
  { dow: 3, short: 'Wed', full: 'Wednesday' },
  { dow: 4, short: 'Thu', full: 'Thursday' },
  { dow: 5, short: 'Fri', full: 'Friday' },
  { dow: 6, short: 'Sat', full: 'Saturday' },
  { dow: 0, short: 'Sun', full: 'Sunday' },
];

export const FreeHoursView: React.FC<FreeHoursViewProps> = ({
  weeklyFreeHours,
  todayOverrideWindows,
  settings,
  onUpdateWeeklyFreeHours,
  onUpdateTodayOverride,
  onUpdateSettings,
  onOpenAppearance,
  onOpenExport,
}) => {
  const todayDow = new Date().getDay();
  const [selectedDow, setSelectedDow] = useState<number>(todayDow);
  const [newStart, setNewStart] = useState('18:30');
  const [newEnd, setNewEnd] = useState('21:00');
  const [newLabel, setNewLabel] = useState('Focus Window');
  const [windowError, setWindowError] = useState('');

  const [overrideStart, setOverrideStart] = useState('19:00');
  const [overrideEnd, setOverrideEnd] = useState('21:30');

  const activePreset = getPresetById(settings.themePreset);

  const totalWeeklyMinutes = useMemo(() => {
    return Object.values(weeklyFreeHours).reduce((sum, list) => {
      return (
        sum +
        list.reduce(
          (inner, w) => inner + Math.max(0, parseTimeToMinutes(w.end) - parseTimeToMinutes(w.start)),
          0
        )
      );
    }, 0);
  }, [weeklyFreeHours]);

  const currentWindows = weeklyFreeHours[selectedDow] || [];

  const handleAddWindow = (e: React.FormEvent) => {
    e.preventDefault();
    const s = parseTimeToMinutes(newStart);
    const end = parseTimeToMinutes(newEnd);
    if (end - s < 15) {
      setWindowError('Free window must be at least 15 minutes long.');
      return;
    }
    setWindowError('');
    const nextWindow: FreeWindow = {
      id: `fw-${selectedDow}-${Date.now()}`,
      start: newStart,
      end: newEnd,
      label: newLabel.trim() || 'Free Window',
    };
    const updatedDay = [...currentWindows, nextWindow].sort((a, b) => a.start.localeCompare(b.start));
    onUpdateWeeklyFreeHours({
      ...weeklyFreeHours,
      [selectedDow]: updatedDay,
    });
  };

  const handleRemoveWindow = (id: string) => {
    onUpdateWeeklyFreeHours({
      ...weeklyFreeHours,
      [selectedDow]: currentWindows.filter((w) => w.id !== id),
    });
  };

  const handleApplyTodayOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (parseTimeToMinutes(overrideEnd) - parseTimeToMinutes(overrideStart) < 15) return;
    const base = todayOverrideWindows !== null ? todayOverrideWindows : [];
    onUpdateTodayOverride([
      ...base,
      {
        id: `today-${Date.now()}`,
        start: overrideStart,
        end: overrideEnd,
        label: 'Today Custom Slot',
      },
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Appearance & Palette Studio Card */}
      <section className="tactile-card flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3.5">
          <div
            className="comic-btn flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
          >
            <Palette className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-base font-extrabold text-[var(--text-primary)]">
              Appearance & Theme Studio
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              Active preset: <span className="font-bold">{activePreset.name}</span> ·{' '}
              <span className="font-bold">{settings.theme === 'dark' ? 'Night' : 'Day'}</span> · Accent{' '}
              <span className="font-mono font-bold uppercase">{settings.accentColor}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onOpenExport && (
            <button
              type="button"
              onClick={onOpenExport}
              className="comic-btn inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[var(--bg-subtle)] px-4 py-2 text-xs font-extrabold text-[var(--text-primary)]"
            >
              <Download className="h-4 w-4" />
              <span>Export Data</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenAppearance}
            className="comic-btn inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-extrabold"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-contrast)',
            }}
          >
            <Palette className="h-4 w-4" />
            <span>Customize Theme</span>
          </button>
        </div>
      </section>

      {/* Today Quick Override */}
      <section className="tactile-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-extrabold text-[var(--text-primary)]">
              Today’s Free Hours Override
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              Schedule changed unexpectedly today? Override today only without altering your weekly template.
            </p>
          </div>
          {todayOverrideWindows !== null && (
            <button
              type="button"
              onClick={() => onUpdateTodayOverride(null)}
              className="comic-btn min-h-[40px] rounded-xl bg-[var(--bg-subtle)] px-3.5 py-1.5 text-xs font-bold text-[var(--text-primary)]"
            >
              Reset to Weekly Default
            </button>
          )}
        </div>

        {todayOverrideWindows !== null && (
          <div className="mt-3 flex flex-wrap gap-2">
            {todayOverrideWindows.map((w) => (
              <div
                key={w.id}
                className="flex items-center gap-2 rounded-xl border-2 border-[var(--border-subtle)] px-3.5 py-2 font-mono text-xs font-bold"
                style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--text-primary)' }}
              >
                <span>
                  {w.start}–{w.end}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateTodayOverride(todayOverrideWindows.filter((item) => item.id !== w.id))
                  }
                  aria-label="Remove override window"
                  className="hover:text-[#E85454]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleApplyTodayOverride} className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[11px] font-bold text-[var(--text-secondary)]">Start</label>
            <input
              type="time"
              value={overrideStart}
              onChange={(e) => setOverrideStart(e.target.value)}
              className="mt-1 min-h-[44px] rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 font-mono text-xs font-bold text-[var(--text-primary)]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[var(--text-secondary)]">End</label>
            <input
              type="time"
              value={overrideEnd}
              onChange={(e) => setOverrideEnd(e.target.value)}
              className="mt-1 min-h-[44px] rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 font-mono text-xs font-bold text-[var(--text-primary)]"
            />
          </div>
          <button
            type="submit"
            className="comic-btn inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-contrast)',
            }}
          >
            <Plus className="h-4 w-4" />
            <span>Add Today Slot</span>
          </button>
        </form>
      </section>

      {/* Weekly Free Hours Editor */}
      <section className="tactile-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-extrabold text-[var(--text-primary)]">
              Weekly Free Hours Template
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              Total weekly availability:{' '}
              <span className="font-mono font-bold tabular-nums text-[var(--text-primary)]">
                {formatDuration(totalWeeklyMinutes)}
              </span>
            </p>
          </div>
        </div>

        {/* Day Selector Tabs */}
        <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
          {DAYS.map((day) => {
            const count = (weeklyFreeHours[day.dow] || []).length;
            const active = selectedDow === day.dow;
            return (
              <button
                key={day.dow}
                type="button"
                onClick={() => setSelectedDow(day.dow)}
                className={`min-h-[44px] min-w-[68px] flex-1 whitespace-nowrap rounded-xl border-2 px-3 py-2 text-xs font-bold transition-all ${
                  active
                    ? 'border-[var(--border-subtle)] shadow-[2px_2px_0px_var(--border-subtle)]'
                    : 'border-transparent bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
                {day.short} · {count}
              </button>
            );
          })}
        </div>

        {/* Active Day Windows */}
        <div className="mt-4 divide-y-2 divide-[var(--border-subtle)] rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-canvas)]">
          {currentWindows.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-[var(--text-secondary)]">
              No free hours configured for {DAYS.find((d) => d.dow === selectedDow)?.full}.
            </p>
          ) : (
            currentWindows.map((w) => {
              const dur = Math.max(0, parseTimeToMinutes(w.end) - parseTimeToMinutes(w.start));
              return (
                <div key={w.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-mono text-sm font-bold tabular-nums text-[var(--text-primary)]">
                      {w.start} – {w.end}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {w.label || 'Free Window'} · {formatDuration(dur)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveWindow(w.id)}
                    aria-label={`Remove ${w.start} to ${w.end}`}
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Add New Free Window */}
        <form onSubmit={handleAddWindow} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
          <div>
            <label className="block text-[11px] font-bold text-[var(--text-secondary)]">Start time</label>
            <input
              type="time"
              value={newStart}
              onChange={(e) => setNewStart(e.target.value)}
              className="mt-1 min-h-[44px] w-full rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 font-mono text-xs font-bold text-[var(--text-primary)]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[var(--text-secondary)]">End time</label>
            <input
              type="time"
              value={newEnd}
              onChange={(e) => setNewEnd(e.target.value)}
              className="mt-1 min-h-[44px] w-full rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 font-mono text-xs font-bold text-[var(--text-primary)]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[var(--text-secondary)]">Label</label>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g., Evening Sprint"
              className="mt-1 min-h-[44px] w-full rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 text-xs text-[var(--text-primary)]"
            />
          </div>
          <button
            type="submit"
            className="comic-btn inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-contrast)',
            }}
          >
            <Plus className="h-4 w-4" />
            <span>Add Window</span>
          </button>
        </form>
        {windowError && <p className="mt-2 text-xs font-bold text-red-600">{windowError}</p>}
      </section>

      {/* Adaptive Scheduling Rules */}
      <section className="tactile-card p-5">
          <h2 className="font-display text-base font-extrabold text-[var(--text-primary)]">
            Adaptive Scheduling Rules
          </h2>

          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)]">
                  Auto-rearrange missed blocks
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Immediately reschedule skipped or overdue blocks into next free hours.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.autoRearrangeOnMiss}
                onClick={() =>
                  onUpdateSettings({
                    ...settings,
                    autoRearrangeOnMiss: !settings.autoRearrangeOnMiss,
                  })
                }
                className={`flex h-8 w-14 shrink-0 items-center rounded-full border-2 border-[var(--border-subtle)] p-1 transition-colors ${
                  settings.autoRearrangeOnMiss ? 'justify-end' : 'justify-start bg-[var(--bg-subtle)]'
                }`}
                style={
                  settings.autoRearrangeOnMiss
                    ? { backgroundColor: 'var(--accent)' }
                    : undefined
                }
              >
                <span className="h-5 w-5 rounded-full border border-[#141418] bg-white" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)]">
                Break buffer between tasks
              </label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[0, 5, 10, 15, 20].map((mins) => {
                  const active = settings.bufferMinutes === mins;
                  return (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => onUpdateSettings({ ...settings, bufferMinutes: mins })}
                      className={`min-h-[40px] rounded-xl border-2 px-3.5 font-mono text-xs font-bold transition-all ${
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
                      {mins}m
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)]">
                Daily streak goal (tasks/day)
              </label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[1, 2, 3, 4].map((count) => {
                  const active = settings.dailyGoalTasks === count;
                  return (
                    <button
                      key={count}
                      type="button"
                      onClick={() => onUpdateSettings({ ...settings, dailyGoalTasks: count })}
                      className={`min-h-[40px] rounded-xl border-2 px-4 font-mono text-xs font-bold transition-all ${
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
                      {count}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
      </section>
    </div>
  );
};
