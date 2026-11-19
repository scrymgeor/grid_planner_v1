import {
  DailyHistoryMap,
  FreeWindow,
  MoodType,
  Priority,
  ScheduleBlock,
  ScheduleStrategy,
  ScheduleWarning,
  StreakSummary,
  Task,
  WeeklyFreeHours,
} from '../types/grid';

export function toLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toLocalDateString(dt);
}

export function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMinutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatTime12h(timeStr: string): string {
  const [hStr, mStr] = timeStr.split(':');
  const h = Number(hStr);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr} ${suffix}`;
}

export function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatDeadlineShort(deadlineIso: string, todayStr: string): { label: string; isOverdue: boolean; isUrgent: boolean } {
  const deadlineDate = deadlineIso.slice(0, 10);
  const deadlineTime = deadlineIso.includes('T') ? deadlineIso.slice(11, 16) : '23:59';
  const now = new Date();
  const target = new Date(`${deadlineDate}T${deadlineTime}:00`);
  const diffMs = target.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffMs < 0) {
    return { label: `Overdue (${deadlineDate.slice(5)})`, isOverdue: true, isUrgent: true };
  }
  if (deadlineDate === todayStr) {
    return { label: `Today ${formatTime12h(deadlineTime)}`, isOverdue: false, isUrgent: true };
  }
  const tomorrowStr = addDaysToDateStr(todayStr, 1);
  if (deadlineDate === tomorrowStr) {
    return { label: `Tomorrow ${formatTime12h(deadlineTime)}`, isOverdue: false, isUrgent: diffHours <= 36 };
  }
  const [y, m, d] = deadlineDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const formatted = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return { label: `Due ${formatted}`, isOverdue: false, isUrgent: diffHours <= 48 };
}

interface GenerateScheduleParams {
  tasks: Task[];
  weeklyFreeHours: WeeklyFreeHours;
  todayOverrideWindows?: FreeWindow[] | null;
  existingBlocks: ScheduleBlock[];
  bufferMinutes: number;
  mood?: MoodType;
  strategy?: ScheduleStrategy;
  priorityOrderOverrides?: Record<string, number>; // taskId -> AI rank boost
  rearrangedReason?: string;
  now?: Date;
}

interface Interval {
  start: number;
  end: number;
}

function mergeAndSubtractOccupied(
  windows: FreeWindow[],
  occupied: Interval[],
  minStartMinutes: number,
  bufferMinutes: number
): Interval[] {
  const raw: Interval[] = windows
    .map((w) => ({
      start: Math.max(minStartMinutes, parseTimeToMinutes(w.start)),
      end: parseTimeToMinutes(w.end),
    }))
    .filter((w) => w.end - w.start >= 15)
    .sort((a, b) => a.start - b.start);

  let available = [...raw];
  for (const occ of occupied) {
    const occStart = occ.start - bufferMinutes;
    const occEnd = occ.end + bufferMinutes;
    const nextAvail: Interval[] = [];
    for (const slot of available) {
      if (occEnd <= slot.start || occStart >= slot.end) {
        nextAvail.push(slot);
      } else {
        if (occStart > slot.start + 10) {
          nextAvail.push({ start: slot.start, end: occStart });
        }
        if (occEnd < slot.end - 10) {
          nextAvail.push({ start: occEnd, end: slot.end });
        }
      }
    }
    available = nextAvail;
  }

  return available.filter((s) => s.end - s.start >= 15);
}

function scoreTask(
  task: Task,
  now: Date,
  mood?: MoodType,
  strategy?: ScheduleStrategy,
  aiBoostMap?: Record<string, number>
): number {
  const priorityWeight: Record<Priority, number> = {
    high: 320,
    medium: 180,
    low: 70,
  };

  let score = priorityWeight[task.priority];

  // Urgency based on hours left until deadline
  const deadlineMs = new Date(task.deadline.includes('T') ? task.deadline : `${task.deadline}T23:59:00`).getTime();
  const hoursLeft = (deadlineMs - now.getTime()) / (1000 * 60 * 60);

  if (hoursLeft <= 0) {
    score += 450; // Overdue gets immediate top rescue priority
  } else if (hoursLeft <= 12) {
    score += 360;
  } else if (hoursLeft <= 24) {
    score += 260;
  } else if (hoursLeft <= 48) {
    score += 170;
  } else if (hoursLeft <= 96) {
    score += 90;
  } else {
    score += Math.max(0, 60 - hoursLeft / 12);
  }

  // Missed tasks get a recovery boost so they don't stay orphaned
  if (task.status === 'missed') {
    score += 110;
  }

  // Mood & energy alignment
  if (mood === 'tired' || mood === 'overwhelmed' || strategy === 'light_recovery') {
    if (task.energyRequired === 'light') score += 95;
    if (task.energyRequired === 'deep' && hoursLeft > 24) score -= 75;
  } else if (mood === 'stressed') {
    // Quick wins first or urgent deadlines
    if (task.durationMinutes <= 45) score += 60;
    if (hoursLeft <= 24) score += 80;
  } else if (mood === 'focused' || mood === 'energized' || strategy === 'deep_focus') {
    if (task.energyRequired === 'deep') score += 100;
  }

  if (aiBoostMap && typeof aiBoostMap[task.id] === 'number') {
    score += aiBoostMap[task.id];
  }

  return score;
}

export function generateOptimalSchedule({
  tasks,
  weeklyFreeHours,
  todayOverrideWindows,
  existingBlocks,
  bufferMinutes,
  mood,
  strategy = 'balanced',
  priorityOrderOverrides,
  rearrangedReason,
  now = new Date(),
}: GenerateScheduleParams): { blocks: ScheduleBlock[]; warnings: ScheduleWarning[] } {
  const todayStr = toLocalDateString(now);
  const currentMinutesToday = now.getHours() * 60 + now.getMinutes();
  const effectiveBuffer =
    mood === 'tired' || mood === 'overwhelmed' || strategy === 'light_recovery'
      ? Math.max(bufferMinutes, 15)
      : bufferMinutes;

  // Keep completed blocks intact; discard old upcoming/missed blocks as we regenerate cleanly
  const preservedBlocks = existingBlocks.filter((b) => b.status === 'completed');

  const activeTasks = tasks
    .filter((t) => t.status !== 'completed')
    .slice()
    .sort((a, b) => scoreTask(b, now, mood, strategy, priorityOrderOverrides) - scoreTask(a, now, mood, strategy, priorityOrderOverrides));

  // Build day-by-day free intervals for the next 14 days
  const horizonDays = 14;
  const daySlots: { date: string; slots: Interval[] }[] = [];

  for (let offset = 0; offset < horizonDays; offset++) {
    const dateStr = addDaysToDateStr(todayStr, offset);
    const [y, m, d] = dateStr.split('-').map(Number);
    const dayOfWeek = new Date(y, m - 1, d).getDay();

    const windows =
      offset === 0 && todayOverrideWindows !== undefined && todayOverrideWindows !== null
        ? todayOverrideWindows
        : weeklyFreeHours[dayOfWeek] || [];

    const occupiedToday: Interval[] = preservedBlocks
      .filter((b) => b.date === dateStr)
      .map((b) => ({
        start: parseTimeToMinutes(b.startTime),
        end: parseTimeToMinutes(b.endTime),
      }));

    // Round current time up to nearest 5 minutes for today
    const minStart = offset === 0 ? Math.ceil((currentMinutesToday + 5) / 5) * 5 : 0;
    const available = mergeAndSubtractOccupied(windows, occupiedToday, minStart, effectiveBuffer);

    // If mood is light_recovery or overwhelmed, cap today's total scheduled minutes to avoid burnout
    if (offset === 0 && (mood === 'overwhelmed' || strategy === 'light_recovery')) {
      let remainingCap = 150; // max 2.5h new work today during recovery
      const capped: Interval[] = [];
      for (const s of available) {
        if (remainingCap <= 15) break;
        const len = s.end - s.start;
        if (len <= remainingCap) {
          capped.push(s);
          remainingCap -= len;
        } else {
          capped.push({ start: s.start, end: s.start + remainingCap });
          remainingCap = 0;
        }
      }
      daySlots.push({ date: dateStr, slots: capped });
    } else {
      daySlots.push({ date: dateStr, slots: available });
    }
  }

  const newBlocks: ScheduleBlock[] = [];
  const warnings: ScheduleWarning[] = [];

  for (const task of activeTasks) {
    let remainingDuration = Math.max(15, task.durationMinutes);
    const chunksToPlace: { date: string; start: number; end: number }[] = [];

    // First try to place the task contiguously in a single free slot
    let placedContiguous = false;
    for (const day of daySlots) {
      for (let i = 0; i < day.slots.length; i++) {
        const slot = day.slots[i];
        if (slot.end - slot.start >= remainingDuration) {
          const blockStart = slot.start;
          const blockEnd = blockStart + remainingDuration;
          chunksToPlace.push({ date: day.date, start: blockStart, end: blockEnd });
          const nextStart = blockEnd + effectiveBuffer;
          if (slot.end - nextStart >= 15) {
            day.slots[i] = { start: nextStart, end: slot.end };
          } else {
            day.slots.splice(i, 1);
          }
          remainingDuration = 0;
          placedContiguous = true;
          break;
        }
      }
      if (placedContiguous) break;
    }

    // If no single window is big enough, split cleanly into >= 25m focus chunks across available windows
    if (!placedContiguous) {
      for (const day of daySlots) {
        for (let i = 0; i < day.slots.length && remainingDuration > 0; ) {
          const slot = day.slots[i];
          const slotLen = slot.end - slot.start;
          if (slotLen < 20 && remainingDuration > 20) {
            i++;
            continue;
          }
          const take = Math.min(remainingDuration, slotLen);
          const blockStart = slot.start;
          const blockEnd = blockStart + take;
          chunksToPlace.push({ date: day.date, start: blockStart, end: blockEnd });
          remainingDuration -= take;
          const nextStart = blockEnd + effectiveBuffer;
          if (slot.end - nextStart >= 15) {
            day.slots[i] = { start: nextStart, end: slot.end };
            i++;
          } else {
            day.slots.splice(i, 1);
          }
        }
        if (remainingDuration <= 0) break;
      }
    }

    if (chunksToPlace.length === 0 || remainingDuration > 0) {
      warnings.push({
        taskId: task.id,
        taskTitle: task.title,
        reason: `Not enough free hours in the next 14 days (${remainingDuration}m unscheduled). Add more free windows in the Free Hours tab.`,
      });
    } else {
      const deadlineDate = task.deadline.slice(0, 10);
      const lastChunkDate = chunksToPlace[chunksToPlace.length - 1].date;
      if (lastChunkDate > deadlineDate) {
        warnings.push({
          taskId: task.id,
          taskTitle: task.title,
          reason: `Scheduled on ${lastChunkDate}, after its ${deadlineDate} deadline. Consider adding extra free hours before then.`,
        });
      }
    }

    chunksToPlace.forEach((chunk, idx) => {
      newBlocks.push({
        id: `blk-${task.id}-${idx}-${chunk.date}-${chunk.start}`,
        taskId: task.id,
        taskTitle: task.title,
        priority: task.priority,
        energyRequired: task.energyRequired,
        deadline: task.deadline,
        date: chunk.date,
        startTime: minutesToTime(chunk.start),
        endTime: minutesToTime(chunk.end),
        status: 'upcoming',
        partLabel: chunksToPlace.length > 1 ? `Part ${idx + 1}/${chunksToPlace.length}` : undefined,
        rearrangedReason: rearrangedReason || (task.status === 'missed' ? 'Auto-rescheduled from missed task' : undefined),
      });
    });
  }

  const allBlocks = [...preservedBlocks, ...newBlocks].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startTime.localeCompare(b.startTime);
  });

  return { blocks: allBlocks, warnings };
}

export function findOverdueUpcomingBlocks(blocks: ScheduleBlock[], now: Date = new Date()): ScheduleBlock[] {
  const todayStr = toLocalDateString(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return blocks.filter((block) => {
    if (block.status !== 'upcoming') return false;
    if (block.date < todayStr) return true;
    if (block.date === todayStr && parseTimeToMinutes(block.endTime) < nowMinutes) return true;
    return false;
  });
}

export function calculateStreak(dailyHistory: DailyHistoryMap, todayStr: string = toLocalDateString()): StreakSummary {
  let totalCompleted = 0;
  let totalFocusMinutes = 0;

  for (const entry of Object.values(dailyHistory)) {
    totalCompleted += entry.completedCount;
    totalFocusMinutes += entry.focusMinutes;
  }

  const todayEntry = dailyHistory[todayStr] || { completedCount: 0, missedCount: 0, focusMinutes: 0 };
  const activeToday = todayEntry.completedCount > 0;

  // Current streak: count consecutive days backwards from today (if active today) or yesterday
  let currentStreak = 0;
  let cursor = activeToday ? todayStr : addDaysToDateStr(todayStr, -1);
  for (let i = 0; i < 365; i++) {
    const day = dailyHistory[cursor];
    if (day && day.completedCount > 0) {
      currentStreak++;
      cursor = addDaysToDateStr(cursor, -1);
    } else {
      break;
    }
  }

  // Best streak across recorded dates
  const activeDates = Object.keys(dailyHistory)
    .filter((d) => dailyHistory[d].completedCount > 0)
    .sort();

  let bestStreak = currentStreak;
  let run = 0;
  for (let i = 0; i < activeDates.length; i++) {
    if (i === 0) {
      run = 1;
    } else {
      const expectedNext = addDaysToDateStr(activeDates[i - 1], 1);
      run = activeDates[i] === expectedNext ? run + 1 : 1;
    }
    if (run > bestStreak) bestStreak = run;
  }

  return {
    currentStreak,
    bestStreak,
    totalCompleted,
    totalFocusMinutes,
    todayCompleted: todayEntry.completedCount,
    todayFocusMinutes: todayEntry.focusMinutes,
    activeToday,
  };
}

export function calculateHabitStreak(
  completedDates: string[],
  todayStr: string = toLocalDateString()
): { currentStreak: number; bestStreak: number; totalCheckins: number; doneToday: boolean } {
  const uniqueDates = Array.from(
    new Set((completedDates || []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))
  ).sort();
  const dateSet = new Set(uniqueDates);
  const doneToday = dateSet.has(todayStr);

  let currentStreak = 0;
  let cursor = doneToday ? todayStr : addDaysToDateStr(todayStr, -1);
  for (let i = 0; i < 365; i++) {
    if (dateSet.has(cursor)) {
      currentStreak++;
      cursor = addDaysToDateStr(cursor, -1);
    } else {
      break;
    }
  }

  let bestStreak = currentStreak;
  let run = 0;
  for (let i = 0; i < uniqueDates.length; i++) {
    if (i === 0) {
      run = 1;
    } else {
      const expectedNext = addDaysToDateStr(uniqueDates[i - 1], 1);
      run = uniqueDates[i] === expectedNext ? run + 1 : 1;
    }
    if (run > bestStreak) bestStreak = run;
  }

  return {
    currentStreak,
    bestStreak,
    totalCheckins: uniqueDates.length,
    doneToday,
  };
}
