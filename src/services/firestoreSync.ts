import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  DailyHistoryMap,
  FreeWindow,
  GridSettings,
  Habit,
  HabitCategory,
  MoodType,
  ScheduleBlock,
  Task,
  WeeklyFreeHours,
} from '../types/grid';
import { createInitialSeedData, createInitialSeedHabits } from '../utils/seedData';
import { normalizeHex, normalizePresetAndMode } from '../utils/theme';

export interface CloudPlannerState {
  mood: MoodType;
  todayOverrideDate: string;
  todayOverrideWindows: FreeWindow[];
  weeklyFreeHours: WeeklyFreeHours;
  blocks: ScheduleBlock[];
  dailyHistory: DailyHistoryMap;
  settings: GridSettings;
}

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned || `id_${Date.now()}`;
}

function sanitizeTaskPayload(task: Task, uid: string, isNew: boolean) {
  const safeId = sanitizeId(task.id);
  const base: Record<string, unknown> = {
    id: safeId,
    ownerId: uid,
    title: String(task.title || 'Untitled Task').trim().slice(0, 200) || 'Untitled Task',
    notes: String(task.notes || '').slice(0, 1000),
    priority: ['high', 'medium', 'low'].includes(task.priority) ? task.priority : 'medium',
    energyRequired: ['deep', 'medium', 'light'].includes(task.energyRequired)
      ? task.energyRequired
      : 'medium',
    durationMinutes: Math.max(15, Math.min(480, Math.round(Number(task.durationMinutes) || 30))),
    deadline: String(task.deadline || new Date().toISOString().slice(0, 16)).slice(0, 40),
    status: ['pending', 'scheduled', 'completed', 'missed'].includes(task.status)
      ? task.status
      : 'scheduled',
    updatedAt: serverTimestamp(),
  };

  if (isNew) {
    base.createdAt = serverTimestamp();
  }
  if (task.completedAt && task.status === 'completed') {
    base.completedAt = String(task.completedAt).slice(0, 40);
  }
  return base;
}

const VALID_HABIT_CATEGORIES: HabitCategory[] = ['Coding', 'Fitness', 'Study', 'Wellness', 'Other'];

function sanitizeHabitPayload(habit: Habit, uid: string, isNew: boolean) {
  const safeId = sanitizeId(habit.id);
  const cleanDates = Array.from(
    new Set(
      (habit.completedDates || [])
        .map((d) => String(d).trim().slice(0, 20))
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    )
  )
    .sort()
    .slice(-365);

  const base: Record<string, unknown> = {
    id: safeId,
    ownerId: uid,
    title: String(habit.title || 'Daily Habit').trim().slice(0, 80) || 'Daily Habit',
    category: VALID_HABIT_CATEGORIES.includes(habit.category) ? habit.category : 'Other',
    targetLabel: String(habit.targetLabel || '').trim().slice(0, 60),
    color: (normalizeHex(habit.color) || '#E3242B').slice(0, 16),
    completedDates: cleanDates,
    archived: Boolean(habit.archived),
    updatedAt: serverTimestamp(),
  };

  if (isNew) {
    base.createdAt = serverTimestamp();
  }
  return base;
}

function sanitizeSettings(settings: GridSettings): GridSettings {
  const { preset, mode } = normalizePresetAndMode(settings.themePreset, settings.theme);
  return {
    bufferMinutes: Math.max(0, Math.min(60, Math.round(Number(settings.bufferMinutes) || 10))),
    autoRearrangeOnMiss: Boolean(settings.autoRearrangeOnMiss),
    dailyGoalTasks: Math.max(1, Math.min(10, Math.round(Number(settings.dailyGoalTasks) || 2))),
    theme: mode,
    themePreset: preset.id,
    accentColor: normalizeHex(settings.accentColor) || preset.defaultAccent,
  };
}

function sanitizeWeeklyFreeHours(weekly: WeeklyFreeHours): Record<string, FreeWindow[]> {
  const out: Record<string, FreeWindow[]> = {};
  for (let i = 0; i <= 6; i++) {
    const list = weekly[i] || [];
    out[String(i)] = list.slice(0, 12).map((w, idx) => ({
      id: sanitizeId(w.id || `fw-${i}-${idx}`),
      start: String(w.start || '09:00').slice(0, 10),
      end: String(w.end || '10:00').slice(0, 10),
      label: String(w.label || 'Free Window').slice(0, 60),
    }));
  }
  return out;
}

