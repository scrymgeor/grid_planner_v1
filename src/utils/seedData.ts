import {
  ChatMessage,
  DailyHistoryMap,
  GridSettings,
  Habit,
  Task,
  WeeklyFreeHours,
} from '../types/grid';
import { addDaysToDateStr, generateOptimalSchedule, toLocalDateString } from './scheduler';

export const DEFAULT_WEEKLY_FREE_HOURS: WeeklyFreeHours = {
  0: [
    { id: 'sun-1', start: '10:00', end: '13:00', label: 'Sunday Reset' },
    { id: 'sun-2', start: '16:00', end: '18:30', label: 'Week Prep' },
  ],
  1: [
    { id: 'mon-1', start: '07:30', end: '09:30', label: 'Morning Focus' },
    { id: 'mon-2', start: '18:30', end: '21:30', label: 'Evening Sprint' },
  ],
  2: [
    { id: 'tue-1', start: '07:30', end: '09:30', label: 'Morning Focus' },
    { id: 'tue-2', start: '18:30', end: '21:30', label: 'Evening Sprint' },
  ],
  3: [
    { id: 'wed-1', start: '07:30', end: '09:30', label: 'Morning Focus' },
    { id: 'wed-2', start: '19:00', end: '21:30', label: 'Evening Sprint' },
  ],
  4: [
    { id: 'thu-1', start: '07:30', end: '09:30', label: 'Morning Focus' },
    { id: 'thu-2', start: '18:30', end: '21:30', label: 'Evening Sprint' },
  ],
  5: [
    { id: 'fri-1', start: '07:30', end: '09:30', label: 'Morning Focus' },
    { id: 'fri-2', start: '17:30', end: '20:00', label: 'Wrap-up Block' },
  ],
  6: [
    { id: 'sat-1', start: '09:30', end: '13:00', label: 'Weekend Deep Work' },
    { id: 'sat-2', start: '15:30', end: '18:00', label: 'Creative Block' },
  ],
};

export const DEFAULT_SETTINGS: GridSettings = {
  bufferMinutes: 10,
  autoRearrangeOnMiss: true,
  dailyGoalTasks: 2,
  theme: 'light',
  themePreset: 'pixel-arcade',
  accentColor: '#E3242B',
};

export function createInitialSeedData() {
  const now = new Date();
  const today = toLocalDateString(now);
  const tomorrow = addDaysToDateStr(today, 1);
  const day2 = addDaysToDateStr(today, 2);
  const day3 = addDaysToDateStr(today, 3);

  const initialTasks: Task[] = [
    {
      id: 'task-1',
      title: 'Complete weekly project milestone & review notes',
      notes: 'Double-check deliverables, test edge cases, and wrap up final summary.',
      priority: 'high',
      energyRequired: 'deep',
      durationMinutes: 90,
      deadline: `${tomorrow}T20:00`,
      status: 'scheduled',
      createdAt: now.toISOString(),
    },
    {
      id: 'task-2',
      title: 'Prepare product roadmap deck for Q4 sprint',
      notes: 'Focus on user retention milestones and onboarding flow.',
      priority: 'high',
      energyRequired: 'medium',
      durationMinutes: 60,
      deadline: `${today}T23:00`,
      status: 'scheduled',
      createdAt: now.toISOString(),
    },
    {
      id: 'task-3',
      title: 'Algorithm practice: dynamic programming review',
      notes: '3 medium problems + notes summary.',
      priority: 'medium',
      energyRequired: 'deep',
      durationMinutes: 60,
      deadline: `${day2}T21:00`,
      status: 'scheduled',
      createdAt: now.toISOString(),
    },
    {
      id: 'task-4',
      title: 'Clear inbox & reply to design feedback',
      notes: 'Quick triage and follow-up messages.',
      priority: 'low',
      energyRequired: 'light',
      durationMinutes: 30,
      deadline: `${day2}T18:00`,
      status: 'scheduled',
      createdAt: now.toISOString(),
    },
    {
      id: 'task-5',
      title: 'Weekly workout & mobility session',
      notes: '45 min strength + 15 min stretch.',
      priority: 'medium',
      energyRequired: 'light',
      durationMinutes: 45,
      deadline: `${day3}T20:00`,
      status: 'scheduled',
      createdAt: now.toISOString(),
    },
  ];

  // Seed 28 days of streak history (with an active 6-day current streak!)
  const dailyHistory: DailyHistoryMap = {};
  const samplePattern = [2, 3, 1, 0, 2, 2, 3, 4, 1, 0, 2, 3, 2, 1, 2, 0, 1, 3, 2, 2, 4, 3, 2, 3, 2, 1, 2, 1];
  for (let i = 27; i >= 1; i--) {
    const d = addDaysToDateStr(today, -i);
    const count = samplePattern[27 - i] ?? 1;
    dailyHistory[d] = {
      completedCount: count,
      missedCount: count === 0 ? 1 : 0,
      focusMinutes: count * 50,
    };
  }
  dailyHistory[today] = {
    completedCount: 1,
    missedCount: 0,
    focusMinutes: 45,
  };

  const { blocks } = generateOptimalSchedule({
    tasks: initialTasks,
    weeklyFreeHours: DEFAULT_WEEKLY_FREE_HOURS,
    existingBlocks: [],
    bufferMinutes: DEFAULT_SETTINGS.bufferMinutes,
    mood: 'focused',
    now,
  });

  const initialMessages: ChatMessage[] = [
    {
      id: 'msg-welcome',
      role: 'assistant',
      content:
        "Hey, I'm Echo! I'm synced with your tasks, free hours, and streak. Let me know how you're feeling today—if you're tired, stressed, or missed a block, I can rearrange your schedule around your energy and deadlines.",
      timestamp: now.toISOString(),
      suggestedPrompts: [
        "I'm feeling tired today, lighten my schedule",
        'I missed a block—auto-rearrange my day',
        'Focus mode: front-load my highest priority tasks',
      ],
    },
  ];

  return {
    tasks: initialTasks,
    weeklyFreeHours: DEFAULT_WEEKLY_FREE_HOURS,
    dailyHistory,
    blocks,
    settings: DEFAULT_SETTINGS,
    messages: initialMessages,
    habits: createInitialSeedHabits(now),
  };
}

export function createInitialSeedHabits(now: Date = new Date()): Habit[] {
  const today = toLocalDateString(now);
  const offsetDays = (offsets: number[]) =>
    offsets.map((offset) => addDaysToDateStr(today, -offset)).sort();

  return [
    {
      id: 'habit_leetcode',
      title: 'LeetCode Daily',
      category: 'Coding',
      targetLabel: '1 problem / day',
      color: '#E3242B',
      completedDates: offsetDays([1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 14, 15, 18, 20, 22]),
      archived: false,
      createdAt: now.toISOString(),
    },
    {
      id: 'habit_gym',
      title: 'Gym & Mobility',
      category: 'Fitness',
      targetLabel: '45 min workout',
      color: '#36D96B',
      completedDates: offsetDays([1, 2, 4, 6, 8, 9, 11, 13, 15, 17, 19, 21, 24]),
      archived: false,
      createdAt: now.toISOString(),
    },
    {
      id: 'habit_reading',
      title: 'Deep Reading',
      category: 'Study',
      targetLabel: '20 pages',
      color: '#2596EB',
      completedDates: offsetDays([1, 2, 3, 6, 7, 9, 12, 14, 16, 20]),
      archived: false,
      createdAt: now.toISOString(),
    },
  ];
}
