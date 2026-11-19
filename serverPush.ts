import express from 'express';
import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';
import type { PushSubscription } from 'web-push';

const require = createRequire(import.meta.url);
const webpush = require('web-push') as typeof import('web-push');

interface SyncedPrefs {
  enabled: boolean;
  deadlineLeadMinutes: number;
  urgentAndAtRiskAlerts: boolean;
  blockReminders: boolean;
  habitReminderEnabled: boolean;
  habitReminderHour: number;
}

interface SyncedTask {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  durationMinutes: number;
  deadline: string; // YYYY-MM-DDTHH:mm (user local wall-clock time)
  status: string;
}

interface SyncedBlock {
  id: string;
  taskId: string;
  taskTitle: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  status: string;
}

interface SyncedHabit {
  id: string;
  title: string;
  completedDates: string[];
  archived: boolean;
}

interface UserPushRecord {
  uid: string;
  subscriptions: PushSubscription[];
  prefs: SyncedPrefs;
  timezoneOffsetMinutes: number; // JS Date.getTimezoneOffset() value (UTC - local in minutes)
  tasks: SyncedTask[];
  blocks: SyncedBlock[];
  habits: SyncedHabit[];
  sentKeys: Record<string, number>;
  updatedAt: number;
}

interface PushStore {
  users: Record<string, UserPushRecord>;
}

interface VapidKeys {
  publicKey: string;
  privateKey: string;
  subject: string;
}

const DATA_DIR = path.resolve(process.cwd(), '.push-data');
const VAPID_FILE = path.join(DATA_DIR, 'vapid.json');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

const DEFAULT_PREFS: SyncedPrefs = {
  enabled: true,
  deadlineLeadMinutes: 60,
  urgentAndAtRiskAlerts: true,
  blockReminders: true,
  habitReminderEnabled: true,
  habitReminderHour: 20,
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadOrCreateVapidKeys(): VapidKeys {
  const envPublic = process.env.VAPID_PUBLIC_KEY?.trim();
  const envPrivate = process.env.VAPID_PRIVATE_KEY?.trim();
  const envSubject = process.env.VAPID_SUBJECT?.trim() || 'mailto:support@grid-planner.app';

  if (envPublic && envPrivate) {
    return { publicKey: envPublic, privateKey: envPrivate, subject: envSubject };
  }

  ensureDataDir();
  if (fs.existsSync(VAPID_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8')) as Partial<VapidKeys>;
      if (parsed.publicKey && parsed.privateKey) {
        return {
          publicKey: parsed.publicKey,
          privateKey: parsed.privateKey,
          subject: parsed.subject || envSubject,
        };
      }
    } catch {
      // Regenerate below if corrupted
    }
  }

  const generated = webpush.generateVAPIDKeys();
  const keys: VapidKeys = {
    publicKey: generated.publicKey,
    privateKey: generated.privateKey,
    subject: envSubject,
  };
  try {
    fs.writeFileSync(VAPID_FILE, JSON.stringify(keys, null, 2), 'utf8');
  } catch (err) {
    console.error('[push] Unable to persist VAPID keys:', err);
  }
  return keys;
}

function loadStore(): PushStore {
  ensureDataDir();
  if (!fs.existsSync(STORE_FILE)) {
    return { users: {} };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')) as PushStore;
    if (parsed && typeof parsed.users === 'object') {
      return parsed;
    }
  } catch {
    // Fallback to fresh store
  }
  return { users: {} };
}

function saveStore(store: PushStore) {
  try {
    ensureDataDir();
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.error('[push] Failed to save push store:', err);
  }
}

// Convert user's wall-clock date/time string (YYYY-MM-DDTHH:mm) + timezoneOffsetMinutes into UTC epoch ms
function userWallClockToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezoneOffsetMinutes: number
): number {
  const utcWallMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  return utcWallMs + timezoneOffsetMinutes * 60_000;
}