function sanitizePlannerPayload(state: CloudPlannerState, uid: string) {
  const cleanBlocks = (state.blocks || []).slice(0, 200).map((b) => ({
    id: sanitizeId(b.id),
    taskId: sanitizeId(b.taskId),
    taskTitle: String(b.taskTitle || '').slice(0, 200),
    priority: b.priority,
    energyRequired: b.energyRequired,
    deadline: String(b.deadline || '').slice(0, 40),
    date: String(b.date || '').slice(0, 20),
    startTime: String(b.startTime || '').slice(0, 10),
    endTime: String(b.endTime || '').slice(0, 10),
    status: b.status,
    ...(b.partLabel ? { partLabel: String(b.partLabel).slice(0, 30) } : {}),
    ...(b.rearrangedReason ? { rearrangedReason: String(b.rearrangedReason).slice(0, 120) } : {}),
  }));

  // Keep most recent 365 days of history to stay well within rules limits
  const historyEntries = Object.entries(state.dailyHistory || {}).slice(-365);
  const cleanHistory: DailyHistoryMap = {};
  for (const [k, v] of historyEntries) {
    cleanHistory[k.slice(0, 20)] = {
      completedCount: Math.max(0, Math.round(Number(v.completedCount) || 0)),
      missedCount: Math.max(0, Math.round(Number(v.missedCount) || 0)),
      focusMinutes: Math.max(0, Math.round(Number(v.focusMinutes) || 0)),
    };
  }

  return {
    ownerId: uid,
    mood: ['focused', 'energized', 'tired', 'stressed', 'overwhelmed'].includes(state.mood)
      ? state.mood
      : 'focused',
    todayOverrideDate: String(state.todayOverrideDate || '').slice(0, 20),
    todayOverrideWindows: (state.todayOverrideWindows || []).slice(0, 12).map((w, idx) => ({
      id: sanitizeId(w.id || `ov-${idx}`),
      start: String(w.start || '18:00').slice(0, 10),
      end: String(w.end || '19:00').slice(0, 10),
      label: String(w.label || 'Custom').slice(0, 60),
    })),
    weeklyFreeHours: sanitizeWeeklyFreeHours(state.weeklyFreeHours),
    blocks: cleanBlocks,
    dailyHistory: cleanHistory,
    settings: sanitizeSettings(state.settings),
    updatedAt: serverTimestamp(),
  };
}

