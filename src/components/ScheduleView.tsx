import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Clock,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { CoffeeCatSticker } from './CatStickers';
import {
  FreeWindow,
  MoodType,
  ScheduleBlock,
  ScheduleWarning,
  Task,
  WeeklyFreeHours,
} from '../types/grid';
import {
  addDaysToDateStr,
  formatDeadlineShort,
  formatDuration,
  formatTime12h,
  parseTimeToMinutes,
  toLocalDateString,
} from '../utils/scheduler';

interface ScheduleViewProps {
  blocks: ScheduleBlock[];
  tasks: Task[];
  weeklyFreeHours: WeeklyFreeHours;
  todayOverrideWindows: FreeWindow[] | null;
  mood: MoodType;
  warnings: ScheduleWarning[];
  overdueBlocks: ScheduleBlock[];
  isOptimizingAI: boolean;
  aiExplanation: string | null;
  aiError: string | null;
  onChangeMood: (mood: MoodType) => void;
  onOptimizeLocal: () => void;
  onOptimizeWithAI: () => void;
  onAutoRearrangeMissed: () => void;
  onCompleteBlock: (block: ScheduleBlock) => void;
  onMissBlock: (block: ScheduleBlock) => void;
  onOpenCoach: (prefill?: string) => void;
  onAddTask: () => void;
  onGoToFreeHours: () => void;
}