function parseDeadlineUtcMs(deadlineStr: string, timezoneOffsetMinutes: number): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(deadlineStr.trim());
  if (!match) {
    const fallback = new Date(deadlineStr).getTime();
    return Number.isFinite(fallback) ? fallback : null;
  }
  return userWallClockToUtcMs(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    timezoneOffsetMinutes
  );
}

function parseBlockUtcMs(
  dateStr: string,
  timeStr: string,
  timezoneOffsetMinutes: number
): number | null {
  const dMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  const tMatch = /^(\d{2}):(\d{2})$/.exec(timeStr.trim());
  if (!dMatch || !tMatch) return null;
  return userWallClockToUtcMs(
    Number(dMatch[1]),
    Number(dMatch[2]),
    Number(dMatch[3]),
    Number(tMatch[1]),
    Number(tMatch[2]),
    timezoneOffsetMinutes
  );
}

function getUserLocalClock(nowMs: number, timezoneOffsetMinutes: number): {
  todayStr: string;
  hour: number;
} {
  const shifted = new Date(nowMs - timezoneOffsetMinutes * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return {
    todayStr: `${y}-${m}-${d}`,
    hour: shifted.getUTCHours(),
  };
}

function formatRemaining(minutes: number): string {
  const abs = Math.abs(Math.round(minutes));
  if (abs < 60) return `${Math.max(1, abs)}m`;
  const hrs = Math.floor(abs / 60);
  const rem = abs % 60;
  if (hrs < 24) return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  return remHrs > 0 ? `${days}d ${remHrs}h` : `${days}d`;
}

function formatDuration(minutes: number): string {
  const mins = Math.max(1, Math.round(minutes));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

const vapidKeys = loadOrCreateVapidKeys();
webpush.setVapidDetails(vapidKeys.subject, vapidKeys.publicKey, vapidKeys.privateKey);

let pushStore = loadStore();

async function sendToUserDevices(
  record: UserPushRecord,
  payload: { title: string; body: string; tag: string; urgent?: boolean; url?: string }
): Promise<{ sentCount: number; failedCount: number; pruned: boolean }> {
  let sentCount = 0;
  let failedCount = 0;
  let pruned = false;
  const remaining: PushSubscription[] = [];
  const bodyJson = JSON.stringify(payload);

  for (const sub of record.subscriptions) {
    try {
      await webpush.sendNotification(sub, bodyJson, {
        TTL: 60 * 60, // 1 hour TTL so sleeping mobile devices receive it upon wake
        urgency: payload.urgent ? 'high' : 'normal',
      });
      sentCount += 1;
      remaining.push(sub);
    } catch (err: unknown) {
      failedCount += 1;
      const statusCode = (err as { statusCode?: number })?.statusCode;
      // Drop permanently expired or unsubscribed endpoints
      if (statusCode === 404 || statusCode === 410) {
        pruned = true;
      } else {
        remaining.push(sub);
        console.error('[push] Delivery error:', statusCode || err);
      }
    }
  }

  if (pruned) {
    record.subscriptions = remaining;
  }

  return { sentCount, failedCount, pruned };
}

export async function checkAndDispatchDuePushes(): Promise<{
  usersChecked: number;
  notificationsSent: number;
}> {
  const nowMs = Date.now();
  const pruneCutoff = nowMs - 7 * 24 * 60 * 60 * 1000;
  let usersChecked = 0;
  let notificationsSent = 0;
  let storeDirty = false;

  for (const record of Object.values(pushStore.users)) {
    if (!record.prefs?.enabled || record.subscriptions.length === 0) {
      continue;
    }
    usersChecked += 1;

    // Prune old dedupe keys
    for (const [k, ts] of Object.entries(record.sentKeys)) {
      if (ts < pruneCutoff) {
        delete record.sentKeys[k];
        storeDirty = true;
      }
    }

    const tzOffset = Number.isFinite(record.timezoneOffsetMinutes)
      ? record.timezoneOffsetMinutes
      : 0;

    const triggerOnce = async (
      dedupeKey: string,
      title: string,
      body: string,
      urgent = false
    ) => {
      if (record.sentKeys[dedupeKey]) return;
      const res = await sendToUserDevices(record, {
        title,
        body,
        tag: dedupeKey,
        urgent,
        url: '/',
      });
      if (res.sentCount > 0) {
        record.sentKeys[dedupeKey] = nowMs;
        notificationsSent += res.sentCount;
        storeDirty = true;
      }
      if (res.pruned) {
        storeDirty = true;
      }
    };

    // 1. Task Deadlines & "About to Miss" Risk Detection
    for (const task of record.tasks || []) {
      if (task.status === 'completed') continue;
      const deadlineMs = parseDeadlineUtcMs(task.deadline, tzOffset);
      if (!deadlineMs) continue;

      const diffMins = (deadlineMs - nowMs) / 60_000;

      if (diffMins <= 0 && diffMins >= -24 * 60 && record.prefs.urgentAndAtRiskAlerts) {
        await triggerOnce(
          `deadline-missed:${task.id}:${task.deadline}`,
          `Deadline missed: ${task.title}`,
          `Passed ${formatRemaining(diffMins)} ago. Open Grid or ask Echo to rearrange your schedule.`,
          true
        );
        continue;
      }

      if (diffMins > 0) {
        if (diffMins <= 15 && record.prefs.urgentAndAtRiskAlerts) {
          await triggerOnce(
            `deadline-urgent:${task.id}:${task.deadline}`,
            `15m left: ${task.title}`,
            `Deadline is in ${formatRemaining(diffMins)} (${task.priority.toUpperCase()} priority). Wrap it up now!`,
            true
          );
          continue;
        }

        if (
          diffMins < task.durationMinutes &&
          diffMins <= Math.max(task.durationMinutes, record.prefs.deadlineLeadMinutes) &&
          record.prefs.urgentAndAtRiskAlerts
        ) {
          await triggerOnce(
            `deadline-risk:${task.id}:${task.deadline}`,
            `At risk of missing: ${task.title}`,
            `Needs ${formatDuration(task.durationMinutes)}, due in ${formatRemaining(diffMins)}. Start now or ask Echo to adjust.`,
            true
          );
          continue;
        }

        if (diffMins <= record.prefs.deadlineLeadMinutes) {
          await triggerOnce(
            `deadline-lead:${task.id}:${task.deadline}:${record.prefs.deadlineLeadMinutes}`,
            `Deadline approaching: ${task.title}`,
            `Due in ${formatRemaining(diffMins)} · ${formatDuration(task.durationMinutes)} estimated.`,
            false
          );
        }
      }
    }

    // 2. Focus Block Start & Missed Slot Reminders
    if (record.prefs.blockReminders) {
      for (const block of record.blocks || []) {
        if (block.status !== 'upcoming') continue;
        const startMs = parseBlockUtcMs(block.date, block.startTime, tzOffset);
        const endMs = parseBlockUtcMs(block.date, block.endTime, tzOffset);
        if (!startMs || !endMs) continue;

        const minsToStart = (startMs - nowMs) / 60_000;
        if (minsToStart > 0 && minsToStart <= 10) {
          await triggerOnce(
            `block-start:${block.id}:${block.date}:${block.startTime}`,
            `Starting soon: ${block.taskTitle}`,
            `Your focus block (${block.startTime}–${block.endTime}) starts in ${Math.max(1, Math.round(minsToStart))}m.`,
            false
          );
        }

        const minsPastEnd = (nowMs - endMs) / 60_000;
        if (minsPastEnd > 2 && minsPastEnd <= 120) {
          await triggerOnce(
            `block-missed:${block.id}:${block.date}:${block.endTime}`,
            `Missed focus block: ${block.taskTitle}`,
            `Ended at ${block.endTime}. Tap Echo to shift it into your next free window.`,
            true
          );
        }
      }
    }

    // 3. Evening Habit Streak Reminder (in user's local timezone)
    if (record.prefs.habitReminderEnabled) {
      const localClock = getUserLocalClock(nowMs, tzOffset);
      if (localClock.hour >= record.prefs.habitReminderHour) {
        const pendingHabits = (record.habits || []).filter(
          (h) => !h.archived && !h.completedDates.includes(localClock.todayStr)
        );
        if (pendingHabits.length > 0) {
          const preview = pendingHabits
            .slice(0, 2)
            .map((h) => h.title)
            .join(', ');
          const extra = pendingHabits.length > 2 ? ` +${pendingHabits.length - 2} more` : '';
          await triggerOnce(
            `habit-evening:${localClock.todayStr}`,
            `Protect your habit streaks (${pendingHabits.length} left)`,
            `Still unchecked today: ${preview}${extra}.`,
            false
          );
        }
      }
    }
  }

  if (storeDirty) {
    saveStore(pushStore);
  }

  return { usersChecked, notificationsSent };
}

export function mountPushRoutes(app: express.Express) {
  app.get('/api/push/vapid-public-key', (_req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
  });

  app.post('/api/push/subscribe', (req, res) => {
    const { uid, subscription, prefs, timezoneOffsetMinutes } = req.body ?? {};
    if (
      !uid ||
      typeof uid !== 'string' ||
      !subscription ||
      typeof subscription.endpoint !== 'string' ||
      !subscription.keys?.p256dh ||
      !subscription.keys?.auth
    ) {
      return res.status(400).json({ error: 'Valid uid and push subscription are required.' });
    }

    const existing = pushStore.users[uid] || {
      uid,
      subscriptions: [],
      prefs: DEFAULT_PREFS,
      timezoneOffsetMinutes: 0,
      tasks: [],
      blocks: [],
      habits: [],
      sentKeys: {},
      updatedAt: Date.now(),
    };

    const filtered = existing.subscriptions.filter((s) => s.endpoint !== subscription.endpoint);
    existing.subscriptions = [...filtered.slice(-4), subscription];
    if (prefs && typeof prefs === 'object') {
      existing.prefs = { ...existing.prefs, ...prefs };
    }
    if (typeof timezoneOffsetMinutes === 'number' && Number.isFinite(timezoneOffsetMinutes)) {
      existing.timezoneOffsetMinutes = timezoneOffsetMinutes;
    }
    existing.updatedAt = Date.now();
    pushStore.users[uid] = existing;
    saveStore(pushStore);

    return res.json({ ok: true, subscriptionCount: existing.subscriptions.length });
  });

  app.post('/api/push/unsubscribe', (req, res) => {
    const { uid, endpoint } = req.body ?? {};
    if (!uid || typeof uid !== 'string') {
      return res.status(400).json({ error: 'uid is required.' });
    }
    const existing = pushStore.users[uid];
    if (existing) {
      existing.subscriptions = endpoint
        ? existing.subscriptions.filter((s) => s.endpoint !== endpoint)
        : [];
      existing.prefs = { ...existing.prefs, enabled: false };
      existing.updatedAt = Date.now();
      saveStore(pushStore);
    }
    return res.json({ ok: true });
  });

  app.post('/api/push/sync', (req, res) => {
    const { uid, prefs, tasks, blocks, habits, timezoneOffsetMinutes } = req.body ?? {};
    if (!uid || typeof uid !== 'string') {
      return res.status(400).json({ error: 'uid is required.' });
    }

    const existing = pushStore.users[uid] || {
      uid,
      subscriptions: [],
      prefs: DEFAULT_PREFS,
      timezoneOffsetMinutes: 0,
      tasks: [],
      blocks: [],
      habits: [],
      sentKeys: {},
      updatedAt: Date.now(),
    };

    if (prefs && typeof prefs === 'object') {
      existing.prefs = { ...existing.prefs, ...prefs };
    }
    if (typeof timezoneOffsetMinutes === 'number' && Number.isFinite(timezoneOffsetMinutes)) {
      existing.timezoneOffsetMinutes = timezoneOffsetMinutes;
    }
    if (Array.isArray(tasks)) {
      existing.tasks = tasks.slice(0, 100).map((t) => ({
        id: String(t.id || ''),
        title: String(t.title || 'Untitled Task').slice(0, 140),
        priority: t.priority === 'high' || t.priority === 'low' ? t.priority : 'medium',
        durationMinutes: Math.max(15, Math.min(480, Number(t.durationMinutes) || 30)),
        deadline: String(t.deadline || '').slice(0, 40),
        status: String(t.status || 'scheduled'),
      }));
    }
    if (Array.isArray(blocks)) {
      existing.blocks = blocks.slice(0, 120).map((b) => ({
        id: String(b.id || ''),
        taskId: String(b.taskId || ''),
        taskTitle: String(b.taskTitle || 'Focus Block').slice(0, 140),
        date: String(b.date || '').slice(0, 20),
        startTime: String(b.startTime || '').slice(0, 10),
        endTime: String(b.endTime || '').slice(0, 10),
        status: String(b.status || 'upcoming'),
      }));
    }
    if (Array.isArray(habits)) {
      existing.habits = habits.slice(0, 50).map((h) => ({
        id: String(h.id || ''),
        title: String(h.title || 'Habit').slice(0, 80),
        completedDates: Array.isArray(h.completedDates)
          ? h.completedDates.slice(-14).map((d: unknown) => String(d))
          : [],
        archived: Boolean(h.archived),
      }));
    }

    existing.updatedAt = Date.now();
    pushStore.users[uid] = existing;
    saveStore(pushStore);

    return res.json({
      ok: true,
      subscribedDevices: existing.subscriptions.length,
    });
  });

  app.post('/api/push/test', async (req, res) => {
    const { uid } = req.body ?? {};
    if (!uid || typeof uid !== 'string') {
      return res.status(400).json({ error: 'uid is required.' });
    }
    const existing = pushStore.users[uid];
    if (!existing || existing.subscriptions.length === 0) {
      return res.status(404).json({
        error: 'No background push device subscribed for this account yet.',
        sentCount: 0,
      });
    }

    const result = await sendToUserDevices(existing, {
      title: 'Grid Background Push Ready',
      body: 'Lock-screen deadline alerts are connected — you’ll get pinged even when Grid is closed.',
      tag: `grid-push-test-${Date.now()}`,
      urgent: true,
      url: '/',
    });

    if (result.pruned) {
      saveStore(pushStore);
    }

    return res.json({
      ok: result.sentCount > 0,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
    });
  });

  // External cron trigger (for Cloud Scheduler / GitHub Actions when deployed on scale-to-zero hosts)
  app.all('/api/push/cron', async (req, res) => {
    const expectedSecret = process.env.PUSH_CRON_SECRET?.trim();
    if (expectedSecret) {
      const authHeader = req.headers.authorization || '';
      const querySecret = typeof req.query.secret === 'string' ? req.query.secret : '';
      if (authHeader !== `Bearer ${expectedSecret}` && querySecret !== expectedSecret) {
        return res.status(401).json({ error: 'Unauthorized cron trigger.' });
      }
    }
    const summary = await checkAndDispatchDuePushes();
    return res.json({ ok: true, ...summary });
  });
}

let schedulerStarted = false;

export function startPushScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  // Check every 60 seconds for due deadlines, blocks, and evening habit reminders
  setInterval(() => {
    checkAndDispatchDuePushes().catch((err) => {
      console.error('[push] Scheduled check failed:', err);
    });
  }, 60_000);
}