export async function ensureUserProfileAndSeed(user: User): Promise<void> {
  const userRef = doc(db, 'users', user.uid);
  try {
    const userSnap = await getDoc(userRef);
    const profilePayload = {
      uid: user.uid,
      email: String(user.email || '').slice(0, 320),
      displayName: String(user.displayName || 'Grid User').slice(0, 120),
      photoURL: String(user.photoURL || '').slice(0, 500),
      updatedAt: serverTimestamp(),
    };

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        ...profilePayload,
        createdAt: serverTimestamp(),
      });
    } else {
      await setDoc(userRef, profilePayload, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }

  // Seed initial planner state + tasks on first login
  const plannerRef = doc(db, 'users', user.uid, 'planner', 'state');
  try {
    const plannerSnap = await getDoc(plannerRef);
    if (!plannerSnap.exists()) {
      const seed = createInitialSeedData();
      const batch = writeBatch(db);

      for (const t of seed.tasks) {
        const taskRef = doc(db, 'users', user.uid, 'tasks', sanitizeId(t.id));
        batch.set(taskRef, sanitizeTaskPayload(t, user.uid, true));
      }

      for (const h of seed.habits) {
        const habitRef = doc(db, 'users', user.uid, 'habits', sanitizeId(h.id));
        batch.set(habitRef, sanitizeHabitPayload(h, user.uid, true));
      }

      batch.set(
        plannerRef,
        sanitizePlannerPayload(
          {
            mood: 'focused',
            todayOverrideDate: '',
            todayOverrideWindows: [],
            weeklyFreeHours: seed.weeklyFreeHours,
            blocks: seed.blocks,
            dailyHistory: seed.dailyHistory,
            settings: seed.settings,
          },
          user.uid
        )
      );

      await batch.commit();
      try {
        localStorage.setItem(`grid_habits_seeded_v1_${user.uid}`, '1');
      } catch {
        // Ignore storage error
      }
    } else {
      // Existing user upgrading to separate Habit Streak Manager: seed starter habits once if empty
      const seededKey = `grid_habits_seeded_v1_${user.uid}`;
      let alreadySeeded = false;
      try {
        alreadySeeded = localStorage.getItem(seededKey) === '1';
      } catch {
        alreadySeeded = false;
      }

      if (!alreadySeeded) {
        const habitsQuery = query(
          collection(db, 'users', user.uid, 'habits'),
          where('ownerId', '==', user.uid),
          limit(1)
        );
        const existingHabits = await getDocs(habitsQuery);
        if (existingHabits.empty) {
          const starterHabits = createInitialSeedHabits();
          const batch = writeBatch(db);
          for (const h of starterHabits) {
            const habitRef = doc(db, 'users', user.uid, 'habits', sanitizeId(h.id));
            batch.set(habitRef, sanitizeHabitPayload(h, user.uid, true));
          }
          await batch.commit();
        }
        try {
          localStorage.setItem(seededKey, '1');
        } catch {
          // Ignore storage error
        }
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/planner/state`);
  }
}

export function subscribeToUserTasks(
  uid: string,
  onTasks: (tasks: Task[]) => void,
  onError: (err: Error) => void
) {
  const path = `users/${uid}/tasks`;
  const q = query(collection(db, path), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const tasks: Task[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id || d.id),
          title: String(data.title || ''),
          notes: data.notes ? String(data.notes) : '',
          priority: data.priority || 'medium',
          energyRequired: data.energyRequired || 'medium',
          durationMinutes: Number(data.durationMinutes) || 30,
          deadline: String(data.deadline || ''),
          status: data.status || 'scheduled',
          createdAt:
            data.createdAt && typeof data.createdAt.toDate === 'function'
              ? data.createdAt.toDate().toISOString()
              : new Date().toISOString(),
          completedAt: data.completedAt ? String(data.completedAt) : undefined,
        };
      });
      onTasks(tasks);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        onError(e as Error);
      }
    }
  );
}

export function subscribeToPlannerState(
  uid: string,
  onState: (state: CloudPlannerState) => void,
  onError: (err: Error) => void
) {
  const path = `users/${uid}/planner/state`;
  const ref = doc(db, 'users', uid, 'planner', 'state');
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const weekly: WeeklyFreeHours = {};
      for (let i = 0; i <= 6; i++) {
        weekly[i] = Array.isArray(data.weeklyFreeHours?.[String(i)])
          ? data.weeklyFreeHours[String(i)]
          : [];
      }
      onState({
        mood: data.mood || 'focused',
        todayOverrideDate: data.todayOverrideDate || '',
        todayOverrideWindows: Array.isArray(data.todayOverrideWindows)
          ? data.todayOverrideWindows
          : [],
        weeklyFreeHours: weekly,
        blocks: Array.isArray(data.blocks) ? data.blocks : [],
        dailyHistory: data.dailyHistory || {},
        settings: data.settings,
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (e) {
        onError(e as Error);
      }
    }
  );
}

export async function saveTaskToCloud(uid: string, task: Task, isNew: boolean) {
  const safeId = sanitizeId(task.id);
  const path = `users/${uid}/tasks/${safeId}`;
  try {
    const taskRef = doc(db, 'users', uid, 'tasks', safeId);
    const payload = sanitizeTaskPayload(task, uid, isNew);
    if (isNew) {
      await setDoc(taskRef, payload);
    } else {
      await setDoc(taskRef, payload, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteTaskFromCloud(uid: string, taskId: string) {
  const safeId = sanitizeId(taskId);
  const path = `users/${uid}/tasks/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'tasks', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function savePlannerStateToCloud(uid: string, state: CloudPlannerState) {
  const path = `users/${uid}/planner/state`;
  try {
    const ref = doc(db, 'users', uid, 'planner', 'state');
    await setDoc(ref, sanitizePlannerPayload(state, uid), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeToUserHabits(
  uid: string,
  onHabits: (habits: Habit[]) => void,
  onError: (err: Error) => void
) {
  const path = `users/${uid}/habits`;
  const q = query(collection(db, path), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const habits: Habit[] = snapshot.docs.map((d) => {
        const data = d.data();
        const cat = VALID_HABIT_CATEGORIES.includes(data.category as HabitCategory)
          ? (data.category as HabitCategory)
          : 'Other';
        return {
          id: String(data.id || d.id),
          title: String(data.title || 'Daily Habit'),
          category: cat,
          targetLabel: String(data.targetLabel || ''),
          color: String(data.color || '#E3242B'),
          completedDates: Array.isArray(data.completedDates)
            ? data.completedDates.map((x: unknown) => String(x)).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x))
            : [],
          archived: Boolean(data.archived),
          createdAt:
            data.createdAt && typeof data.createdAt.toDate === 'function'
              ? data.createdAt.toDate().toISOString()
              : new Date().toISOString(),
        };
      });
      onHabits(habits);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        onError(e as Error);
      }
    }
  );
}

export async function saveHabitToCloud(uid: string, habit: Habit, isNew: boolean) {
  const safeId = sanitizeId(habit.id);
  const path = `users/${uid}/habits/${safeId}`;
  try {
    const habitRef = doc(db, 'users', uid, 'habits', safeId);
    const payload = sanitizeHabitPayload(habit, uid, isNew);
    if (isNew) {
      await setDoc(habitRef, payload);
    } else {
      await setDoc(habitRef, payload, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteHabitFromCloud(uid: string, habitId: string) {
  const safeId = sanitizeId(habitId);
  const path = `users/${uid}/habits/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'habits', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function seedStarterHabitsToCloud(uid: string): Promise<Habit[]> {
  const starters = createInitialSeedHabits();
  const batch = writeBatch(db);
  for (const h of starters) {
    const habitRef = doc(db, 'users', uid, 'habits', sanitizeId(h.id));
    batch.set(habitRef, sanitizeHabitPayload(h, uid, true));
  }
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}/habits`);
  }
  return starters;
}
