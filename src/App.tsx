import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onIdTokenChanged, signOut, User } from 'firebase/auth';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import {
  AlertTriangle,
  BellRing,
  Calendar,
  CheckSquare,
  Clock,
  Download,
  Flame,
  MessageSquare,
  Moon,
  Plus,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import { AuthGate } from './components/AuthGate';
import { PeekingCatSticker } from './components/CatStickers';
import { CoachChatView } from './components/CoachChatView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ExportModal } from './components/ExportModal';
import { FreeHoursView } from './components/FreeHoursView';
import { OfflineIndicator } from './components/PWAControls';
import { ScheduleView } from './components/ScheduleView';
import { SettingsModal, SettingsTabKey } from './components/SettingsModal';
import { StreakView } from './components/StreakView';
import { TaskModal } from './components/TaskModal';
import { TasksView } from './components/TasksView';
import { auth } from './firebase';
import { useDeadlineNotifications } from './hooks/useDeadlineNotifications';
import {
  CloudPlannerState,
  deleteHabitFromCloud,
  deleteTaskFromCloud,
  ensureUserProfileAndSeed,
  saveHabitToCloud,
  savePlannerStateToCloud,
  saveTaskToCloud,
  seedStarterHabitsToCloud,
  subscribeToPlannerState,
  subscribeToUserHabits,
  subscribeToUserTasks,
} from './services/firestoreSync';
import {
  ChatMessage,
  DailyHistoryMap,
  FreeWindow,
  GridSettings,
  Habit,
  HabitCategory,
  MoodType,
  Priority,
  ScheduleBlock,
  ScheduleStrategy,
  ScheduleWarning,
  Task,
  WeeklyFreeHours,
} from './types/grid';
import {
  calculateHabitStreak,
  calculateStreak,
  findOverdueUpcomingBlocks,
  generateOptimalSchedule,
  parseTimeToMinutes,
  toLocalDateString,
} from './utils/scheduler';
import { createInitialSeedData, createInitialSeedHabits, DEFAULT_SETTINGS } from './utils/seedData';
import { applyThemeToDocument, normalizePresetAndMode } from './utils/theme';

type TabKey = 'schedule' | 'tasks' | 'free-hours' | 'streak' | 'coach';

const STORAGE_PREFIX = 'grid_planner_state_v2_';
const CHAT_STORAGE_PREFIX = 'grid_chat_messages_v2_';
const THEME_MIGRATION_KEY = 'grid_theme_migrated_v3';
const LOGIN_THEME_KEY = 'grid_login_theme_mode';

interface PersistedState {
  tasks: Task[];
  habits: Habit[];
  weeklyFreeHours: WeeklyFreeHours;
  todayOverrideDate: string | null;
  todayOverrideWindows: FreeWindow[] | null;
  blocks: ScheduleBlock[];
  dailyHistory: DailyHistoryMap;
  settings: GridSettings;
  mood: MoodType;
  messages: ChatMessage[];
}

function buildDefaultState(): PersistedState {
  const seed = createInitialSeedData();
  let savedLoginMode: 'light' | 'dark' = 'light';
  try {
    if (localStorage.getItem(LOGIN_THEME_KEY) === 'dark') {
      savedLoginMode = 'dark';
    }
  } catch {
    // Ignore storage read error
  }
  return {
    tasks: seed.tasks,
    habits: seed.habits,
    weeklyFreeHours: seed.weeklyFreeHours,
    todayOverrideDate: null,
    todayOverrideWindows: null,
    blocks: seed.blocks,
    dailyHistory: seed.dailyHistory,
    settings: {
      ...seed.settings,
      theme: savedLoginMode,
    },
    mood: 'focused',
    messages: seed.messages,
  };
}

function loadCachedStateForUser(uid: string): PersistedState {
  const today = toLocalDateString();
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${uid}`);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedState;
      if (parsed && Array.isArray(parsed.tasks) && parsed.weeklyFreeHours) {
        const overrideValid = parsed.todayOverrideDate === today ? parsed.todayOverrideWindows : null;
        const normalized = normalizePresetAndMode(
          parsed.settings?.themePreset || DEFAULT_SETTINGS.themePreset,
          parsed.settings?.theme || 'light'
        );
        const accentColor = parsed.settings?.accentColor || DEFAULT_SETTINGS.accentColor;
        return {
          ...parsed,
          habits: Array.isArray(parsed.habits) ? parsed.habits : createInitialSeedHabits(),
          settings: {
            bufferMinutes: parsed.settings?.bufferMinutes ?? 10,
            autoRearrangeOnMiss: parsed.settings?.autoRearrangeOnMiss ?? true,
            dailyGoalTasks: parsed.settings?.dailyGoalTasks ?? 2,
            theme: normalized.mode,
            themePreset: normalized.preset.id,
            accentColor,
          },
          todayOverrideDate: overrideValid ? today : null,
          todayOverrideWindows: overrideValid,
        };
      }
    }
  } catch {
    // Fallback to default seed
  }
  return buildDefaultState();
}

function loadCachedMessagesForUser(uid: string, fallback: ChatMessage[]): ChatMessage[] {
  try {
    const raw = localStorage.getItem(`${CHAT_STORAGE_PREFIX}${uid}`);
    if (raw) {
      const parsed = JSON.parse(raw) as ChatMessage[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Ignore storage read error
  }
  return fallback;
}

function toCloudPlannerState(state: PersistedState): CloudPlannerState {
  const today = toLocalDateString();
  const hasValidOverride = state.todayOverrideDate === today && Array.isArray(state.todayOverrideWindows);
  return {
    mood: state.mood,
    todayOverrideDate: hasValidOverride ? today : '',
    todayOverrideWindows: hasValidOverride && state.todayOverrideWindows ? state.todayOverrideWindows : [],
    weeklyFreeHours: state.weeklyFreeHours,
    blocks: state.blocks,
    dailyHistory: state.dailyHistory,
    settings: state.settings,
  };
}

function GridWorkspace() {
  const [user, setUser] = useState<User | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [cloudReady, setCloudReady] = useState(false);
  const lastAuthUidRef = useRef<string | null>(null);

  const [state, setState] = useState<PersistedState>(buildDefaultState);
  const stateRef = useRef<PersistedState>(state);
  stateRef.current = state;

  const [activeTab, setActiveTab] = useState<TabKey>('schedule');
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTabKey>('account');
  const [, setProfileVersion] = useState(0);

  const openSettings = useCallback((tab: SettingsTabKey = 'account') => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  }, []);

  const [warnings, setWarnings] = useState<ScheduleWarning[]>([]);
  const [isOptimizingAI, setIsOptimizingAI] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [fatalSyncError, setFatalSyncError] = useState<Error | null>(null);

  if (fatalSyncError) {
    throw fatalSyncError;
  }

  // Apply dynamic theme preset + Day/Night mode + accent color tokens to document root
  useEffect(() => {
    applyThemeToDocument(
      state.settings.themePreset,
      state.settings.accentColor,
      state.settings.theme
    );
  }, [state.settings.themePreset, state.settings.accentColor, state.settings.theme]);

  // Listen for Firebase Authentication state + refreshed ID tokens
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setEmailVerified(Boolean(firebaseUser?.emailVerified));
      setAuthLoading(false);
      if (firebaseUser) {
        setAuthError(null);
        if (lastAuthUidRef.current !== firebaseUser.uid) {
          lastAuthUidRef.current = firebaseUser.uid;
          setState(loadCachedStateForUser(firebaseUser.uid));
        }
      } else {
        lastAuthUidRef.current = null;
        setCloudReady(false);
        setState(buildDefaultState());
      }
    });
    return () => unsubscribe();
  }, []);

  const userUid = user?.uid ?? null;

  const notifications = useDeadlineNotifications({
    uid: userUid,
    active: Boolean(userUid && emailVerified),
    tasks: state.tasks,
    blocks: state.blocks,
    habits: state.habits,
  });
  const alertBadgeCount = notifications.unreadCount + notifications.atRiskTasks.length;

  // Bootstrap Firestore profile + real-time subscriptions once verified user is logged in
  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!userUid || !emailVerified || !currentUser) {
      setCloudReady(false);
      return;
    }

    let cancelled = false;
    let unsubTasks: (() => void) | undefined;
    let unsubHabits: (() => void) | undefined;
    let unsubPlanner: (() => void) | undefined;

    const initCloud = async () => {
      try {
        await ensureUserProfileAndSeed(currentUser);
        if (cancelled) return;

        unsubTasks = subscribeToUserTasks(
          userUid,
          (cloudTasks) => {
            if (cancelled) return;
            const sorted = [...cloudTasks].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            setState((prev) => ({
              ...prev,
              tasks: sorted,
            }));
          },
          (err) => {
            if (!cancelled) setFatalSyncError(err);
          }
        );

        unsubHabits = subscribeToUserHabits(
          userUid,
          (cloudHabits) => {
            if (cancelled) return;
            const sorted = [...cloudHabits].sort(
              (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
            setState((prev) => ({
              ...prev,
              habits: sorted,
            }));
          },
          (err) => {
            if (!cancelled) setFatalSyncError(err);
          }
        );

        unsubPlanner = subscribeToPlannerState(
          userUid,
          (cloudPlanner) => {
            if (cancelled) return;
            const today = toLocalDateString();
            const overrideValid =
              cloudPlanner.todayOverrideDate === today ? cloudPlanner.todayOverrideWindows : null;
            const normalized = normalizePresetAndMode(
              cloudPlanner.settings?.themePreset || DEFAULT_SETTINGS.themePreset,
              cloudPlanner.settings?.theme || 'light'
            );

            let resolvedPreset = normalized.preset.id;
            let resolvedMode = normalized.mode;
            let resolvedAccent = cloudPlanner.settings?.accentColor || DEFAULT_SETTINGS.accentColor;
            let migratedToNewDefault = false;

            try {
              if (!localStorage.getItem(THEME_MIGRATION_KEY)) {
                localStorage.setItem(THEME_MIGRATION_KEY, '1');
                if (
                  cloudPlanner.settings?.themePreset === 'kaiju-comic' &&
                  cloudPlanner.settings?.accentColor?.toUpperCase() === '#72EC68'
                ) {
                  resolvedPreset = DEFAULT_SETTINGS.themePreset;
                  resolvedMode = DEFAULT_SETTINGS.theme;
                  resolvedAccent = DEFAULT_SETTINGS.accentColor;
                  migratedToNewDefault = true;
                }
              }
            } catch {
              // Ignore localStorage error
            }

            const nextSettings: GridSettings = cloudPlanner.settings
              ? {
                  ...cloudPlanner.settings,
                  themePreset: resolvedPreset,
                  theme: resolvedMode,
                  accentColor: resolvedAccent,
                }
              : stateRef.current.settings;

            const mergedState: PersistedState = {
              ...stateRef.current,
              mood: cloudPlanner.mood || 'focused',
              todayOverrideDate: overrideValid ? today : null,
              todayOverrideWindows: overrideValid,
              weeklyFreeHours: cloudPlanner.weeklyFreeHours || stateRef.current.weeklyFreeHours,
              blocks: cloudPlanner.blocks || [],
              dailyHistory: cloudPlanner.dailyHistory || {},
              settings: nextSettings,
              messages: loadCachedMessagesForUser(userUid, stateRef.current.messages),
            };

            setState(mergedState);
            if (migratedToNewDefault) {
              savePlannerStateToCloud(userUid, toCloudPlannerState(mergedState)).catch(() => {});
            }
            setCloudReady(true);
          },
          (err) => {
            if (!cancelled) setFatalSyncError(err);
          }
        );
      } catch (err) {
        if (!cancelled) {
          setFatalSyncError(
            err instanceof Error ? err : new Error('Could not sync your schedule right now. Please try again.')
          );
        }
      }
    };

    initCloud();

    return () => {
      cancelled = true;
      if (unsubTasks) unsubTasks();
      if (unsubHabits) unsubHabits();
      if (unsubPlanner) unsubPlanner();
    };
  }, [userUid, emailVerified]);

  // Persist user-scoped local cache for instant offline responsiveness
  useEffect(() => {
    if (!user) return;
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${user.uid}`, JSON.stringify(state));
      localStorage.setItem(`${CHAT_STORAGE_PREFIX}${user.uid}`, JSON.stringify(state.messages.slice(-60)));
    } catch {
      // Ignore storage quota errors
    }
  }, [state, user]);

  const showNotice = useCallback((msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => {
      setStatusNotice((prev) => (prev === msg ? null : prev));
    }, 4000);
  }, []);

  const persistPlannerToCloud = useCallback(
    (nextState: PersistedState) => {
      if (!user || !user.emailVerified) return;
      savePlannerStateToCloud(user.uid, toCloudPlannerState(nextState)).catch((err) => {
        console.error('Failed to sync planner state:', err);
      });
    },
    [user]
  );

  const persistTasksToCloud = useCallback(
    (tasksToSave: Task[], newTaskIds: Set<string> = new Set()) => {
      if (!user || !user.emailVerified) return;
      for (const task of tasksToSave) {
        saveTaskToCloud(user.uid, task, newTaskIds.has(task.id)).catch((err) => {
          console.error('Failed to sync task:', err);
        });
      }
    },
    [user]
  );

  const recomputeSchedule = useCallback(
    (
      nextState: PersistedState,
      options?: {
        strategy?: ScheduleStrategy;
        aiBoostMap?: Record<string, number>;
        rearrangedReason?: string;
      }
    ): PersistedState => {
      const { blocks, warnings: nextWarnings } = generateOptimalSchedule({
        tasks: nextState.tasks,
        weeklyFreeHours: nextState.weeklyFreeHours,
        todayOverrideWindows: nextState.todayOverrideWindows,
        existingBlocks: nextState.blocks,
        bufferMinutes: nextState.settings.bufferMinutes,
        mood: nextState.mood,
        strategy: options?.strategy,
        priorityOrderOverrides: options?.aiBoostMap,
        rearrangedReason: options?.rearrangedReason,
      });
      setWarnings(nextWarnings);
      return { ...nextState, blocks };
    },
    []
  );

  const overdueBlocks = useMemo(() => findOverdueUpcomingBlocks(state.blocks), [state.blocks]);

  // Automatic rearrange check on mount & interval if autoRearrangeOnMiss is enabled
  useEffect(() => {
    if (!user || !cloudReady) return;

    const checkAndAutoRearrange = () => {
      const curr = stateRef.current;
      if (!curr.settings.autoRearrangeOnMiss) return;
      const overdue = findOverdueUpcomingBlocks(curr.blocks);
      if (overdue.length === 0) return;

      const overdueTaskIds = new Set(overdue.map((b) => b.taskId));
      const todayStr = toLocalDateString();

      const changedTasks: Task[] = [];
      const updatedTasks = curr.tasks.map((t) => {
        if (overdueTaskIds.has(t.id) && t.status !== 'completed') {
          const updated: Task = { ...t, status: 'missed' };
          changedTasks.push(updated);
          return updated;
        }
        return t;
      });
      const prevToday = curr.dailyHistory[todayStr] || {
        completedCount: 0,
        missedCount: 0,
        focusMinutes: 0,
      };
      const updatedHistory: DailyHistoryMap = {
        ...curr.dailyHistory,
        [todayStr]: {
          ...prevToday,
          missedCount: prevToday.missedCount + overdue.length,
        },
      };
      const nextState = recomputeSchedule(
        {
          ...curr,
          tasks: updatedTasks,
          dailyHistory: updatedHistory,
        },
        {
          strategy: 'deadline_crunch',
          rearrangedReason: 'Auto-rearranged after missed slot',
        }
      );

      setState(nextState);
      persistTasksToCloud(changedTasks);
      persistPlannerToCloud(nextState);
      showNotice(`Auto-rearranged ${overdue.length} missed block(s) into upcoming free hours.`);
    };

    checkAndAutoRearrange();
    const timer = setInterval(checkAndAutoRearrange, 60000);
    return () => clearInterval(timer);
  }, [user, cloudReady, recomputeSchedule, persistTasksToCloud, persistPlannerToCloud, showNotice]);

  const streak = useMemo(() => calculateStreak(state.dailyHistory), [state.dailyHistory]);

  const habitStreakSummary = useMemo(() => {
    const todayStr = toLocalDateString();
    const active = state.habits.filter((h) => !h.archived);
    let topCurrentStreak = 0;
    let doneTodayCount = 0;
    for (const h of active) {
      const stats = calculateHabitStreak(h.completedDates, todayStr);
      if (stats.currentStreak > topCurrentStreak) topCurrentStreak = stats.currentStreak;
      if (stats.doneToday) doneTodayCount++;
    }
    return {
      topCurrentStreak,
      doneTodayCount,
      totalHabits: active.length,
    };
  }, [state.habits]);

  const todayBlocksSummary = useMemo(() => {
    const todayStr = toLocalDateString();
    const todayBlocks = state.blocks.filter((b) => b.date === todayStr);
    const done = todayBlocks.filter((b) => b.status === 'completed').length;
    return {
      done,
      total: todayBlocks.length,
    };
  }, [state.blocks]);

  const handleSaveHabit = (habitData: {
    id?: string;
    title: string;
    category: HabitCategory;
    targetLabel: string;
    color: string;
  }) => {
    const curr = stateRef.current;
    let nextHabits: Habit[];
    let savedHabit: Habit;
    let isNew = false;

    if (habitData.id) {
      const existing = curr.habits.find((h) => h.id === habitData.id);
      savedHabit = {
        id: habitData.id,
        title: habitData.title,
        category: habitData.category,
        targetLabel: habitData.targetLabel,
        color: habitData.color,
        completedDates: existing?.completedDates || [],
        archived: existing?.archived || false,
        createdAt: existing?.createdAt || new Date().toISOString(),
      };
      nextHabits = curr.habits.map((h) => (h.id === habitData.id ? savedHabit : h));
    } else {
      isNew = true;
      savedHabit = {
        id: `habit_${Date.now()}`,
        title: habitData.title,
        category: habitData.category,
        targetLabel: habitData.targetLabel,
        color: habitData.color,
        completedDates: [],
        archived: false,
        createdAt: new Date().toISOString(),
      };
      nextHabits = [...curr.habits, savedHabit];
    }

    setState((prev) => ({ ...prev, habits: nextHabits }));
    if (user && user.emailVerified) {
      saveHabitToCloud(user.uid, savedHabit, isNew).catch((err) => {
        console.error('Failed to save habit to cloud:', err);
      });
    }
    showNotice(habitData.id ? `Updated "${savedHabit.title}" habit.` : `Added "${savedHabit.title}" to Habit Streaks.`);
  };

  const handleToggleHabitDate = (habitId: string, dateStr: string) => {
    const curr = stateRef.current;
    const target = curr.habits.find((h) => h.id === habitId);
    if (!target) return;

    const alreadyDone = target.completedDates.includes(dateStr);
    const nextDates = alreadyDone
      ? target.completedDates.filter((d) => d !== dateStr)
      : Array.from(new Set([...target.completedDates, dateStr])).sort().slice(-365);

    const updatedHabit: Habit = {
      ...target,
      completedDates: nextDates,
    };

    setState((prev) => ({
      ...prev,
      habits: prev.habits.map((h) => (h.id === habitId ? updatedHabit : h)),
    }));
    if (user && user.emailVerified) {
      saveHabitToCloud(user.uid, updatedHabit, false).catch((err) => {
        console.error('Failed to toggle habit check-in:', err);
      });
    }
    showNotice(
      alreadyDone
        ? `Unchecked "${target.title}" for ${dateStr}.`
        : `Checked in "${target.title}" for ${dateStr}!`
    );
  };

  const handleDeleteHabit = (habitId: string) => {
    const curr = stateRef.current;
    const target = curr.habits.find((h) => h.id === habitId);
    setState((prev) => ({
      ...prev,
      habits: prev.habits.filter((h) => h.id !== habitId),
    }));
    if (user && user.emailVerified) {
      deleteHabitFromCloud(user.uid, habitId).catch((err) => {
        console.error('Failed to delete habit from cloud:', err);
      });
    }
    if (target) {
      showNotice(`Removed "${target.title}" habit.`);
    }
  };

  const handleLoadStarterHabits = async () => {
    if (!user || !user.emailVerified) return;
    try {
      const starters = await seedStarterHabitsToCloud(user.uid);
      setState((prev) => ({
        ...prev,
        habits: starters,
      }));
      showNotice('Loaded starter habits: LeetCode Daily, Gym & Mobility, and Deep Reading.');
    } catch (err) {
      console.error('Failed to load starter habits:', err);
    }
  };

  // Task CRUD handlers
  const handleSaveTask = (taskData: {
    id?: string;
    title: string;
    notes: string;
    priority: Priority;
    energyRequired: 'deep' | 'medium' | 'light';
    durationMinutes: number;
    deadline: string;
  }) => {
    const curr = stateRef.current;
    let nextTasks: Task[];
    let savedTask: Task;
    let isNew = false;

    if (taskData.id) {
      const existing = curr.tasks.find((t) => t.id === taskData.id);
      savedTask = {
        id: taskData.id,
        title: taskData.title,
        notes: taskData.notes,
        priority: taskData.priority,
        energyRequired: taskData.energyRequired,
        durationMinutes: taskData.durationMinutes,
        deadline: taskData.deadline,
        status: existing?.status === 'completed' ? 'completed' : 'scheduled',
        createdAt: existing?.createdAt || new Date().toISOString(),
        completedAt: existing?.completedAt,
      };
      nextTasks = curr.tasks.map((t) => (t.id === taskData.id ? savedTask : t));
    } else {
      isNew = true;
      savedTask = {
        id: `task_${Date.now()}`,
        title: taskData.title,
        notes: taskData.notes,
        priority: taskData.priority,
        energyRequired: taskData.energyRequired,
        durationMinutes: taskData.durationMinutes,
        deadline: taskData.deadline,
        status: 'scheduled',
        createdAt: new Date().toISOString(),
      };
      nextTasks = [savedTask, ...curr.tasks];
    }

    const nextState = recomputeSchedule({ ...curr, tasks: nextTasks });
    setState(nextState);
    if (user && user.emailVerified) {
      saveTaskToCloud(user.uid, savedTask, isNew).catch((err) => {
        console.error('Failed to save task to cloud:', err);
      });
      persistPlannerToCloud(nextState);
    }
    showNotice(taskData.id ? 'Task updated and schedule synced.' : 'Task added to your optimal schedule.');
  };

  const handleDeleteTask = (taskId: string) => {
    const curr = stateRef.current;
    const nextTasks = curr.tasks.filter((t) => t.id !== taskId);
    const nextBlocks = curr.blocks.filter((b) => b.taskId !== taskId);
    const nextState = recomputeSchedule({ ...curr, tasks: nextTasks, blocks: nextBlocks });
    setState(nextState);
    if (user && user.emailVerified) {
      deleteTaskFromCloud(user.uid, taskId).catch((err) => {
        console.error('Failed to delete task from cloud:', err);
      });
      persistPlannerToCloud(nextState);
    }
  };

  const handleToggleTaskComplete = (taskId: string) => {
    const curr = stateRef.current;
    const target = curr.tasks.find((t) => t.id === taskId);
    if (!target) return;

    const todayStr = toLocalDateString();
    const completing = target.status !== 'completed';
    const updatedTask: Task = {
      ...target,
      status: completing ? 'completed' : 'scheduled',
      completedAt: completing ? new Date().toISOString() : undefined,
    };

    const nextTasks = curr.tasks.map((t) => (t.id === taskId ? updatedTask : t));
    const nextBlocks = curr.blocks.map((b) =>
      b.taskId === taskId && completing ? { ...b, status: 'completed' as const } : b
    );

    const currentToday = curr.dailyHistory[todayStr] || {
      completedCount: 0,
      missedCount: 0,
      focusMinutes: 0,
    };
    const deltaCount = completing ? 1 : -1;
    const deltaMinutes = completing ? target.durationMinutes : -target.durationMinutes;

    const updatedHistory: DailyHistoryMap = {
      ...curr.dailyHistory,
      [todayStr]: {
        ...currentToday,
        completedCount: Math.max(0, currentToday.completedCount + deltaCount),
        focusMinutes: Math.max(0, currentToday.focusMinutes + deltaMinutes),
      },
    };

    const nextState = recomputeSchedule({
      ...curr,
      tasks: nextTasks,
      blocks: nextBlocks,
      dailyHistory: updatedHistory,
    });
    setState(nextState);
    persistTasksToCloud([updatedTask]);
    persistPlannerToCloud(nextState);
  };

  const handleCompleteBlock = (block: ScheduleBlock) => {
    const curr = stateRef.current;
    const todayStr = toLocalDateString();
    const blockMinutes = Math.max(
      15,
      parseTimeToMinutes(block.endTime) - parseTimeToMinutes(block.startTime)
    );

    const nextBlocks = curr.blocks.map((b) =>
      b.id === block.id ? { ...b, status: 'completed' as const } : b
    );
    const remainingParts = nextBlocks.filter(
      (b) => b.taskId === block.taskId && b.status === 'upcoming'
    );

    const changedTasks: Task[] = [];
    const nextTasks = curr.tasks.map((t) => {
      if (t.id === block.taskId && remainingParts.length === 0) {
        const updated: Task = {
          ...t,
          status: 'completed',
          completedAt: new Date().toISOString(),
        };
        changedTasks.push(updated);
        return updated;
      }
      return t;
    });

    const todayEntry = curr.dailyHistory[todayStr] || {
      completedCount: 0,
      missedCount: 0,
      focusMinutes: 0,
    };

    const nextState: PersistedState = {
      ...curr,
      tasks: nextTasks,
      blocks: nextBlocks,
      dailyHistory: {
        ...curr.dailyHistory,
        [todayStr]: {
          ...todayEntry,
          completedCount: todayEntry.completedCount + 1,
          focusMinutes: todayEntry.focusMinutes + blockMinutes,
        },
      },
    };

    setState(nextState);
    if (changedTasks.length > 0) persistTasksToCloud(changedTasks);
    persistPlannerToCloud(nextState);
    showNotice('Block completed — streak updated.');
  };

  const handleMissBlock = (block: ScheduleBlock) => {
    const curr = stateRef.current;
    const todayStr = toLocalDateString();
    const changedTasks: Task[] = [];

    const nextTasks = curr.tasks.map((t) => {
      if (t.id === block.taskId) {
        const updated: Task = { ...t, status: 'missed' };
        changedTasks.push(updated);
        return updated;
      }
      return t;
    });
    const todayEntry = curr.dailyHistory[todayStr] || {
      completedCount: 0,
      missedCount: 0,
      focusMinutes: 0,
    };
    const updatedHistory: DailyHistoryMap = {
      ...curr.dailyHistory,
      [todayStr]: {
        ...todayEntry,
        missedCount: todayEntry.missedCount + 1,
      },
    };
    const nextState = recomputeSchedule(
      {
        ...curr,
        tasks: nextTasks,
        dailyHistory: updatedHistory,
      },
      {
        strategy: 'deadline_crunch',
        rearrangedReason: 'Rescheduled after missed block',
      }
    );

    setState(nextState);
    if (changedTasks.length > 0) persistTasksToCloud(changedTasks);
    persistPlannerToCloud(nextState);
    showNotice('Missed block automatically moved to your next open free hours.');
  };

  const handleAutoRearrangeMissed = () => {
    const curr = stateRef.current;
    const overdueIds = new Set(overdueBlocks.map((b) => b.taskId));
    const changedTasks: Task[] = [];
    const nextTasks = curr.tasks.map((t) => {
      if (overdueIds.has(t.id) && t.status !== 'completed') {
        const updated: Task = { ...t, status: 'missed' };
        changedTasks.push(updated);
        return updated;
      }
      return t;
    });
    const nextState = recomputeSchedule(
      { ...curr, tasks: nextTasks },
      {
        strategy: 'deadline_crunch',
        rearrangedReason: 'Auto-rearranged missed deadline/block',
      }
    );
    setState(nextState);
    if (changedTasks.length > 0) persistTasksToCloud(changedTasks);
    persistPlannerToCloud(nextState);
    showNotice('Missed blocks rearranged into your next available free hours.');
  };

  const handleOptimizeLocal = () => {
    setAiError(null);
    const curr = stateRef.current;
    const nextState = recomputeSchedule(curr, {
      rearrangedReason: `Aligned with ${curr.mood} mood`,
    });
    setState(nextState);
    persistPlannerToCloud(nextState);
    showNotice('Schedule recomputed around your free hours and deadlines.');
  };

  const handleOptimizeWithAI = async () => {
    const curr = stateRef.current;
    setIsOptimizingAI(true);
    setAiError(null);
    try {
      const res = await fetch('/api/schedule/ai-optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: curr.tasks.filter((t) => t.status !== 'completed'),
          mood: curr.mood,
          freeHours: curr.weeklyFreeHours,
          currentTime: new Date().toISOString(),
          reason: `Optimize schedule for ${curr.mood} mood`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'AI schedule optimization failed.');
      }

      const boostMap: Record<string, number> = {};
      if (Array.isArray(data.taskWeights)) {
        for (const item of data.taskWeights) {
          if (item && item.taskId) {
            boostMap[item.taskId] = Number(item.boostScore) || 0;
          }
        }
      }

      const validStrategy: ScheduleStrategy = [
        'balanced',
        'light_recovery',
        'deadline_crunch',
        'deep_focus',
      ].includes(data.strategy)
        ? data.strategy
        : 'balanced';

      const latest = stateRef.current;
      const nextState = recomputeSchedule(latest, {
        strategy: validStrategy,
        aiBoostMap: boostMap,
        rearrangedReason: `AI optimized (${latest.mood})`,
      });
      setState(nextState);
      persistPlannerToCloud(nextState);
      setAiExplanation(data.summary || 'Schedule optimized with AI.');
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unable to reach AI optimizer.');
    } finally {
      setIsOptimizingAI(false);
    }
  };

  const handleSendChat = async (text: string) => {
    const curr = stateRef.current;
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      mood: curr.mood,
    };

    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMsg],
    }));
    setIsSendingChat(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          mood: curr.mood,
          tasks: curr.tasks.filter((t) => t.status !== 'completed'),
          schedule: curr.blocks.filter((b) => b.status === 'upcoming'),
          freeHours: curr.weeklyFreeHours,
          streak,
          currentTime: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to get AI coach response.');
      }

      const detectedMood = ['focused', 'energized', 'tired', 'stressed', 'overwhelmed'].includes(
        data.moodDetected
      )
        ? (data.moodDetected as MoodType)
        : curr.mood;

      const validStrategy: ScheduleStrategy = [
        'balanced',
        'light_recovery',
        'deadline_crunch',
        'deep_focus',
      ].includes(data.strategy)
        ? data.strategy
        : 'balanced';

      const strategyLabels: Record<ScheduleStrategy, string> = {
        balanced: 'Balanced',
        light_recovery: 'Light Recovery',
        deadline_crunch: 'Deadline Rescue',
        deep_focus: 'Deep Focus',
      };

      const latest = stateRef.current;
      let nextState: PersistedState = {
        ...latest,
        mood: detectedMood,
      };
      const changedTasks: Task[] = [];

      if (data.shouldRearrange) {
        const boostMap: Record<string, number> = {};
        let updatedTasks = latest.tasks;

        if (Array.isArray(data.taskAdjustments)) {
          const adjustmentMap = new Map<string, { newPriority?: Priority; boostScore?: number }>();
          for (const adj of data.taskAdjustments) {
            if (adj && adj.taskId) {
              adjustmentMap.set(adj.taskId, adj);
              if (typeof adj.boostScore === 'number') {
                boostMap[adj.taskId] = adj.boostScore;
              }
            }
          }
          updatedTasks = latest.tasks.map((t) => {
            const adj = adjustmentMap.get(t.id);
            if (!adj) return t;
            const nextPriority =
              adj.newPriority && ['high', 'medium', 'low'].includes(adj.newPriority)
                ? adj.newPriority
                : t.priority;
            if (nextPriority !== t.priority) {
              const modified = { ...t, priority: nextPriority };
              changedTasks.push(modified);
              return modified;
            }
            return t;
          });
        }

        nextState = recomputeSchedule(
          { ...nextState, tasks: updatedTasks },
          {
            strategy: validStrategy,
            aiBoostMap: boostMap,
            rearrangedReason: data.rearrangedReason || `Echo · ${strategyLabels[validStrategy]}`,
          }
        );
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.reply || 'I updated your plan.',
        timestamp: new Date().toISOString(),
        appliedRearrange: Boolean(data.shouldRearrange),
        strategyLabel: strategyLabels[validStrategy],
        suggestedPrompts: Array.isArray(data.suggestedPrompts) ? data.suggestedPrompts.slice(0, 3) : [],
      };

      const finalState: PersistedState = {
        ...nextState,
        messages: [...nextState.messages, assistantMsg],
      };

      setState(finalState);
      if (changedTasks.length > 0) persistTasksToCloud(changedTasks);
      persistPlannerToCloud(finalState);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: err instanceof Error ? err.message : 'Unable to connect to Echo right now.',
        timestamp: new Date().toISOString(),
        isError: true,
      };
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, errorMsg],
      }));
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setAuthError(null);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Failed to sign out cleanly.');
    }
  };

  const handleChangeThemeMode = useCallback(
    (nextMode: 'light' | 'dark') => {
      try {
        localStorage.setItem(LOGIN_THEME_KEY, nextMode);
      } catch {
        // Ignore storage errors
      }
      const curr = stateRef.current;
      const nextState: PersistedState = {
        ...curr,
        settings: {
          ...curr.settings,
          theme: nextMode,
        },
      };
      setState(nextState);
      if (user && user.emailVerified) {
        persistPlannerToCloud(nextState);
      }
    },
    [user, persistPlannerToCloud]
  );

  const handleToggleThemeMode = useCallback(() => {
    const nextMode = stateRef.current.settings.theme === 'dark' ? 'light' : 'dark';
    handleChangeThemeMode(nextMode);
  }, [handleChangeThemeMode]);

  const handleRefreshVerification = useCallback(async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true);
    setUser(auth.currentUser);
    setEmailVerified(Boolean(auth.currentUser.emailVerified));
  }, []);

  // Show loading card while Firebase Auth resolves session
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas)] p-6 text-[var(--text-primary)]">
        <div className="tactile-card flex items-center gap-3.5 px-6 py-5">
          <img
            src="/icon.svg"
            alt="Grid logo"
            className="h-9 w-9 shrink-0 drop-shadow-[2px_2px_0px_var(--border-subtle)]"
          />
          <div>
            <p className="font-display text-base font-extrabold tracking-tight">GRID</p>
            <p className="text-xs text-[var(--text-secondary)]">Loading your workspace…</p>
          </div>
        </div>
      </div>
    );
  }

  // Gate unauthenticated or unverified sessions behind AuthGate
  if (!user) {
    return (
      <AuthGate
        authError={authError}
        themeMode={state.settings.theme}
        onToggleThemeMode={handleToggleThemeMode}
      />
    );
  }

  if (!emailVerified) {
    return (
      <AuthGate
        authError={authError}
        themeMode={state.settings.theme}
        onToggleThemeMode={handleToggleThemeMode}
        unverifiedUser={user}
        onRefreshVerification={handleRefreshVerification}
      />
    );
  }

  const navItems: {
    key: TabKey;
    label: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { key: 'schedule', label: 'Schedule', shortLabel: 'Schedule', icon: Calendar },
    { key: 'tasks', label: 'Tasks', shortLabel: 'Tasks', icon: CheckSquare },
    { key: 'free-hours', label: 'Free Hours', shortLabel: 'Free', icon: Clock },
    { key: 'streak', label: 'Habit Streaks', shortLabel: 'Habits', icon: Flame },
    { key: 'coach', label: 'Chat with Echo', shortLabel: 'Echo', icon: MessageSquare },
  ];

  const pageTitleMap: Record<TabKey, string> = {
    schedule: 'Optimal Schedule',
    tasks: 'Tasks & Deadlines',
    'free-hours': 'Free Hours & Rules',
    streak: 'Habit Streak Manager',
    coach: 'Chat with Echo',
  };

  const userInitial = (user.displayName || user.email || 'G').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* Mobile Top Bar (48px - well under 15% sticky cap with 56px bottom nav) */}
      <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b-2 border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 px-4 backdrop-blur-md lg:hidden">
        <div className="flex items-center gap-2">
          <img
            src="/icon.svg"
            alt="Grid logo"
            className="h-8 w-8 shrink-0 drop-shadow-[1.5px_1.5px_0px_var(--border-subtle)]"
          />
          <span className="font-display text-base font-extrabold tracking-tight">GRID</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleToggleThemeMode}
            aria-label={state.settings.theme === 'dark' ? 'Switch to Day mode' : 'Switch to Night mode'}
            title={state.settings.theme === 'dark' ? 'Day mode' : 'Night mode'}
            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-transparent text-[var(--text-secondary)] hover:border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
          >
            {state.settings.theme === 'dark' ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            aria-label="Export schedule, habits, or backup"
            title="Export data"
            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-transparent text-[var(--text-secondary)] hover:border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => openSettings(alertBadgeCount > 0 ? 'notifications' : 'account')}
            aria-label="Settings"
            title="Settings"
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border-2 border-transparent text-[var(--text-secondary)] hover:border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
          >
            <Settings className="h-4 w-4" />
            {alertBadgeCount > 0 && (
              <span
                className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border border-[var(--bg-surface)]"
                style={{ backgroundColor: 'var(--accent)' }}
              />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingTask(null);
              setTaskModalOpen(true);
            }}
            className="comic-btn inline-flex h-9 items-center gap-1 whitespace-nowrap rounded-xl px-3 text-xs font-bold"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-contrast)',
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Task</span>
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1440px]">
        {/* Desktop Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between border-r-2 border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 lg:flex">
          <div>
            <div className="flex items-center gap-2.5 px-1">
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

            <nav className="mt-7 space-y-1.5" aria-label="Primary navigation">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveTab(item.key)}
                    className={`relative flex min-h-[44px] w-full items-center gap-3 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-bold transition-colors ${
                      active
                        ? 'text-[var(--accent-contrast)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="active-sidebar-nav"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                        className="absolute inset-0 rounded-xl border-2 border-[var(--border-subtle)] shadow-[3px_3px_0px_var(--border-subtle)]"
                        style={{ backgroundColor: 'var(--accent)' }}
                      />
                    )}
                    <Icon className="relative z-10 h-4 w-4 shrink-0" />
                    <span className="relative z-10">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="space-y-3 border-t-2 border-[var(--border-subtle)] pt-4">
            {/* Today's Pulse Mini Progress Card */}
            <div className="space-y-2.5 rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3 text-xs">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--text-secondary)]">Today’s Blocks</span>
                  <span className="font-mono font-bold tabular-nums text-[var(--text-primary)]">
                    {todayBlocksSummary.done}/{todayBlocksSummary.total}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${
                        todayBlocksSummary.total > 0
                          ? Math.round((todayBlocksSummary.done / todayBlocksSummary.total) * 100)
                          : 0
                      }%`,
                      backgroundColor: 'var(--accent)',
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--text-secondary)]">Habit Streaks</span>
                  <span className="font-mono font-bold tabular-nums text-[var(--text-primary)]">
                    {habitStreakSummary.topCurrentStreak}d · {habitStreakSummary.doneTodayCount}/{habitStreakSummary.totalHabits}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${
                        habitStreakSummary.totalHabits > 0
                          ? Math.round((habitStreakSummary.doneTodayCount / habitStreakSummary.totalHabits) * 100)
                          : 0
                      }%`,
                      backgroundColor: '#266B43',
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleThemeMode}
                aria-label={state.settings.theme === 'dark' ? 'Switch to Day mode' : 'Switch to Night mode'}
                title={state.settings.theme === 'dark' ? 'Switch to Day mode' : 'Switch to Night mode'}
                className="comic-btn flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-xl bg-[var(--bg-subtle)] text-[var(--text-primary)]"
              >
                {state.settings.theme === 'dark' ? (
                  <Sun className="h-4 w-4 text-amber-400" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => openSettings(alertBadgeCount > 0 ? 'notifications' : 'account')}
                aria-label="Settings"
                title="Account, Theme & Notifications"
                className="comic-btn relative flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--bg-subtle)] px-2.5 text-xs font-bold text-[var(--text-primary)]"
              >
                <Settings className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                <span>Settings</span>
                {alertBadgeCount > 0 && (
                  <span
                    className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full border border-[#141923] px-1 font-mono text-[9px] font-extrabold"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'var(--accent-contrast)',
                    }}
                  >
                    {alertBadgeCount > 9 ? '9+' : alertBadgeCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setExportModalOpen(true)}
                aria-label="Export data"
                title="Export Calendar, Habits CSV & Backup"
                className="comic-btn flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-xl bg-[var(--bg-subtle)] text-[var(--text-primary)]"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Compact Account Badge (opens Settings → Account) */}
            <div className="relative pt-4">
              <div className="pointer-events-auto absolute right-3 -top-2 z-10">
                <PeekingCatSticker className="h-9 w-14" />
              </div>
              <button
                type="button"
                onClick={() => openSettings('account')}
                title="Manage account"
                className="relative z-20 flex w-full items-center gap-2.5 rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-2.5 text-left transition-colors hover:bg-[var(--bg-subtle)]"
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Account avatar'}
                    referrerPolicy="no-referrer"
                    className="h-8 w-8 shrink-0 rounded-lg border-2 border-[var(--border-subtle)] object-cover"
                  />
                ) : (
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-[var(--border-subtle)] font-display text-xs font-extrabold"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'var(--accent-contrast)',
                    }}
                  >
                    {userInitial}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-[var(--text-primary)]">
                    {user.displayName || 'Grid User'}
                  </p>
                  <p className="truncate text-[10px] text-[var(--text-secondary)]">{user.email}</p>
                </div>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Workspace */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Desktop Top Bar (3-zone contract) */}
          <header className="hidden items-center justify-between gap-8 border-b-2 border-[var(--border-subtle)] bg-[var(--bg-surface)] px-8 py-4 lg:flex">
            <h1 className="font-display text-xl font-extrabold tracking-tight whitespace-nowrap shrink-0 text-[var(--text-primary)]">
              {pageTitleMap[activeTab]}
            </h1>

            <div className="flex items-center gap-6 text-xs font-semibold text-[var(--text-secondary)]">
              <span className="font-mono tabular-nums whitespace-nowrap">
                {state.tasks.filter((t) => t.status !== 'completed').length} active tasks
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums whitespace-nowrap">
                {habitStreakSummary.doneTodayCount}/{habitStreakSummary.totalHabits} habits today
              </span>
              <span aria-hidden="true">·</span>
              <span className="capitalize whitespace-nowrap">Mood: {state.mood}</span>
            </div>

            <motion.button
              type="button"
              whileHover={{ y: -1 }}
              whileTap={{ x: 2, y: 2 }}
              onClick={() => {
                setEditingTask(null);
                setTaskModalOpen(true);
              }}
              className="comic-btn inline-flex min-h-[42px] items-center gap-2 whitespace-nowrap shrink-0 rounded-xl px-4 py-2 text-xs font-extrabold"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-contrast)',
              }}
            >
              <Plus className="h-4 w-4" />
              <span>Add Task</span>
            </motion.button>
          </header>

          {/* Main Content + Persistent Coach Panel on XL Desktop */}
          <main className="flex-1 px-4 py-5 pb-24 sm:px-6 lg:px-8 lg:py-6 lg:pb-8">
            <AnimatePresence>
              {statusNotice && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  role="status"
                  className="mb-5 rounded-xl border-2 border-[var(--border-subtle)] px-4 py-2.5 text-xs font-bold shadow-[2px_2px_0px_var(--border-subtle)]"
                  style={{
                    backgroundColor: 'var(--accent-soft)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {statusNotice}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 xl:items-start">
              <div className={activeTab === 'coach' ? 'xl:col-span-12' : 'xl:col-span-8'}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.16, ease: 'easeOut' }}
                  >
                    {activeTab === 'schedule' && (
                      <ScheduleView
                        blocks={state.blocks}
                        tasks={state.tasks}
                        weeklyFreeHours={state.weeklyFreeHours}
                        todayOverrideWindows={state.todayOverrideWindows}
                        mood={state.mood}
                        warnings={warnings}
                        overdueBlocks={overdueBlocks}
                        isOptimizingAI={isOptimizingAI}
                        aiExplanation={aiExplanation}
                        aiError={aiError}
                        onChangeMood={(nextMood) => {
                          const nextState = recomputeSchedule({ ...stateRef.current, mood: nextMood });
                          setState(nextState);
                          persistPlannerToCloud(nextState);
                        }}
                        onOptimizeLocal={handleOptimizeLocal}
                        onOptimizeWithAI={handleOptimizeWithAI}
                        onAutoRearrangeMissed={handleAutoRearrangeMissed}
                        onCompleteBlock={handleCompleteBlock}
                        onMissBlock={handleMissBlock}
                        onOpenCoach={(prefill) => {
                          setActiveTab('coach');
                          if (prefill) handleSendChat(prefill);
                        }}
                        onAddTask={() => {
                          setEditingTask(null);
                          setTaskModalOpen(true);
                        }}
                        onGoToFreeHours={() => setActiveTab('free-hours')}
                      />
                    )}

                    {activeTab === 'tasks' && (
                      <TasksView
                        tasks={state.tasks}
                        onAddTask={() => {
                          setEditingTask(null);
                          setTaskModalOpen(true);
                        }}
                        onEditTask={(task) => {
                          setEditingTask(task);
                          setTaskModalOpen(true);
                        }}
                        onDeleteTask={handleDeleteTask}
                        onToggleComplete={handleToggleTaskComplete}
                        onRescheduleAll={handleOptimizeLocal}
                      />
                    )}

                    {activeTab === 'free-hours' && (
                      <FreeHoursView
                        weeklyFreeHours={state.weeklyFreeHours}
                        todayOverrideWindows={state.todayOverrideWindows}
                        settings={state.settings}
                        onUpdateWeeklyFreeHours={(updated) => {
                          const nextState = recomputeSchedule({
                            ...stateRef.current,
                            weeklyFreeHours: updated,
                          });
                          setState(nextState);
                          persistPlannerToCloud(nextState);
                          showNotice('Weekly free hours updated & schedule recomputed.');
                        }}
                        onUpdateTodayOverride={(windows) => {
                          const today = toLocalDateString();
                          const nextState = recomputeSchedule({
                            ...stateRef.current,
                            todayOverrideDate: windows !== null ? today : null,
                            todayOverrideWindows: windows,
                          });
                          setState(nextState);
                          persistPlannerToCloud(nextState);
                          showNotice(
                            windows !== null
                              ? 'Today’s custom free hours applied to your schedule.'
                              : 'Reverted today to weekly default free hours.'
                          );
                        }}
                        onUpdateSettings={(nextSettings) => {
                          const nextState = recomputeSchedule({
                            ...stateRef.current,
                            settings: nextSettings,
                          });
                          setState(nextState);
                          persistPlannerToCloud(nextState);
                        }}
                        onOpenAppearance={() => openSettings('theme')}
                        onOpenExport={() => setExportModalOpen(true)}
                      />
                    )}

                    {activeTab === 'streak' && (
                      <StreakView
                        habits={state.habits}
                        taskStreak={streak}
                        dailyHistory={state.dailyHistory}
                        onSaveHabit={handleSaveHabit}
                        onToggleHabitDate={handleToggleHabitDate}
                        onDeleteHabit={handleDeleteHabit}
                        onLoadStarterHabits={handleLoadStarterHabits}
                        onOpenExport={() => setExportModalOpen(true)}
                      />
                    )}

                    {activeTab === 'coach' && (
                      <CoachChatView
                        messages={state.messages}
                        mood={state.mood}
                        isSending={isSendingChat}
                        onChangeMood={(nextMood) => {
                          const nextState = recomputeSchedule({ ...stateRef.current, mood: nextMood });
                          setState(nextState);
                          persistPlannerToCloud(nextState);
                        }}
                        onSendMessage={handleSendChat}
                        onGoToSchedule={() => setActiveTab('schedule')}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Persistent AI Support Panel on XL Desktop */}
              {activeTab !== 'coach' && (
                <div className="hidden xl:sticky xl:top-6 xl:col-span-4 xl:block">
                  <CoachChatView
                    messages={state.messages}
                    mood={state.mood}
                    isSending={isSendingChat}
                    onChangeMood={(nextMood) => {
                      const nextState = recomputeSchedule({ ...stateRef.current, mood: nextMood });
                      setState(nextState);
                      persistPlannerToCloud(nextState);
                    }}
                    onSendMessage={handleSendChat}
                    onGoToSchedule={() => setActiveTab('schedule')}
                    compactPanel
                  />
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Mobile Bottom Thumb-Zone Navigation Bar (56px) */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-40 grid h-14 grid-cols-5 items-center border-t-2 border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 pb-safe backdrop-blur-md lg:hidden"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveTab(item.key)}
              className={`relative flex min-h-[44px] flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? 'font-bold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
              }`}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 h-1 w-8 rounded-b-full"
                  style={{ backgroundColor: 'var(--accent)' }}
                />
              )}
              <Icon className="h-5 w-5" />
              <span className="text-[10px] tracking-tight">{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>

      <OfflineIndicator />

      <TaskModal
        open={taskModalOpen}
        editingTask={editingTask}
        onClose={() => {
          setTaskModalOpen(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTask}
      />

      <SettingsModal
        open={settingsOpen}
        initialTab={settingsTab}
        onClose={() => setSettingsOpen(false)}
        user={user}
        onProfileUpdated={() => setProfileVersion((v) => v + 1)}
        onOpenExport={() => setExportModalOpen(true)}
        onSignOut={handleSignOut}
        themePreset={state.settings.themePreset}
        themeMode={state.settings.theme}
        accentColor={state.settings.accentColor}
        onChangeThemePreset={(presetId) => {
          const curr = stateRef.current;
          const nextState: PersistedState = {
            ...curr,
            settings: {
              ...curr.settings,
              themePreset: presetId,
            },
          };
          setState(nextState);
          persistPlannerToCloud(nextState);
        }}
        onChangeAccentColor={(hex) => {
          const curr = stateRef.current;
          const nextState: PersistedState = {
            ...curr,
            settings: {
              ...curr.settings,
              accentColor: hex,
            },
          };
          setState(nextState);
          persistPlannerToCloud(nextState);
        }}
        onResetThemeDefaults={() => {
          const curr = stateRef.current;
          const nextState: PersistedState = {
            ...curr,
            settings: {
              ...curr.settings,
              themePreset: DEFAULT_SETTINGS.themePreset,
              accentColor: DEFAULT_SETTINGS.accentColor,
            },
          };
          setState(nextState);
          persistPlannerToCloud(nextState);
        }}
        permission={notifications.permission}
        prefs={notifications.prefs}
        pushSubscribed={notifications.pushSubscribed}
        atRiskTasks={notifications.atRiskTasks}
        recentAlerts={notifications.recentAlerts}
        onEnableNotifications={notifications.requestPermissionAndEnable}
        onUpdatePrefs={notifications.updatePrefs}
        onSendTest={notifications.sendTestNotification}
        onClearLog={notifications.clearAlertLog}
        onMarkAlertsRead={notifications.markAlertsRead}
        onAskEchoAboutTask={(prompt) => {
          setActiveTab('coach');
          handleSendChat(prompt);
        }}
      />

      {/* Live In-App Deadline / Alert Toast */}
      <AnimatePresence>
        {notifications.activeToast && (
          <motion.div
            key={notifications.activeToast.id}
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            role="alert"
            className="tactile-card fixed right-4 top-14 z-50 w-[calc(100vw-2rem)] max-w-sm p-3.5 lg:top-5"
          >
            <div className="flex items-start gap-2.5">
              <div
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-[var(--border-subtle)]"
                style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
              >
                {notifications.activeToast.kind.startsWith('deadline') ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <BellRing className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold text-[var(--text-primary)]">
                  {notifications.activeToast.title}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-secondary)]">
                  {notifications.activeToast.body}
                </p>
                {notifications.activeToast.taskTitle && (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const title = notifications.activeToast?.taskTitle || 'my task';
                        notifications.dismissToast();
                        setActiveTab('coach');
                        handleSendChat(
                          `I'm about to miss "${title}". Please rearrange my schedule right away so I can finish it.`
                        );
                      }}
                      className="comic-btn inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-extrabold"
                      style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
                    >
                      <MessageSquare className="h-3 w-3" />
                      <span>Ask Echo to Reschedule</span>
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={notifications.dismissToast}
                aria-label="Dismiss alert"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        userEmail={user.email}
        tasks={state.tasks}
        habits={state.habits}
        blocks={state.blocks}
        weeklyFreeHours={state.weeklyFreeHours}
        dailyHistory={state.dailyHistory}
        settings={state.settings}
        mood={state.mood}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <GridWorkspace />
      </MotionConfig>
    </ErrorBoundary>
  );
}
