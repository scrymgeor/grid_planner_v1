import {
  DailyHistoryMap,
  GridSettings,
  Habit,
  MoodType,
  ScheduleBlock,
  Task,
  WeeklyFreeHours,
} from '../types/grid';
import { calculateHabitStreak, toLocalDateString } from './scheduler';

function triggerDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeCSV(val: string | number | boolean | undefined | null): string {
  const str = val === undefined || val === null ? '' : String(val);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function escapeICS(val: string): string {
  return val
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function formatICSDateTime(dateStr: string, timeStr: string): string {
  const cleanDate = dateStr.replace(/-/g, '');
  const [hh = '09', mm = '00'] = timeStr.split(':');
  return `${cleanDate}T${hh.padStart(2, '0')}${mm.padStart(2, '0')}00`;
}

function formatICSTimestampUTC(date: Date = new Date()): string {
  const iso = date.toISOString(); // YYYY-MM-DDTHH:mm:ss.sssZ
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function exportScheduleToICS(blocks: ScheduleBlock[]): number {
  const today = toLocalDateString();
  const exportable = blocks.filter((b) => b.status !== 'missed');
  const stamp = formatICSTimestampUTC();

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Grid Planner//Schedule Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const block of exportable) {
    const dtStart = formatICSDateTime(block.date, block.startTime);
    const dtEnd = formatICSDateTime(block.date, block.endTime);
    const summary = block.partLabel
      ? `${block.taskTitle} (${block.partLabel})`
      : block.taskTitle;
    const descParts = [
      `Priority: ${block.priority}`,
      `Energy: ${block.energyRequired}`,
      `Status: ${block.status}`,
      block.rearrangedReason ? `Note: ${block.rearrangedReason}` : '',
    ].filter(Boolean);

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${escapeICS(block.id)}@grid.app`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART:${dtStart}`);
    lines.push(`DTEND:${dtEnd}`);
    lines.push(`SUMMARY:${escapeICS(summary)}`);
    lines.push(`DESCRIPTION:${escapeICS(descParts.join(' | '))}`);
    lines.push(`STATUS:${block.status === 'completed' ? 'COMPLETED' : 'CONFIRMED'}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  triggerDownload(`grid-schedule-${today}.ics`, lines.join('\r\n'), 'text/calendar;charset=utf-8');
  return exportable.length;
}

export function exportHabitsToCSV(habits: Habit[]): number {
  const today = toLocalDateString();
  const header = [
    'Habit',
    'Category',
    'Daily Target',
    'Current Streak (days)',
    'Best Streak (days)',
    'Total Check-ins',
    'Done Today',
    'Completed Dates',
  ];

  const rows = habits.map((habit) => {
    const stats = calculateHabitStreak(habit.completedDates, today);
    const sortedDates = [...habit.completedDates].sort().join('; ');
    return [
      escapeCSV(habit.title),
      escapeCSV(habit.category),
      escapeCSV(habit.targetLabel),
      escapeCSV(stats.currentStreak),
      escapeCSV(stats.bestStreak),
      escapeCSV(stats.totalCheckins),
      escapeCSV(stats.doneToday ? 'Yes' : 'No'),
      escapeCSV(sortedDates),
    ].join(',');
  });

  const csv = [header.join(','), ...rows].join('\r\n');
  triggerDownload(`grid-habit-streaks-${today}.csv`, csv, 'text/csv;charset=utf-8');
  return habits.length;
}

export function exportTasksToCSV(tasks: Task[]): number {
  const today = toLocalDateString();
  const header = [
    'Title',
    'Status',
    'Priority',
    'Energy Required',
    'Duration (min)',
    'Deadline',
    'Notes',
    'Created At',
    'Completed At',
  ];

  const rows = tasks.map((task) =>
    [
      escapeCSV(task.title),
      escapeCSV(task.status),
      escapeCSV(task.priority),
      escapeCSV(task.energyRequired),
      escapeCSV(task.durationMinutes),
      escapeCSV(task.deadline),
      escapeCSV(task.notes || ''),
      escapeCSV(task.createdAt),
      escapeCSV(task.completedAt || ''),
    ].join(',')
  );

  const csv = [header.join(','), ...rows].join('\r\n');
  triggerDownload(`grid-tasks-${today}.csv`, csv, 'text/csv;charset=utf-8');
  return tasks.length;
}

export function exportFullBackupJSON(payload: {
  userEmail?: string | null;
  tasks: Task[];
  habits: Habit[];
  weeklyFreeHours: WeeklyFreeHours;
  blocks: ScheduleBlock[];
  dailyHistory: DailyHistoryMap;
  settings: GridSettings;
  mood: MoodType;
}): void {
  const today = toLocalDateString();
  const backup = {
    app: 'Grid Planner',
    version: 1,
    exportedAt: new Date().toISOString(),
    accountEmail: payload.userEmail || null,
    data: {
      mood: payload.mood,
      settings: payload.settings,
      weeklyFreeHours: payload.weeklyFreeHours,
      tasks: payload.tasks,
      habits: payload.habits,
      blocks: payload.blocks,
      dailyHistory: payload.dailyHistory,
    },
  };

  triggerDownload(
    `grid-backup-${today}.json`,
    JSON.stringify(backup, null, 2),
    'application/json;charset=utf-8'
  );
}
