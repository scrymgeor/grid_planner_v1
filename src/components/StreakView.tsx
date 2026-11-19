import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Flame,
  Pencil,
  Plus,
  Sparkles,
  Target,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import {
  DailyHistoryMap,
  Habit,
  HabitCategory,
  StreakSummary,
} from '../types/grid';
import {
  addDaysToDateStr,
  calculateHabitStreak,
  formatDuration,
  toLocalDateString,
} from '../utils/scheduler';
import { StarCatSticker } from './CatStickers';

interface StreakViewProps {
  habits: Habit[];
  taskStreak: StreakSummary;
  dailyHistory: DailyHistoryMap;
  onSaveHabit: (habit: {
    id?: string;
    title: string;
    category: HabitCategory;
    targetLabel: string;
    color: string;
  }) => void;
  onToggleHabitDate: (habitId: string, dateStr: string) => void;
  onDeleteHabit: (habitId: string) => void;
  onLoadStarterHabits?: () => void;
  onOpenExport?: () => void;
}

const HABIT_CATEGORIES: HabitCategory[] = ['Coding', 'Fitness', 'Study', 'Wellness', 'Other'];

const HABIT_COLORS = [
  { hex: '#E3242B', name: 'Arcade Red' },
  { hex: '#36D96B', name: 'Mint Green' },
  { hex: '#2596EB', name: 'Sky Blue' },
  { hex: '#F59E0B', name: 'Amber' },
  { hex: '#8B5CF6', name: 'Violet' },
  { hex: '#EC4899', name: 'Pink' },
];

const QUICK_TEMPLATES: {
  title: string;
  category: HabitCategory;
  targetLabel: string;
  color: string;
}[] = [
  { title: 'LeetCode Daily', category: 'Coding', targetLabel: '1 problem / day', color: '#E3242B' },
  { title: 'Gym & Strength', category: 'Fitness', targetLabel: '45 min workout', color: '#36D96B' },
  { title: 'Deep Reading', category: 'Study', targetLabel: '20 pages', color: '#2596EB' },
  { title: 'System Design', category: 'Coding', targetLabel: '30 min study', color: '#8B5CF6' },
  { title: 'Morning Walk', category: 'Wellness', targetLabel: '8,000 steps', color: '#F59E0B' },
];

