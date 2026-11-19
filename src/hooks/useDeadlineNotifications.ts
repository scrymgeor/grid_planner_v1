import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Habit, ScheduleBlock, Task } from '../types/grid';
import { formatDuration, parseTimeToMinutes, toLocalDateString } from '../utils/scheduler';

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export interface NotificationPreferences {
  enabled: boolean;
  deadlineLeadMinutes: number; // 30, 60, 120, 360, 1440
  urgentAndAtRiskAlerts: boolean; // warns when remaining time < task duration, 15m left, or missed
  blockReminders: boolean; // 10m before scheduled block + missed block alert
  habitReminderEnabled: boolean; // evening nudge if habits aren't checked in yet
  habitReminderHour: number; // 19..22 (24h local time)
}

export interface AlertLogItem {
  id: string;
  kind: 'deadline-missed' | 'deadline-risk' | 'deadline-soon' | 'block' | 'habit' | 'test';
  title: string;
  body: string;
  timestamp: string;
  taskId?: string;
  taskTitle?: string;
  deliveredToDevice: boolean;
}

export interface AtRiskTask {
  task: Task;
  minutesRemaining: number;
  severity: 'missed' | 'insufficient-time' | 'urgent' | 'approaching';
  label: string;
}

const DEFAULT_PREFS: NotificationPreferences = {
  enabled: false,
  deadlineLeadMinutes: 60,
  urgentAndAtRiskAlerts: true,
  blockReminders: true,
  habitReminderEnabled: true,
  habitReminderHour: 20,
};

const PREFS_KEY_PREFIX = 'grid_notif_prefs_v1_';
const SENT_KEY_PREFIX = 'grid_notif_sent_v1_';
const LOG_KEY_PREFIX = 'grid_notif_log_v1_';

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function parseLocalDeadlineMs(deadlineStr: string): number | null {
  if (!deadlineStr) return null;
  const parsed = new Date(deadlineStr);
  const ms = parsed.getTime();
  return Number.isFinite(ms) ? ms : null;
}

function parseBlockDateTimeMs(dateStr: string, timeStr: string): number | null {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const mins = parseTimeToMinutes(timeStr);
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  return new Date(parts[0], parts[1] - 1, parts[2], hours, minutes, 0, 0).getTime();
}

function formatTimeRemaining(minutes: number): string {
  const abs = Math.abs(Math.round(minutes));
  if (abs < 60) return `${Math.max(1, abs)}m`;
  const hrs = Math.floor(abs / 60);
  const rem = abs % 60;
  if (hrs < 24) return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  return remHrs > 0 ? `${days}d ${remHrs}h` : `${days}d`;
}

function loadPrefs(uid: string | null): NotificationPreferences {
  if (!uid) return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(`${PREFS_KEY_PREFIX}${uid}`);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
    return {
      ...DEFAULT_PREFS,
      ...parsed,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function loadSentMap(uid: string | null): Record<string, number> {
  if (!uid) return {};
  try {
    const raw = localStorage.getItem(`${SENT_KEY_PREFIX}${uid}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const pruned: Record<string, number> = {};
    for (const [k, ts] of Object.entries(parsed)) {
      if (typeof ts === 'number' && ts >= cutoff) {
        pruned[k] = ts;
      }
    }
    return pruned;
  } catch {
    return {};
  }
}

function loadAlertLog(uid: string | null): AlertLogItem[] {
  if (!uid) return [];
  try {
    const raw = localStorage.getItem(`${LOG_KEY_PREFIX}${uid}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AlertLogItem[];
    return Array.isArray(parsed) ? parsed.slice(0, 30) : [];
  } catch {
    return [];
  }
}

function getBrowserPermission(): NotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as NotificationPermissionState;
}

async function getReadyServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
    ]);
  } catch {
    return null;
  }
}

async function dispatchLocalDeviceNotification(
  title: string,
  body: string,
  tag: string
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  const options: NotificationOptions = {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag,
    requireInteraction: tag.startsWith('deadline-'),
  };

  try {
    const reg = await getReadyServiceWorker();
    if (reg && typeof reg.showNotification === 'function') {
      await reg.showNotification(title, options);
      return true;
    }
  } catch {
    // Fall through to standard Notification API
  }

  try {
    const notif = new Notification(title, options);
    notif.onclick = () => {
      window.focus();
      notif.close();
    };
    return true;
  } catch {
    return false;
  }
}

