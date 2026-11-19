export type Priority = 'high' | 'medium' | 'low';

export type EnergyLevel = 'deep' | 'medium' | 'light';

export type TaskStatus = 'pending' | 'scheduled' | 'completed' | 'missed';

export type MoodType = 'focused' | 'energized' | 'tired' | 'stressed' | 'overwhelmed';

export type ScheduleStrategy = 'balanced' | 'light_recovery' | 'deadline_crunch' | 'deep_focus';

export type ThemePresetId =
  | 'pixel-arcade'
  | 'meadow-sprint'
  | 'kaiju-comic'
  | 'kaiju-night'
  | 'warm-tactile'
  | 'midnight-slate';

export interface Task {
  id: string;
  title: string;
  notes?: string;
  priority: Priority;
  energyRequired: EnergyLevel;
  durationMinutes: number;
  deadline: string; // YYYY-MM-DDTHH:mm
  status: TaskStatus;
  createdAt: string;
  completedAt?: string;
}

export interface FreeWindow {
  id: string;
  start: string; // HH:mm
  end: string; // HH:mm
  label?: string;
}

// 0 = Sunday, 1 = Monday, ..., 6 = Saturday
export type WeeklyFreeHours = Record<number, FreeWindow[]>;

export interface ScheduleBlock {
  id: string;
  taskId: string;
  taskTitle: string;
  priority: Priority;
  energyRequired: EnergyLevel;
  deadline: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  status: 'upcoming' | 'completed' | 'missed';
  partLabel?: string; // e.g., "Part 1/2"
  rearrangedReason?: string;
}

export interface DailyActivity {
  completedCount: number;
  missedCount: number;
  focusMinutes: number;
}

export type DailyHistoryMap = Record<string, DailyActivity>;

export interface StreakSummary {
  currentStreak: number;
  bestStreak: number;
  totalCompleted: number;
  totalFocusMinutes: number;
  todayCompleted: number;
  todayFocusMinutes: number;
  activeToday: boolean;
}

export type HabitCategory = 'Coding' | 'Fitness' | 'Study' | 'Wellness' | 'Other';

export interface Habit {
  id: string;
  title: string;
  category: HabitCategory;
  targetLabel: string;
  color: string;
  completedDates: string[]; // YYYY-MM-DD
  archived: boolean;
  createdAt: string;
}

export interface HabitStreakStats {
  currentStreak: number;
  bestStreak: number;
  totalCheckins: number;
  doneToday: boolean;
}

export interface GridSettings {
  bufferMinutes: number;
  autoRearrangeOnMiss: boolean;
  dailyGoalTasks: number;
  theme: 'light' | 'dark';
  themePreset: ThemePresetId;
  accentColor: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  mood?: MoodType;
  appliedRearrange?: boolean;
  strategyLabel?: string;
  suggestedPrompts?: string[];
  isError?: boolean;
}

export interface ScheduleWarning {
  taskId: string;
  taskTitle: string;
  reason: string;
}