export const StreakView: React.FC<StreakViewProps> = ({
  habits,
  taskStreak,
  dailyHistory,
  onSaveHabit,
  onToggleHabitDate,
  onDeleteHabit,
  onLoadStarterHabits,
  onOpenExport,
}) => {
  const todayStr = toLocalDateString();
  const [selectedDay, setSelectedDay] = useState<string>(todayStr);
  const [matrixHabitFilter, setMatrixHabitFilter] = useState<string>('all');
  const [showTaskStats, setShowTaskStats] = useState(false);

  // Add / Edit Habit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<HabitCategory>('Coding');
  const [targetLabel, setTargetLabel] = useState('');
  const [color, setColor] = useState('#E3242B');
  const [formError, setFormError] = useState<string | null>(null);

  const activeHabits = useMemo(() => habits.filter((h) => !h.archived), [habits]);

  const habitsWithStats = useMemo(() => {
    return activeHabits.map((habit) => ({
      habit,
      stats: calculateHabitStreak(habit.completedDates, todayStr),
    }));
  }, [activeHabits, todayStr]);

  const summary = useMemo(() => {
    let topCurrentStreak = 0;
    let topBestStreak = 0;
    let totalCheckins = 0;
    let doneTodayCount = 0;

    for (const item of habitsWithStats) {
      if (item.stats.currentStreak > topCurrentStreak) topCurrentStreak = item.stats.currentStreak;
      if (item.stats.bestStreak > topBestStreak) topBestStreak = item.stats.bestStreak;
      totalCheckins += item.stats.totalCheckins;
      if (item.stats.doneToday) doneTodayCount++;
    }

    return {
      topCurrentStreak,
      topBestStreak,
      totalCheckins,
      doneTodayCount,
      totalHabits: activeHabits.length,
    };
  }, [habitsWithStats, activeHabits.length]);

  const last7Days = useMemo(() => {
    return Array.from({ length: 7 }, (_, idx) => {
      const offset = idx - 6;
      const dateStr = addDaysToDateStr(todayStr, offset);
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return {
        dateStr,
        shortDay: dt.toLocaleDateString('en-US', { weekday: 'narrow' }),
        dayNum: d,
        isToday: dateStr === todayStr,
      };
    });
  }, [todayStr]);

  const filteredHabitsForMatrix = useMemo(() => {
    if (matrixHabitFilter === 'all') return activeHabits;
    const found = activeHabits.find((h) => h.id === matrixHabitFilter);
    return found ? [found] : activeHabits;
  }, [activeHabits, matrixHabitFilter]);

  const cells = useMemo(() => {
    return Array.from({ length: 28 }, (_, idx) => {
      const offset = idx - 27;
      const dateStr = addDaysToDateStr(todayStr, offset);
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      const completedHabits = filteredHabitsForMatrix.filter((h) =>
        h.completedDates.includes(dateStr)
      );
      return {
        dateStr,
        weekdayShort: dt.toLocaleDateString('en-US', { weekday: 'short' }),
        label: dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        dayNum: d,
        completedCount: completedHabits.length,
        completedHabitTitles: completedHabits.map((h) => h.title),
        totalPossible: filteredHabitsForMatrix.length,
      };
    });
  }, [todayStr, filteredHabitsForMatrix]);

  const selectedCell = cells.find((c) => c.dateStr === selectedDay) || cells[cells.length - 1];

  const goalProgress =
    summary.totalHabits > 0 ? Math.min(1, summary.doneTodayCount / summary.totalHabits) : 0;
  const ringRadius = 22;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - goalProgress);

  const openCreateModal = () => {
    setEditingHabit(null);
    setTitle('');
    setCategory('Coding');
    setTargetLabel('');
    setColor('#E3242B');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (habit: Habit) => {
    setEditingHabit(habit);
    setTitle(habit.title);
    setCategory(habit.category);
    setTargetLabel(habit.targetLabel);
    setColor(habit.color || '#E3242B');
    setFormError(null);
    setModalOpen(true);
  };

  const handleApplyTemplate = (tpl: (typeof QUICK_TEMPLATES)[number]) => {
    setTitle(tpl.title);
    setCategory(tpl.category);
    setTargetLabel(tpl.targetLabel);
    setColor(tpl.color);
    setFormError(null);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setFormError('Please enter a habit name (e.g. LeetCode Daily, Gym).');
      return;
    }
    onSaveHabit({
      id: editingHabit?.id,
      title: trimmed.slice(0, 80),
      category,
      targetLabel: targetLabel.trim().slice(0, 60),
      color,
    });
    setModalOpen(false);
  };

  const selectedTaskDayEntry = dailyHistory[selectedDay] || {
    completedCount: 0,
    missedCount: 0,
    focusMinutes: 0,
  };

  return (
    <div className="space-y-6">
      {/* 3-Column Habit Streak KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <motion.div
          whileHover={{ y: -2 }}
          className="tactile-card relative flex items-center justify-between p-5"
        >
          <div className="pointer-events-auto absolute -right-2 -top-7 z-20">
            <StarCatSticker className="h-14 w-14" />
          </div>
          <div>
            <p className="text-xs font-bold text-[var(--text-secondary)]">Top Habit Streak</p>
            <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-[var(--text-primary)]">
              {summary.topCurrentStreak} {summary.topCurrentStreak === 1 ? 'day' : 'days'}
            </p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              {summary.doneTodayCount > 0
                ? `${summary.doneTodayCount} habit${summary.doneTodayCount === 1 ? '' : 's'} checked today`
                : 'Check in a habit today to build momentum'}
            </p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-[var(--border-subtle)] bg-amber-300 text-[#141418]">
            <Flame className="h-6 w-6" />
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -2 }}
          className="tactile-card flex items-center justify-between p-5"
        >
          <div>
            <p className="text-xs font-bold text-[var(--text-secondary)]">All-Time Best Habit</p>
            <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-[var(--text-primary)]">
              {summary.topBestStreak} {summary.topBestStreak === 1 ? 'day' : 'days'}
            </p>
            <p className="mt-1 font-mono text-xs tabular-nums text-[var(--text-secondary)]">
              {summary.totalCheckins} total check-ins · {summary.totalHabits} tracked
            </p>
          </div>
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-[var(--border-subtle)]"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
          >
            <Trophy className="h-6 w-6" />
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -2 }}
          className="tactile-card flex items-center justify-between p-5"
        >
          <div>
            <p className="text-xs font-bold text-[var(--text-secondary)]">Today’s Habit Check-Ins</p>
            <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-[var(--text-primary)]">
              {summary.doneTodayCount} / {summary.totalHabits}
            </p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Independent of scheduled tasks
            </p>
          </div>
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
            <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
              <circle
                cx="28"
                cy="28"
                r={ringRadius}
                fill="none"
                stroke="var(--bg-subtle)"
                strokeWidth="6"
              />
              <motion.circle
                cx="28"
                cy="28"
                r={ringRadius}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                initial={{ strokeDashoffset: ringCircumference }}
                animate={{ strokeDashoffset: ringOffset }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </svg>
            <Target className="absolute h-4 w-4 text-[var(--text-primary)]" />
          </div>
        </motion.div>
      </div>

      {/* Dedicated Habit Streak Manager */}
      <section className="tactile-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-extrabold text-[var(--text-primary)]">
              Habit Streak Manager
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              Track daily habits like LeetCode, Gym, or Reading separately from your scheduled tasks.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onOpenExport && (
              <button
                type="button"
                onClick={onOpenExport}
                className="comic-btn inline-flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-[var(--bg-subtle)] px-3.5 py-2 text-xs font-extrabold text-[var(--text-primary)]"
              >
                <Download className="h-4 w-4" />
                <span>Export</span>
              </button>
            )}
            <motion.button
              type="button"
              whileHover={{ y: -1 }}
              whileTap={{ x: 2, y: 2 }}
              onClick={openCreateModal}
              className="comic-btn inline-flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-extrabold"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-contrast)',
              }}
            >
              <Plus className="h-4 w-4" />
              <span>Add Habit</span>
            </motion.button>
          </div>
        </div>

        {habitsWithStats.length === 0 ? (
          <div className="mt-5 rounded-xl border-2 border-dashed border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-6 text-center">
            <p className="font-display text-sm font-extrabold text-[var(--text-primary)]">
              No habits tracked yet
            </p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Create your own daily habits (LeetCode, Gym, Study) or load starter presets.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={openCreateModal}
                className="comic-btn inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-extrabold"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-contrast)',
                }}
              >
                <Plus className="h-4 w-4" />
                <span>Create Habit</span>
              </button>
              {onLoadStarterHabits && (
                <button
                  type="button"
                  onClick={onLoadStarterHabits}
                  className="comic-btn inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-xl bg-[var(--bg-surface)] px-4 py-2 text-xs font-extrabold text-[var(--text-primary)]"
                >
                  <Sparkles className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                  <span>Load LeetCode, Gym & Reading</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {habitsWithStats.map(({ habit, stats }) => {
              const weekDoneCount = last7Days.filter((d) =>
                habit.completedDates.includes(d.dateStr)
              ).length;
              const weekPct = Math.round((weekDoneCount / 7) * 100);

              return (
                <motion.div
                  key={habit.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-4 transition-all hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_var(--border-subtle)]"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    {/* Habit Identity + Streak Metrics + 7-Day Momentum Bar */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5">
                        <span
                          aria-hidden="true"
                          className="h-3.5 w-3.5 shrink-0 rounded-sm border-2 border-[var(--border-subtle)]"
                          style={{ backgroundColor: habit.color }}
                        />
                        <h3 className="truncate font-display text-sm font-extrabold text-[var(--text-primary)] sm:text-base">
                          {habit.title}
                        </h3>
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[var(--text-secondary)]">
                        <span className="font-semibold text-[var(--text-primary)]">{habit.category}</span>
                        {habit.targetLabel && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{habit.targetLabel}</span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 font-mono font-bold tabular-nums text-[var(--text-primary)]">
                          <Flame className="h-3.5 w-3.5 text-amber-500" />
                          {stats.currentStreak}d streak
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">Best {stats.bestStreak}d</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{weekDoneCount}/7 this week</span>
                      </div>

                      <div className="mt-2.5 h-1.5 max-w-[220px] overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${weekPct}%` }}
                          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: habit.color }}
                        />
                      </div>
                    </div>

                  {/* Last 7 Days Interactive Checkboxes + Today Check-In & Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
                    <div className="flex items-center gap-1.5" role="group" aria-label={`Last 7 days for ${habit.title}`}>
                      {last7Days.map((day) => {
                        const checked = habit.completedDates.includes(day.dateStr);
                        return (
                          <motion.button
                            key={day.dateStr}
                            type="button"
                            whileTap={{ scale: 0.9 }}
                            onClick={() => onToggleHabitDate(habit.id, day.dateStr)}
                            title={`${habit.title} · ${day.dateStr} (${checked ? 'Done' : 'Missed'})`}
                            aria-label={`Toggle ${habit.title} on ${day.dateStr}`}
                            aria-pressed={checked}
                            className={`flex h-10 w-8 flex-col items-center justify-center rounded-lg border-2 border-[var(--border-subtle)] font-mono text-[10px] font-bold tabular-nums transition-colors ${
                              day.isToday ? 'ring-1 ring-[var(--border-subtle)]' : ''
                            }`}
                            style={
                              checked
                                ? {
                                    backgroundColor: habit.color,
                                    color: '#FFFFFF',
                                  }
                                : {
                                    backgroundColor: 'var(--bg-subtle)',
                                    color: 'var(--text-secondary)',
                                  }
                            }
                          >
                            <span className="leading-none opacity-85">{day.shortDay}</span>
                            <span className="mt-0.5 leading-none">
                              {checked ? <Check className="h-3 w-3" /> : day.dayNum}
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-2">
                      <motion.button
                        type="button"
                        whileTap={{ x: 1, y: 1 }}
                        onClick={() => onToggleHabitDate(habit.id, todayStr)}
                        className="comic-btn inline-flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-extrabold"
                        style={
                          stats.doneToday
                            ? {
                                backgroundColor: habit.color,
                                color: '#FFFFFF',
                              }
                            : {
                                backgroundColor: 'var(--bg-surface)',
                                color: 'var(--text-primary)',
                              }
                        }
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>{stats.doneToday ? 'Done Today' : 'Check In'}</span>
                      </motion.button>

                      <button
                        type="button"
                        onClick={() => openEditModal(habit)}
                        aria-label={`Edit ${habit.title}`}
                        title="Edit habit"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteHabit(habit.id)}
                        aria-label={`Delete ${habit.title}`}
                        title="Delete habit"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* 28-Day Habit Consistency Grid */}
      <section className="tactile-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-extrabold text-[var(--text-primary)]">
              28-Day Habit Consistency Grid
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              Inspect overall habit completion or filter down to a single habit like LeetCode or Gym.
            </p>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-bold text-[var(--text-secondary)]">
            <span>Less</span>
            <span className="h-3.5 w-3.5 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-subtle)]" />
            <span
              className="h-3.5 w-3.5 rounded-sm border border-[var(--border-subtle)]"
              style={{ backgroundColor: 'var(--accent-soft)' }}
            />
            <span
              className="h-3.5 w-3.5 rounded-sm border border-[var(--border-subtle)]"
              style={{ backgroundColor: 'var(--accent)' }}
            />
            <span className="h-3.5 w-3.5 rounded-sm border border-[var(--border-subtle)] bg-[#266B43]" />
            <span>More</span>
          </div>
        </div>

        {/* Habit Filter Selector */}
        {activeHabits.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMatrixHabitFilter('all')}
              className={`min-h-[38px] whitespace-nowrap rounded-xl border-2 border-[var(--border-subtle)] px-3 py-1.5 text-xs font-extrabold transition-colors ${
                matrixHabitFilter === 'all'
                  ? 'shadow-[2px_2px_0px_var(--border-subtle)]'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              style={
                matrixHabitFilter === 'all'
                  ? { backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }
                  : undefined
              }
            >
              All Habits ({activeHabits.length})
            </button>

            {activeHabits.map((h) => {
              const selected = matrixHabitFilter === h.id;
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setMatrixHabitFilter(h.id)}
                  className={`inline-flex min-h-[38px] items-center gap-2 whitespace-nowrap rounded-xl border-2 border-[var(--border-subtle)] px-3 py-1.5 text-xs font-extrabold transition-colors ${
                    selected
                      ? 'shadow-[2px_2px_0px_var(--border-subtle)]'
                      : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  style={
                    selected
                      ? { backgroundColor: h.color, color: '#FFFFFF' }
                      : undefined
                  }
                >
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-sm border border-[var(--border-subtle)]"
                    style={{ backgroundColor: selected ? '#FFFFFF' : h.color }}
                  />
                  <span>{h.title}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-5 grid grid-cols-7 gap-2 text-center">
          {cells.slice(0, 7).map((col) => (
            <span
              key={`hdr-${col.dateStr}`}
              className="font-mono text-[11px] font-bold text-[var(--text-secondary)]"
            >
              {col.weekdayShort}
            </span>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-2">
          {cells.map((cell, idx) => {
            const isSelected = cell.dateStr === selectedDay;
            const ratio = cell.totalPossible > 0 ? cell.completedCount / cell.totalPossible : 0;

            let cellStyle: React.CSSProperties = {
              backgroundColor: 'var(--bg-subtle)',
              color: 'var(--text-secondary)',
            };
            if (matrixHabitFilter !== 'all' && cell.completedCount > 0) {
              const targetHabit = activeHabits.find((h) => h.id === matrixHabitFilter);
              cellStyle = {
                backgroundColor: targetHabit?.color || '#266B43',
                color: '#FFFFFF',
              };
            } else if (cell.completedCount > 0 && ratio < 0.5) {
              cellStyle = {
                backgroundColor: 'var(--accent-soft)',
                color: 'var(--text-primary)',
              };
            } else if (cell.completedCount > 0 && ratio < 1) {
              cellStyle = {
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-contrast)',
              };
            } else if (cell.completedCount > 0 && ratio >= 1) {
              cellStyle = {
                backgroundColor: '#266B43',
                color: '#FFFFFF',
              };
            }

            return (
              <motion.button
                key={cell.dateStr}
                type="button"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.01, type: 'spring', stiffness: 450, damping: 26 }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => setSelectedDay(cell.dateStr)}
                aria-label={`${cell.label}: ${cell.completedCount} habits completed`}
                style={cellStyle}
                className={`flex min-h-[48px] flex-col items-center justify-center rounded-xl border-2 border-[var(--border-subtle)] font-mono text-xs font-bold tabular-nums ${
                  isSelected ? 'shadow-[3px_3px_0px_var(--border-subtle)] -translate-y-0.5' : ''
                }`}
              >
                <span>{cell.dayNum}</span>
                {cell.completedCount > 0 && (
                  <span className="text-[10px] font-medium opacity-90">
                    {matrixHabitFilter === 'all' ? `${cell.completedCount}/${cell.totalPossible}` : '✓'}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Selected Day Inspection */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t-2 border-[var(--border-subtle)] pt-4 text-xs">
          <div>
            <span className="font-extrabold text-[var(--text-primary)]">{selectedCell.label}</span>
            <p className="mt-0.5 text-[var(--text-secondary)]">
              {selectedCell.completedHabitTitles.length > 0
                ? `Completed: ${selectedCell.completedHabitTitles.join(', ')}`
                : 'No habits checked in on this day.'}
            </p>
          </div>

          {matrixHabitFilter !== 'all' && (
            <button
              type="button"
              onClick={() => onToggleHabitDate(matrixHabitFilter, selectedCell.dateStr)}
              className="comic-btn min-h-[40px] whitespace-nowrap rounded-xl bg-[var(--bg-subtle)] px-3 py-1.5 text-xs font-extrabold text-[var(--text-primary)]"
            >
              {selectedCell.completedCount > 0 ? 'Uncheck This Day' : 'Mark This Day Done'}
            </button>
          )}
        </div>
      </section>

      {/* Secondary Collapsible Scheduled Task Focus Reference */}
      <section className="tactile-card overflow-hidden">
        <button
          type="button"
          onClick={() => setShowTaskStats((prev) => !prev)}
          className="flex min-h-[48px] w-full items-center justify-between px-5 py-3.5 text-left hover:bg-[var(--bg-subtle)]/60"
        >
          <div>
            <span className="font-display text-sm font-extrabold text-[var(--text-primary)]">
              Scheduled Task Focus Reference
            </span>
            <span className="ml-2 text-xs text-[var(--text-secondary)]">
              (Separate from habits · {taskStreak.totalCompleted} tasks ·{' '}
              {formatDuration(taskStreak.totalFocusMinutes)})
            </span>
          </div>
          {showTaskStats ? (
            <ChevronUp className="h-4 w-4 text-[var(--text-secondary)]" />
          ) : (
            <ChevronDown className="h-4 w-4 text-[var(--text-secondary)]" />
          )}
        </button>

        {showTaskStats && (
          <div className="border-t-2 border-[var(--border-subtle)] px-5 py-4 text-xs text-[var(--text-secondary)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                Task completion streak: <strong className="font-mono text-[var(--text-primary)]">{taskStreak.currentStreak}d</strong>{' '}
                (Best <strong className="font-mono text-[var(--text-primary)]">{taskStreak.bestStreak}d</strong>)
              </span>
              <span className="font-mono tabular-nums">
                Selected day ({selectedDay}): {selectedTaskDayEntry.completedCount} tasks ·{' '}
                {formatDuration(selectedTaskDayEntry.focusMinutes)}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Add / Edit Habit Modal */}
      <AnimatePresence>
        {modalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
            aria-labelledby="habit-modal-title"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 10 }}
              className="tactile-card w-full max-w-md bg-[var(--bg-surface)] p-5"
            >
              <div className="flex items-center justify-between border-b-2 border-[var(--border-subtle)] pb-3">
                <h3
                  id="habit-modal-title"
                  className="font-display text-lg font-extrabold text-[var(--text-primary)]"
                >
                  {editingHabit ? 'Edit Habit' : 'New Habit Streak'}
                </h3>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  aria-label="Close habit modal"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-transparent text-[var(--text-secondary)] hover:border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitForm} className="mt-4 space-y-4">
                {!editingHabit && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                      Quick Presets
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {QUICK_TEMPLATES.map((tpl) => (
                        <button
                          key={tpl.title}
                          type="button"
                          onClick={() => handleApplyTemplate(tpl)}
                          className="rounded-lg border-2 border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2.5 py-1 text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--bg-canvas)]"
                        >
                          {tpl.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="habit-title-input"
                    className="block text-xs font-bold text-[var(--text-primary)]"
                  >
                    Habit Name
                  </label>
                  <input
                    id="habit-title-input"
                    type="text"
                    required
                    maxLength={80}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. LeetCode Daily, Gym, Read 20 Pages"
                    className="mt-1.5 w-full rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm font-semibold text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)]">
                    Category
                  </label>
                  <div className="mt-1.5 grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {HABIT_CATEGORIES.map((cat) => {
                      const active = category === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategory(cat)}
                          className={`min-h-[38px] rounded-xl border-2 border-[var(--border-subtle)] px-2 py-1.5 text-xs font-bold transition-colors ${
                            active
                              ? 'shadow-[2px_2px_0px_var(--border-subtle)]'
                              : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]'
                          }`}
                          style={
                            active
                              ? { backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }
                              : undefined
                          }
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="habit-target-input"
                    className="block text-xs font-bold text-[var(--text-primary)]"
                  >
                    Daily Target (optional)
                  </label>
                  <input
                    id="habit-target-input"
                    type="text"
                    maxLength={60}
                    value={targetLabel}
                    onChange={(e) => setTargetLabel(e.target.value)}
                    placeholder="e.g. 1 medium problem, 45 min workout"
                    className="mt-1.5 w-full rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm font-semibold text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)]">
                    Badge Color
                  </label>
                  <div className="mt-2 flex flex-wrap gap-2.5">
                    {HABIT_COLORS.map((swatch) => {
                      const active = color.toUpperCase() === swatch.hex.toUpperCase();
                      return (
                        <button
                          key={swatch.hex}
                          type="button"
                          onClick={() => setColor(swatch.hex)}
                          aria-label={swatch.name}
                          className={`flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[var(--border-subtle)] transition-transform ${
                            active ? 'scale-110 shadow-[2px_2px_0px_var(--border-subtle)]' : ''
                          }`}
                          style={{ backgroundColor: swatch.hex }}
                        >
                          {active && <Check className="h-4 w-4 text-white" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {formError && (
                  <p className="text-xs font-bold text-red-600">{formError}</p>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="comic-btn min-h-[44px] rounded-xl bg-[var(--bg-subtle)] px-4 py-2 text-xs font-extrabold text-[var(--text-primary)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="comic-btn min-h-[44px] rounded-xl px-5 py-2 text-xs font-extrabold"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'var(--accent-contrast)',
                    }}
                  >
                    {editingHabit ? 'Save Changes' : 'Create Habit'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