export function useDeadlineNotifications({
  uid,
  active,
  tasks,
  blocks,
  habits,
}: {
  uid: string | null;
  active: boolean;
  tasks: Task[];
  blocks: ScheduleBlock[];
  habits: Habit[];
}) {
  const [permission, setPermission] = useState<NotificationPermissionState>(getBrowserPermission);
  const [prefs, setPrefs] = useState<NotificationPreferences>(() => loadPrefs(uid));
  const [recentAlerts, setRecentAlerts] = useState<AlertLogItem[]>(() => loadAlertLog(uid));
  const [activeToast, setActiveToast] = useState<AlertLogItem | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [tick, setTick] = useState(0);

  const sentMapRef = useRef<Record<string, number>>({});
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  const isInIframe = useMemo(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }, []);

  // Reload per-user local state when uid changes
  useEffect(() => {
    setPrefs(loadPrefs(uid));
    setRecentAlerts(loadAlertLog(uid));
    sentMapRef.current = loadSentMap(uid);
    setUnreadCount(0);
    setPermission(getBrowserPermission());
  }, [uid]);

  const syncDataToPushServer = useCallback(
    async (overridePrefs?: NotificationPreferences) => {
      if (!uid || !active) return;
      const effectivePrefs = overridePrefs || prefsRef.current;
      try {
        const res = await fetch('/api/push/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid,
            prefs: effectivePrefs,
            timezoneOffsetMinutes: new Date().getTimezoneOffset(),
            tasks: tasks
              .filter((t) => t.status !== 'completed')
              .map((t) => ({
                id: t.id,
                title: t.title,
                priority: t.priority,
                durationMinutes: t.durationMinutes,
                deadline: t.deadline,
                status: t.status,
              })),
            blocks: blocks
              .filter((b) => b.status === 'upcoming')
              .map((b) => ({
                id: b.id,
                taskId: b.taskId,
                taskTitle: b.taskTitle,
                date: b.date,
                startTime: b.startTime,
                endTime: b.endTime,
                status: b.status,
              })),
            habits: habits
              .filter((h) => !h.archived)
              .map((h) => ({
                id: h.id,
                title: h.title,
                completedDates: h.completedDates.slice(-14),
                archived: h.archived,
              })),
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { subscribedDevices?: number };
          if (typeof data.subscribedDevices === 'number') {
            setPushSubscribed(data.subscribedDevices > 0);
          }
        }
      } catch {
        // Offline or server unavailable; will retry on next change
      }
    },
    [uid, active, tasks, blocks, habits]
  );

  const subscribeToBackgroundPush = useCallback(
    async (effectivePrefs: NotificationPreferences): Promise<boolean> => {
      if (!uid || typeof window === 'undefined' || !('PushManager' in window)) {
        return false;
      }
      if (Notification.permission !== 'granted') {
        return false;
      }

      try {
        const reg = await getReadyServiceWorker();
        if (!reg || !reg.pushManager) {
          return false;
        }

        const keyRes = await fetch('/api/push/vapid-public-key');
        if (!keyRes.ok) return false;
        const { publicKey } = (await keyRes.json()) as { publicKey?: string };
        if (!publicKey) return false;

        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });
        }

        const subRes = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid,
            subscription: sub.toJSON(),
            prefs: effectivePrefs,
            timezoneOffsetMinutes: new Date().getTimezoneOffset(),
          }),
        });

        if (subRes.ok) {
          setPushSubscribed(true);
          await syncDataToPushServer(effectivePrefs);
          return true;
        }
      } catch (err) {
        console.warn('[push] Background subscription skipped:', err);
      }
      return false;
    },
    [uid, syncDataToPushServer]
  );

  const unsubscribeFromBackgroundPush = useCallback(async () => {
    if (!uid) return;
    let endpoint: string | undefined;
    try {
      const reg = await getReadyServiceWorker();
      const sub = await reg?.pushManager?.getSubscription();
      if (sub) {
        endpoint = sub.endpoint;
        await sub.unsubscribe();
      }
    } catch {
      // Ignore browser unsubscribe errors
    }

    setPushSubscribed(false);
    try {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, endpoint }),
      });
    } catch {
      // Ignore network errors
    }
  }, [uid]);

  // Verify existing push subscription on mount when alerts are enabled
  useEffect(() => {
    if (!active || !uid || !prefs.enabled) {
      setPushSubscribed(false);
      return;
    }
    if (getBrowserPermission() === 'granted') {
      subscribeToBackgroundPush(prefs);
    }
  }, [active, uid, prefs.enabled, subscribeToBackgroundPush]);

  // Debounced sync of tasks, blocks, habits, and prefs to backend push scheduler
  useEffect(() => {
    if (!active || !uid || !prefs.enabled) return;
    const timer = window.setTimeout(() => {
      syncDataToPushServer(prefs);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [active, uid, prefs, tasks, blocks, habits, syncDataToPushServer]);

  const updatePrefs = useCallback(
    (updater: Partial<NotificationPreferences>) => {
      setPrefs((prev) => {
        const next = { ...prev, ...updater };
        if (uid) {
          try {
            localStorage.setItem(`${PREFS_KEY_PREFIX}${uid}`, JSON.stringify(next));
          } catch {
            // Ignore storage errors
          }
        }
        if (updater.enabled === false) {
          unsubscribeFromBackgroundPush();
        }
        return next;
      });
    },
    [uid, unsubscribeFromBackgroundPush]
  );

  const persistSentMap = useCallback(() => {
    if (!uid) return;
    try {
      localStorage.setItem(`${SENT_KEY_PREFIX}${uid}`, JSON.stringify(sentMapRef.current));
    } catch {
      // Ignore storage errors
    }
  }, [uid]);

  const recordAlert = useCallback(
    (item: AlertLogItem, showToast: boolean) => {
      setRecentAlerts((prev) => {
        const next = [item, ...prev].slice(0, 30);
        if (uid) {
          try {
            localStorage.setItem(`${LOG_KEY_PREFIX}${uid}`, JSON.stringify(next));
          } catch {
            // Ignore storage errors
          }
        }
        return next;
      });
      setUnreadCount((c) => c + 1);
      if (showToast) {
        setActiveToast(item);
      }
    },
    [uid]
  );

  const requestPermissionAndEnable = useCallback(async (): Promise<{
    permission: NotificationPermissionState;
    enabled: boolean;
    pushSubscribed: boolean;
  }> => {
    const nextPrefs: NotificationPreferences = { ...prefsRef.current, enabled: true };
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      updatePrefs({ enabled: true });
      return { permission: 'unsupported', enabled: true, pushSubscribed: false };
    }

    let current = Notification.permission as NotificationPermissionState;
    if (current === 'default') {
      try {
        current = (await Notification.requestPermission()) as NotificationPermissionState;
      } catch {
        current = Notification.permission as NotificationPermissionState;
      }
    }
    setPermission(current);
    updatePrefs({ enabled: true });

    let subscribed = false;
    if (current === 'granted') {
      subscribed = await subscribeToBackgroundPush(nextPrefs);
    }

    return { permission: current, enabled: true, pushSubscribed: subscribed };
  }, [updatePrefs, subscribeToBackgroundPush]);

  const sendTestNotification = useCallback(async (): Promise<{
    delivered: boolean;
    viaBackgroundPush: boolean;
  }> => {
    let currentPerm = getBrowserPermission();
    if (currentPerm === 'default') {
      try {
        currentPerm = (await Notification.requestPermission()) as NotificationPermissionState;
      } catch {
        currentPerm = getBrowserPermission();
      }
      setPermission(currentPerm);
    }

    // Attempt true end-to-end server Web Push first
    let viaBackgroundPush = false;
    let delivered = false;

    if (uid && currentPerm === 'granted') {
      let subscribed = pushSubscribed;
      if (!subscribed) {
        subscribed = await subscribeToBackgroundPush({ ...prefsRef.current, enabled: true });
      }
      if (subscribed) {
        try {
          const res = await fetch('/api/push/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid }),
          });
          if (res.ok) {
            const data = (await res.json()) as { sentCount?: number };
            if ((data.sentCount || 0) > 0) {
              delivered = true;
              viaBackgroundPush = true;
            }
          }
        } catch {
          // Fall back to local notification below
        }
      }
    }

    const title = viaBackgroundPush ? 'Grid Background Push Active' : 'Grid Deadline Alerts Active';

    if (!delivered) {
      delivered = await dispatchLocalDeviceNotification(
        title,
        'You’ll get a heads-up before deadlines slip, when tasks don’t have enough time left, or when habits are still unchecked.',
        `grid-test-${Date.now()}`
      );
    }

    recordAlert(
      {
        id: `test-${Date.now()}`,
        kind: 'test',
        title,
        body: viaBackgroundPush
          ? 'Real background Web Push delivered from Grid’s server — works even when the app is closed!'
          : delivered
          ? 'Device notification delivered on this browser.'
          : 'Shown in-app (open Grid in its own browser tab or installed mobile app to enable lock-screen push).',
        timestamp: new Date().toISOString(),
        deliveredToDevice: delivered,
      },
      true
    );

    return { delivered, viaBackgroundPush };
  }, [uid, pushSubscribed, subscribeToBackgroundPush, recordAlert]);

  const dismissToast = useCallback(() => setActiveToast(null), []);
  const markAlertsRead = useCallback(() => setUnreadCount(0), []);

  const clearAlertLog = useCallback(() => {
    setRecentAlerts([]);
    setUnreadCount(0);
    if (uid) {
      try {
        localStorage.removeItem(`${LOG_KEY_PREFIX}${uid}`);
      } catch {
        // Ignore storage errors
      }
    }
  }, [uid]);

  // Live computed list of at-risk / approaching deadlines
  const atRiskTasks = useMemo<AtRiskTask[]>(() => {
    const nowMs = Date.now();
    const leadMs = prefs.deadlineLeadMinutes * 60 * 1000;
    const list: AtRiskTask[] = [];

    for (const task of tasks) {
      if (task.status === 'completed') continue;
      const deadlineMs = parseLocalDeadlineMs(task.deadline);
      if (!deadlineMs) continue;

      const diffMs = deadlineMs - nowMs;
      const diffMins = diffMs / 60000;
      if (diffMins < -48 * 60) continue;

      if (diffMs <= 0) {
        list.push({
          task,
          minutesRemaining: diffMins,
          severity: 'missed',
          label: `Missed ${formatTimeRemaining(diffMins)} ago`,
        });
      } else if (diffMins <= 15) {
        list.push({
          task,
          minutesRemaining: diffMins,
          severity: 'urgent',
          label: `Due in ${formatTimeRemaining(diffMins)}`,
        });
      } else if (diffMins < task.durationMinutes) {
        list.push({
          task,
          minutesRemaining: diffMins,
          severity: 'insufficient-time',
          label: `Needs ${formatDuration(task.durationMinutes)}, due in ${formatTimeRemaining(diffMins)}`,
        });
      } else if (diffMs <= leadMs) {
        list.push({
          task,
          minutesRemaining: diffMins,
          severity: 'approaching',
          label: `Due in ${formatTimeRemaining(diffMins)}`,
        });
      }
    }

    return list.sort((a, b) => a.minutesRemaining - b.minutesRemaining);
  }, [tasks, prefs.deadlineLeadMinutes, tick]);

  // Local in-app foreground scanner (dedupes with same tags as server push so OS replaces rather than duplicates)
  const evaluateAndNotify = useCallback(async () => {
    if (!active || !uid) return;
    const currentPrefs = prefsRef.current;
    if (!currentPrefs.enabled) return;

    const now = new Date();
    const nowMs = now.getTime();
    const todayStr = toLocalDateString(now);
    const sent = sentMapRef.current;
    let sentChanged = false;

    const triggerOnce = async (
      dedupeKey: string,
      kind: AlertLogItem['kind'],
      title: string,
      body: string,
      meta?: { taskId?: string; taskTitle?: string }
    ) => {
      if (sent[dedupeKey]) return;
      sent[dedupeKey] = nowMs;
      sentChanged = true;
      // If background push is active, still show in-app toast & log; only fire local OS alert if background push isn't active
      const delivered = pushSubscribed
        ? true
        : await dispatchLocalDeviceNotification(title, body, dedupeKey);
      recordAlert(
        {
          id: `${dedupeKey}-${nowMs}`,
          kind,
          title,
          body,
          timestamp: now.toISOString(),
          taskId: meta?.taskId,
          taskTitle: meta?.taskTitle,
          deliveredToDevice: delivered,
        },
        true
      );
    };

    for (const task of tasks) {
      if (task.status === 'completed') continue;
      const deadlineMs = parseLocalDeadlineMs(task.deadline);
      if (!deadlineMs) continue;

      const diffMins = (deadlineMs - nowMs) / 60000;

      if (diffMins <= 0 && diffMins >= -24 * 60 && currentPrefs.urgentAndAtRiskAlerts) {
        await triggerOnce(
          `deadline-missed:${task.id}:${task.deadline}`,
          'deadline-missed',
          `Deadline missed: ${task.title}`,
          `Passed ${formatTimeRemaining(diffMins)} ago. Open Grid or ask Echo to recover your schedule.`,
          { taskId: task.id, taskTitle: task.title }
        );
        continue;
      }

      if (diffMins > 0) {
        if (diffMins <= 15 && currentPrefs.urgentAndAtRiskAlerts) {
          await triggerOnce(
            `deadline-urgent:${task.id}:${task.deadline}`,
            'deadline-risk',
            `15m left: ${task.title}`,
            `Deadline is in ${formatTimeRemaining(diffMins)} (${task.priority.toUpperCase()} priority). Wrap it up now!`,
            { taskId: task.id, taskTitle: task.title }
          );
          continue;
        }

        if (
          diffMins < task.durationMinutes &&
          diffMins <= Math.max(task.durationMinutes, currentPrefs.deadlineLeadMinutes) &&
          currentPrefs.urgentAndAtRiskAlerts
        ) {
          await triggerOnce(
            `deadline-risk:${task.id}:${task.deadline}`,
            'deadline-risk',
            `At risk of missing: ${task.title}`,
            `Estimated ${formatDuration(task.durationMinutes)}, but due in ${formatTimeRemaining(diffMins)}. Start now or ask Echo to adjust.`,
            { taskId: task.id, taskTitle: task.title }
          );
          continue;
        }

        if (diffMins <= currentPrefs.deadlineLeadMinutes) {
          await triggerOnce(
            `deadline-lead:${task.id}:${task.deadline}:${currentPrefs.deadlineLeadMinutes}`,
            'deadline-soon',
            `Deadline approaching: ${task.title}`,
            `Due in ${formatTimeRemaining(diffMins)} · ${formatDuration(task.durationMinutes)} estimated.`,
            { taskId: task.id, taskTitle: task.title }
          );
        }
      }
    }

    if (currentPrefs.blockReminders) {
      for (const block of blocks) {
        if (block.status !== 'upcoming') continue;
        const startMs = parseBlockDateTimeMs(block.date, block.startTime);
        const endMs = parseBlockDateTimeMs(block.date, block.endTime);
        if (!startMs || !endMs) continue;

        const minsToStart = (startMs - nowMs) / 60000;
        if (minsToStart > 0 && minsToStart <= 10) {
          await triggerOnce(
            `block-start:${block.id}:${block.date}:${block.startTime}`,
            'block',
            `Starting soon: ${block.taskTitle}`,
            `Your focus block (${block.startTime}–${block.endTime}) starts in ${Math.max(1, Math.round(minsToStart))}m.`,
            { taskId: block.taskId, taskTitle: block.taskTitle }
          );
        }

        const minsPastEnd = (nowMs - endMs) / 60000;
        if (minsPastEnd > 2 && minsPastEnd <= 120) {
          await triggerOnce(
            `block-missed:${block.id}:${block.date}:${block.endTime}`,
            'block',
            `Missed focus block: ${block.taskTitle}`,
            `Ended at ${block.endTime}. Tap Echo to shift it into your next free window.`,
            { taskId: block.taskId, taskTitle: block.taskTitle }
          );
        }
      }
    }

    if (currentPrefs.habitReminderEnabled && now.getHours() >= currentPrefs.habitReminderHour) {
      const pendingHabits = habits.filter(
        (h) => !h.archived && !h.completedDates.includes(todayStr)
      );
      if (pendingHabits.length > 0) {
        const preview = pendingHabits
          .slice(0, 2)
          .map((h) => h.title)
          .join(', ');
        const extra = pendingHabits.length > 2 ? ` +${pendingHabits.length - 2} more` : '';
        await triggerOnce(
          `habit-evening:${todayStr}`,
          'habit',
          `Protect your habit streaks (${pendingHabits.length} left)`,
          `Still unchecked today: ${preview}${extra}.`,
          undefined
        );
      }
    }

    if (sentChanged) {
      persistSentMap();
    }
  }, [active, uid, tasks, blocks, habits, pushSubscribed, persistSentMap, recordAlert]);

  useEffect(() => {
    if (!active || !uid) return;
    evaluateAndNotify();

    const interval = window.setInterval(() => {
      setTick((t) => t + 1);
      evaluateAndNotify();
    }, 30000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setPermission(getBrowserPermission());
        setTick((t) => t + 1);
        evaluateAndNotify();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [active, uid, evaluateAndNotify]);

  return {
    permission,
    prefs,
    pushSubscribed,
    updatePrefs,
    requestPermissionAndEnable,
    sendTestNotification,
    recentAlerts,
    activeToast,
    dismissToast,
    unreadCount,
    markAlertsRead,
    clearAlertLog,
    atRiskTasks,
    isInIframe,
  };
}