const MOODS: { value: MoodType; label: string }[] = [
  { value: 'focused', label: 'Focused' },
  { value: 'energized', label: 'Energized' },
  { value: 'tired', label: 'Tired' },
  { value: 'stressed', label: 'Stressed' },
  { value: 'overwhelmed', label: 'Overwhelmed' },
];

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  blocks,
  tasks,
  weeklyFreeHours,
  todayOverrideWindows,
  mood,
  warnings,
  overdueBlocks,
  isOptimizingAI,
  aiExplanation,
  aiError,
  onChangeMood,
  onOptimizeLocal,
  onOptimizeWithAI,
  onAutoRearrangeMissed,
  onCompleteBlock,
  onMissBlock,
  onOpenCoach,
  onAddTask,
  onGoToFreeHours,
}) => {
  const todayStr = toLocalDateString();
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const dateStrip = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const dateStr = addDaysToDateStr(todayStr, i);
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      const dow = dt.getDay();
      const windows =
        i === 0 && todayOverrideWindows !== null ? todayOverrideWindows : weeklyFreeHours[dow] || [];
      const freeMins = windows.reduce(
        (acc, w) => acc + Math.max(0, parseTimeToMinutes(w.end) - parseTimeToMinutes(w.start)),
        0
      );
      const dayBlocks = blocks.filter((b) => b.date === dateStr);
      const bookedMins = dayBlocks.reduce(
        (acc, b) => acc + Math.max(0, parseTimeToMinutes(b.endTime) - parseTimeToMinutes(b.startTime)),
        0
      );
      const upcomingCount = dayBlocks.filter((b) => b.status === 'upcoming').length;
      const doneCount = dayBlocks.filter((b) => b.status === 'completed').length;
      const loadRatio = freeMins > 0 ? Math.min(1, bookedMins / freeMins) : 0;

      return {
        dateStr,
        dayShort: dt.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: d,
        freeMins,
        bookedMins,
        upcomingCount,
        doneCount,
        loadRatio,
      };
    });
  }, [todayStr, weeklyFreeHours, todayOverrideWindows, blocks]);

  const selectedDayInfo = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const dow = dt.getDay();
    const windows =
      selectedDate === todayStr && todayOverrideWindows !== null
        ? todayOverrideWindows
        : weeklyFreeHours[dow] || [];
    const dayBlocks = blocks.filter((b) => b.date === selectedDate);
    const totalMins = dayBlocks.reduce(
      (acc, b) => acc + Math.max(0, parseTimeToMinutes(b.endTime) - parseTimeToMinutes(b.startTime)),
      0
    );
    const completedMins = dayBlocks
      .filter((b) => b.status === 'completed')
      .reduce(
        (acc, b) => acc + Math.max(0, parseTimeToMinutes(b.endTime) - parseTimeToMinutes(b.startTime)),
        0
      );
    const completedBlocks = dayBlocks.filter((b) => b.status === 'completed').length;
    const nextUpcoming = dayBlocks.find((b) => b.status === 'upcoming') || null;

    return {
      label:
        selectedDate === todayStr
          ? 'Today’s Gameplan'
          : selectedDate === addDaysToDateStr(todayStr, 1)
          ? 'Tomorrow’s Plan'
          : dt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
      dateFormatted: dt.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      windows,
      dayBlocks,
      totalMins,
      completedMins,
      completedBlocks,
      nextUpcoming,
      completionRatio: dayBlocks.length > 0 ? completedBlocks / dayBlocks.length : 0,
    };
  }, [selectedDate, todayStr, todayOverrideWindows, weeklyFreeHours, blocks]);

  const activeTasksCount = tasks.filter((t) => t.status !== 'completed').length;

  return (
    <div className="space-y-6">
      {/* Overdue / Missed Auto-Rearrange Alert */}
      {overdueBlocks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="tactile-card flex flex-col justify-between gap-4 bg-[#FFE4E1] p-4 text-[#141418] sm:flex-row sm:items-center dark:bg-red-950/60 dark:text-red-100"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#E85454]" />
            <div>
              <p className="text-sm font-extrabold">
                {overdueBlocks.length} scheduled {overdueBlocks.length === 1 ? 'block' : 'blocks'} passed without completion
              </p>
              <p className="mt-0.5 text-xs opacity-85">
                Grid can automatically rearrange missed work into your next open free hours or adapt around your mood.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onAutoRearrangeMissed}
              className="comic-btn inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#E85454] px-4 py-2 text-xs font-extrabold text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Auto-Rearrange</span>
            </button>
            <button
              type="button"
              onClick={() =>
                onOpenCoach(
                  `I missed ${overdueBlocks.length} scheduled block(s). Can you rearrange my schedule based on how I'm feeling?`
                )
              }
              className="comic-btn inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-[#141418]"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Ask Echo</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* Hero Day Gameplan & Mood Command Card */}
      <section className="tactile-card relative p-5 sm:p-6">
        <div className="pointer-events-auto absolute -right-2 -top-7 z-20 hidden sm:block">
          <CoffeeCatSticker className="h-14 w-14" />
        </div>

        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs font-bold text-[var(--text-secondary)]">
              {selectedDayInfo.dateFormatted} ·{' '}
              {selectedDayInfo.dayBlocks.length > 0
                ? `${selectedDayInfo.completedBlocks}/${selectedDayInfo.dayBlocks.length} blocks cleared`
                : 'Open day'}
            </p>
            <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-3xl">
              {selectedDayInfo.label}
            </h2>

            {/* Daily Focus Progress Meter */}
            <div className="mt-3.5 max-w-md">
              <div className="flex items-center justify-between text-xs font-bold text-[var(--text-secondary)]">
                <span>
                  {selectedDayInfo.dayBlocks.length > 0
                    ? selectedDayInfo.completedBlocks === selectedDayInfo.dayBlocks.length
                      ? 'All blocks completed for this day'
                      : 'Daily focus progress'
                    : 'No focus blocks scheduled yet'}
                </span>
                <span className="ml-2 shrink-0 font-mono tabular-nums text-[var(--text-primary)]">
                  {formatDuration(selectedDayInfo.completedMins)} /{' '}
                  {formatDuration(selectedDayInfo.totalMins)}
                </span>
              </div>
              <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full border-2 border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.round(selectedDayInfo.completionRatio * 100)}%` }}
                  transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                  className="h-full"
                  style={{ backgroundColor: 'var(--accent)' }}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onOptimizeLocal}
              className="comic-btn inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-xl bg-[var(--bg-subtle)] px-4 py-2 text-xs font-bold text-[var(--text-primary)]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Recompute</span>
            </button>
            <button
              type="button"
              onClick={onOptimizeWithAI}
              disabled={isOptimizingAI || activeTasksCount === 0}
              className="comic-btn inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-extrabold disabled:opacity-50"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-contrast)',
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{isOptimizingAI ? 'Optimizing…' : 'AI Mood Optimize'}</span>
            </button>
          </div>
        </div>

        {/* Mood Switcher Row */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t-2 border-[var(--border-subtle)] pt-4">
          <span className="text-xs font-bold text-[var(--text-secondary)]">
            Energy alignment:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {MOODS.map((m) => {
              const isSelected = mood === m.value;
              return (
                <motion.button
                  key={m.value}
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onChangeMood(m.value)}
                  className={`min-h-[38px] whitespace-nowrap rounded-xl border-2 px-3 py-1.5 text-xs font-bold transition-colors ${
                    isSelected
                      ? 'border-[var(--border-subtle)] shadow-[2px_2px_0px_var(--border-subtle)]'
                      : 'border-transparent bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  style={
                    isSelected
                      ? {
                          backgroundColor: 'var(--accent)',
                          color: 'var(--accent-contrast)',
                        }
                      : undefined
                  }
                >
                  {m.label}
                </motion.button>
              );
            })}
          </div>
        </div>

        {aiExplanation && (
          <p className="mt-3.5 border-t-2 border-[var(--border-subtle)] pt-3 text-xs font-medium text-[var(--text-secondary)]">
            {aiExplanation}
          </p>
        )}
        {aiError && (
          <p className="mt-3.5 border-t-2 border-[var(--border-subtle)] pt-3 text-xs font-bold text-red-600 dark:text-red-400">
            {aiError}
          </p>
        )}
      </section>

      {/* Horizontal 7-Day Capacity Strip */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
        {dateStrip.map((day) => {
          const active = day.dateStr === selectedDate;
          return (
            <motion.button
              key={day.dateStr}
              type="button"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setSelectedDate(day.dateStr)}
              className={`relative flex min-h-[84px] flex-col justify-between overflow-hidden rounded-2xl border-2 p-3.5 text-left transition-colors ${
                active ? 'shadow-[4px_4px_0px_var(--border-subtle)]' : 'tactile-card'
              }`}
              style={
                active
                  ? {
                      backgroundColor: 'var(--accent)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--accent-contrast)',
                    }
                  : undefined
              }
            >
              <div className="flex w-full items-baseline justify-between gap-1">
                <span
                  className="text-xs font-bold"
                  style={{ opacity: active ? 0.9 : 1, color: active ? 'inherit' : 'var(--text-secondary)' }}
                >
                  {day.dayShort}
                </span>
                <span className="font-mono text-base font-extrabold tabular-nums">{day.dayNum}</span>
              </div>

              <div className="mt-2 space-y-1.5">
                <div
                  className="font-mono text-[11px] font-bold tabular-nums"
                  style={{ opacity: active ? 0.95 : 1, color: active ? 'inherit' : 'var(--text-secondary)' }}
                >
                  {day.upcomingCount > 0
                    ? `${day.upcomingCount} left`
                    : day.doneCount > 0
                    ? `${day.doneCount} done`
                    : `${formatDuration(day.freeMins)} free`}
                </div>

                {/* Mini Capacity Fill Bar */}
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full"
                  style={{
                    backgroundColor: active
                      ? 'rgba(255,255,255,0.28)'
                      : 'var(--bg-subtle)',
                  }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.round(day.loadRatio * 100)}%`,
                      backgroundColor: active ? 'var(--accent-contrast)' : 'var(--accent)',
                    }}
                  />
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Scheduling Warnings */}
      {warnings.length > 0 && (
        <div className="tactile-card bg-red-50 p-4 dark:bg-red-950/35">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-extrabold text-red-900 dark:text-red-200">
              Capacity notice ({warnings.length})
            </p>
            <button
              type="button"
              onClick={onGoToFreeHours}
              className="text-xs font-bold text-red-700 underline underline-offset-2 hover:text-red-800 dark:text-red-300"
            >
              Adjust Free Hours
            </button>
          </div>
          <ul className="mt-2 space-y-1 text-xs text-red-800 dark:text-red-300">
            {warnings.slice(0, 3).map((w) => (
              <li key={w.taskId}>
                <span className="font-bold">{w.taskTitle}:</span> {w.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Selected Day Vertical Timeline */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div>
            <h3 className="font-display text-base font-extrabold text-[var(--text-primary)]">
              Time-Blocked Schedule
            </h3>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              {selectedDayInfo.windows.length > 0
                ? `Free windows: ${selectedDayInfo.windows
                    .map((w) => `${formatTime12h(w.start)}–${formatTime12h(w.end)}`)
                    .join(' · ')}`
                : 'No free hours configured for this day'}
            </p>
          </div>
          <button
            type="button"
            onClick={onGoToFreeHours}
            className="comic-btn inline-flex min-h-[40px] items-center gap-1.5 whitespace-nowrap rounded-xl bg-[var(--bg-surface)] px-3.5 py-1.5 text-xs font-bold text-[var(--text-primary)]"
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Edit Free Hours</span>
          </button>
        </div>

        {selectedDayInfo.dayBlocks.length === 0 ? (
          <div className="tactile-card px-6 py-12 text-center">
            <CalendarClock className="mx-auto h-8 w-8 text-[var(--text-secondary)] opacity-70" />
            <p className="mt-3 text-sm font-extrabold text-[var(--text-primary)]">
              {selectedDayInfo.windows.length === 0
                ? 'No free time windows on this day'
                : 'No tasks scheduled in this day’s free hours'}
            </p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              {selectedDayInfo.windows.length === 0
                ? 'Open Free Hours to add availability, and Grid will fill it automatically.'
                : 'Add a new task or recompute your Grid schedule to pack upcoming tasks here.'}
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <button
                type="button"
                onClick={selectedDayInfo.windows.length === 0 ? onGoToFreeHours : onAddTask}
                className="comic-btn min-h-[44px] rounded-xl px-5 py-2 text-xs font-extrabold"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-contrast)',
                }}
              >
                {selectedDayInfo.windows.length === 0 ? 'Configure Free Hours' : 'Add Task'}
              </button>
            </div>
          </div>
        ) : (
          <div className="relative space-y-3 sm:pl-6">
            {/* Vertical Timeline Rail */}
            <div
              aria-hidden="true"
              className="absolute bottom-6 left-2 top-6 hidden w-0.5 bg-[var(--border-subtle)]/35 sm:block"
            />

            {selectedDayInfo.dayBlocks.map((block, idx) => {
              const duration =
                parseTimeToMinutes(block.endTime) - parseTimeToMinutes(block.startTime);
              const deadlineInfo = formatDeadlineShort(block.deadline, todayStr);
              const isCompleted = block.status === 'completed';
              const isMissed = block.status === 'missed';

              return (
                <motion.div
                  key={block.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 420,
                    damping: 28,
                    delay: Math.min(idx * 0.04, 0.24),
                  }}
                  className="relative"
                >
                  {/* Timeline Node */}
                  <span
                    aria-hidden="true"
                    className="absolute -left-[21px] top-6 hidden h-3 w-3 rounded-full border-2 border-[var(--border-subtle)] sm:block"
                    style={{
                      backgroundColor: isCompleted
                        ? '#266B43'
                        : isMissed
                        ? '#E85454'
                        : 'var(--accent)',
                    }}
                  />

                  <div
                    className={`tactile-card-interactive flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center sm:p-5 ${
                      isCompleted ? 'opacity-65' : ''
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-24 shrink-0 rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 font-mono text-xs font-bold tabular-nums text-[var(--text-primary)]">
                        <div>{formatTime12h(block.startTime)}</div>
                        <div className="mt-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                          {formatTime12h(block.endTime)}
                        </div>
                      </div>

                      <div className="min-w-0 pt-0.5">
                        <p
                          className={`text-sm font-extrabold sm:text-base ${
                            isCompleted
                              ? 'line-through text-[var(--text-secondary)]'
                              : 'text-[var(--text-primary)]'
                          }`}
                        >
                          {block.taskTitle}
                          {block.partLabel ? (
                            <span className="ml-2 font-mono text-xs font-medium text-[var(--text-secondary)]">
                              ({block.partLabel})
                            </span>
                          ) : null}
                        </p>

                        {/* Zero-pill clean unboxed metadata */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-secondary)]">
                          <span
                            className={
                              block.priority === 'high'
                                ? 'font-bold text-[#E85454]'
                                : block.priority === 'medium'
                                ? 'font-bold text-amber-700 dark:text-amber-400'
                                : 'font-medium'
                            }
                          >
                            {block.priority.charAt(0).toUpperCase() + block.priority.slice(1)} priority
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{formatDuration(duration)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{block.energyRequired} focus</span>
                          <span aria-hidden="true">·</span>
                          <span className={deadlineInfo.isOverdue ? 'font-bold text-[#E85454]' : ''}>
                            {deadlineInfo.label}
                          </span>
                        </div>

                        {block.rearrangedReason && !isCompleted && (
                          <p className="mt-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                            {block.rearrangedReason}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 sm:pl-4">
                      {isCompleted ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
                          <Check className="h-4 w-4" />
                          Completed
                        </span>
                      ) : isMissed ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#E85454]">
                          <XCircle className="h-4 w-4" />
                          Missed
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => onMissBlock(block)}
                            className="comic-btn inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-[var(--bg-subtle)] px-3.5 py-2 text-xs font-bold text-[var(--text-primary)] hover:bg-[#FFE4E1] hover:text-[#141418] sm:flex-initial"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            <span>Missed</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onCompleteBlock(block)}
                            className="comic-btn inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-extrabold sm:flex-initial"
                            style={{
                              backgroundColor: 'var(--accent)',
                              color: 'var(--accent-contrast)',
                            }}
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Done</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
