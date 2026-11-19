import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Calendar,
  Check,
  Download,
  FileJson,
  FileSpreadsheet,
  Flame,
  Printer,
  X,
} from 'lucide-react';
import {
  DailyHistoryMap,
  GridSettings,
  Habit,
  MoodType,
  ScheduleBlock,
  Task,
  WeeklyFreeHours,
} from '../types/grid';
import {
  exportFullBackupJSON,
  exportHabitsToCSV,
  exportScheduleToICS,
  exportTasksToCSV,
} from '../utils/exportData';

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  userEmail?: string | null;
  tasks: Task[];
  habits: Habit[];
  blocks: ScheduleBlock[];
  weeklyFreeHours: WeeklyFreeHours;
  dailyHistory: DailyHistoryMap;
  settings: GridSettings;
  mood: MoodType;
}

type ExportKey = 'ics' | 'habits' | 'tasks' | 'json' | 'print';

export const ExportModal: React.FC<ExportModalProps> = ({
  open,
  onClose,
  userEmail,
  tasks,
  habits,
  blocks,
  weeklyFreeHours,
  dailyHistory,
  settings,
  mood,
}) => {
  const [recentExport, setRecentExport] = useState<ExportKey | null>(null);

  if (!open) return null;

  const markDone = (key: ExportKey) => {
    setRecentExport(key);
    setTimeout(() => {
      setRecentExport((prev) => (prev === key ? null : prev));
    }, 2200);
  };

  const activeBlocksCount = blocks.filter((b) => b.status !== 'missed').length;
  const activeHabitsCount = habits.filter((h) => !h.archived).length;

  const options: {
    key: ExportKey;
    title: string;
    subtitle: string;
    meta: string;
    icon: React.ComponentType<{ className?: string }>;
    action: () => void;
    disabled?: boolean;
  }[] = [
    {
      key: 'ics',
      title: 'Calendar Schedule (.ics)',
      subtitle: 'Import your scheduled time blocks into Google Calendar, Apple Calendar, or Outlook.',
      meta: `${activeBlocksCount} blocks ready`,
      icon: Calendar,
      disabled: activeBlocksCount === 0,
      action: () => {
        exportScheduleToICS(blocks);
        markDone('ics');
      },
    },
    {
      key: 'habits',
      title: 'Habit Streaks Sheet (.csv)',
      subtitle: 'Export LeetCode, Gym, and custom habits with current/best streaks and check-in dates.',
      meta: `${activeHabitsCount} habits tracked`,
      icon: Flame,
      disabled: habits.length === 0,
      action: () => {
        exportHabitsToCSV(habits);
        markDone('habits');
      },
    },
    {
      key: 'tasks',
      title: 'Tasks & Deadlines (.csv)',
      subtitle: 'Spreadsheet export of all tasks, priorities, energy requirements, and durations.',
      meta: `${tasks.length} tasks`,
      icon: FileSpreadsheet,
      disabled: tasks.length === 0,
      action: () => {
        exportTasksToCSV(tasks);
        markDone('tasks');
      },
    },
    {
      key: 'json',
      title: 'Full Grid Backup (.json)',
      subtitle: 'Complete snapshot of tasks, habits, free hours, blocks, streak history, and theme.',
      meta: 'All workspace data',
      icon: FileJson,
      action: () => {
        exportFullBackupJSON({
          userEmail,
          tasks,
          habits,
          weeklyFreeHours,
          blocks,
          dailyHistory,
          settings,
          mood,
        });
        markDone('json');
      },
    },
    {
      key: 'print',
      title: 'Print / Save PDF',
      subtitle: 'Open your browser print dialog to save the current view as a PDF.',
      meta: 'Current tab view',
      icon: Printer,
      action: () => {
        markDone('print');
        onClose();
        setTimeout(() => window.print(), 150);
      },
    },
  ];

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-xs sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          className="tactile-card max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-[var(--bg-surface)] p-6 sm:rounded-3xl"
        >
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[var(--border-subtle)] sm:hidden" />

          <div className="flex items-start justify-between gap-4 border-b-2 border-[var(--border-subtle)] pb-4">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-[var(--border-subtle)]"
                style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
              >
                <Download className="h-5 w-5" />
              </div>
              <div>
                <h2
                  id="export-modal-title"
                  className="font-display text-lg font-extrabold text-[var(--text-primary)]"
                >
                  Export Grid Data
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Download your calendar, habit streaks, tasks, or full workspace backup.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close export modal"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {options.map((item) => {
              const Icon = item.icon;
              const done = recentExport === item.key;
              return (
                <div
                  key={item.key}
                  className="flex flex-col justify-between gap-3 rounded-2xl border-2 border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-primary)]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-display text-sm font-extrabold text-[var(--text-primary)]">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{item.subtitle}</p>
                      <p className="mt-1 font-mono text-[11px] font-bold tabular-nums text-[var(--text-secondary)]">
                        {item.meta}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={item.disabled}
                    onClick={item.action}
                    className="comic-btn inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-extrabold disabled:opacity-45"
                    style={
                      done
                        ? { backgroundColor: '#266B43', color: '#FFFFFF' }
                        : { backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }
                    }
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                    <span>{done ? 'Downloaded' : item.key === 'print' ? 'Print' : 'Export'}</span>
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="comic-btn min-h-[44px] rounded-xl bg-[var(--bg-subtle)] px-5 py-2 text-xs font-extrabold text-[var(--text-primary)]"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
