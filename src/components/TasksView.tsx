import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Check, Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { Priority, Task } from '../types/grid';
import { formatDeadlineShort, formatDuration, toLocalDateString } from '../utils/scheduler';
import { LoafCatSticker } from './CatStickers';

interface TasksViewProps {
  tasks: Task[];
  onAddTask: () => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleComplete: (taskId: string) => void;
  onRescheduleAll: () => void;
}

type StatusFilter = 'active' | 'completed' | 'all';

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onToggleComplete,
  onRescheduleAll,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all');
  const todayStr = toLocalDateString();

  const summary = useMemo(() => {
    const active = tasks.filter((t) => t.status !== 'completed');
    const completed = tasks.filter((t) => t.status === 'completed');
    const remainingMins = active.reduce((acc, t) => acc + t.durationMinutes, 0);
    const urgentCount = active.filter((t) => {
      const info = formatDeadlineShort(t.deadline, todayStr);
      return info.isOverdue || info.isUrgent || t.priority === 'high';
    }).length;
    const completionPct =
      tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0;

    return {
      activeCount: active.length,
      completedCount: completed.length,
      totalCount: tasks.length,
      remainingMins,
      urgentCount,
      completionPct,
    };
  }, [tasks, todayStr]);

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        if (statusFilter === 'active' && t.status === 'completed') return false;
        if (statusFilter === 'completed' && t.status !== 'completed') return false;
        if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          return (
            t.title.toLowerCase().includes(q) ||
            (t.notes && t.notes.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (a.status !== 'completed' && b.status === 'completed') return -1;
        const pOrder = { high: 0, medium: 1, low: 2 };
        if (pOrder[a.priority] !== pOrder[b.priority]) return pOrder[a.priority] - pOrder[b.priority];
        return a.deadline.localeCompare(b.deadline);
      });
  }, [tasks, statusFilter, priorityFilter, search]);

  return (
    <div className="space-y-5">
      {/* Workload Summary Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="tactile-card p-4 sm:p-5">
          <p className="text-xs font-bold text-[var(--text-secondary)]">Active Queue</p>
          <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-[var(--text-primary)]">
            {summary.activeCount} {summary.activeCount === 1 ? 'task' : 'tasks'}
          </p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            {summary.urgentCount > 0
              ? `${summary.urgentCount} high priority or urgent`
              : 'No urgent deadlines right now'}
          </p>
        </div>

        <div className="tactile-card p-4 sm:p-5">
          <p className="text-xs font-bold text-[var(--text-secondary)]">Remaining Focus Load</p>
          <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-[var(--text-primary)]">
            {formatDuration(summary.remainingMins)}
          </p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Auto-packed into your weekly free hours
          </p>
        </div>

        <div className="tactile-card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-[var(--text-secondary)]">Completion Rate</p>
            <span className="font-mono text-xs font-bold tabular-nums text-[var(--text-primary)]">
              {summary.completedCount}/{summary.totalCount}
            </span>
          </div>
          <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-[var(--text-primary)]">
            {summary.completionPct}%
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full border-2 border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${summary.completionPct}%` }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              className="h-full"
              style={{ backgroundColor: 'var(--accent)' }}
            />
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="tactile-card relative flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="pointer-events-auto absolute -right-2 -top-7 z-20 hidden sm:block">
          <LoafCatSticker className="h-12 w-18" />
        </div>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks or notes..."
            className="min-h-[44px] w-full rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-canvas)] pl-10 pr-3.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-1">
            {(['active', 'completed', 'all'] as StatusFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setStatusFilter(f)}
                className={`min-h-[34px] whitespace-nowrap rounded-lg px-3 text-xs font-bold capitalize transition-all ${
                  statusFilter === f
                    ? 'shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                style={
                  statusFilter === f
                    ? {
                        backgroundColor: 'var(--accent)',
                        color: 'var(--accent-contrast)',
                      }
                    : undefined
                }
              >
                {f}
              </button>
            ))}
          </div>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as 'all' | Priority)}
            aria-label="Filter by priority"
            className="min-h-[44px] rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          >
            <option value="all">All priorities</option>
            <option value="high">High priority</option>
            <option value="medium">Medium priority</option>
            <option value="low">Low priority</option>
          </select>

          <button
            type="button"
            onClick={onRescheduleAll}
            className="comic-btn inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-xl bg-[var(--bg-subtle)] px-3.5 py-2 text-xs font-bold text-[var(--text-primary)]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Sync Schedule</span>
          </button>
        </div>
      </div>

      {/* Animated Task Cards */}
      <section className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="tactile-card px-6 py-12 text-center">
            <LoafCatSticker className="mx-auto mb-2 h-16 w-24" />
            <p className="text-sm font-extrabold text-[var(--text-primary)]">No tasks match your filter</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Add a task with a deadline and priority so Grid can fit it into your free hours.
            </p>
            <button
              type="button"
              onClick={onAddTask}
              className="comic-btn mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-extrabold"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-contrast)',
              }}
            >
              <Plus className="h-4 w-4" />
              <span>Add Task</span>
            </button>
          </div>
        ) : (
          filteredTasks.map((task, idx) => {
            const isDone = task.status === 'completed';
            const deadlineInfo = formatDeadlineShort(task.deadline, todayStr);
            const effortPct = Math.min(100, Math.max(15, Math.round((task.durationMinutes / 120) * 100)));

            return (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 28, delay: Math.min(idx * 0.03, 0.2) }}
                className={`tactile-card-interactive flex items-start justify-between gap-4 p-4 sm:p-5 ${
                  isDone ? 'opacity-65' : ''
                }`}
              >
                <div className="flex min-w-0 flex-1 items-start gap-3.5">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    onClick={() => onToggleComplete(task.id)}
                    aria-label={isDone ? `Mark ${task.title} incomplete` : `Complete ${task.title}`}
                    className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-[var(--border-subtle)] transition-colors"
                    style={
                      isDone
                        ? {
                            backgroundColor: 'var(--accent)',
                            color: 'var(--accent-contrast)',
                          }
                        : {
                            backgroundColor: 'var(--bg-subtle)',
                            color: 'transparent',
                          }
                    }
                  >
                    <Check className="h-4 w-4" />
                  </motion.button>

                  <div className="min-w-0 flex-1 pt-0.5">
                    <p
                      className={`text-sm font-extrabold sm:text-base ${
                        isDone
                          ? 'line-through text-[var(--text-secondary)]'
                          : 'text-[var(--text-primary)]'
                      }`}
                    >
                      {task.title}
                    </p>

                    {task.notes && (
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">
                        {task.notes}
                      </p>
                    )}

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-secondary)]">
                      <span
                        className={
                          task.priority === 'high'
                            ? 'font-bold text-[#E85454]'
                            : task.priority === 'medium'
                            ? 'font-bold text-amber-700 dark:text-amber-400'
                            : 'font-medium'
                        }
                      >
                        {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} priority
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{formatDuration(task.durationMinutes)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{task.energyRequired} energy</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          !isDone && deadlineInfo.isOverdue
                            ? 'font-bold text-[#E85454]'
                            : !isDone && deadlineInfo.isUrgent
                            ? 'font-bold text-amber-700 dark:text-amber-400'
                            : ''
                        }
                      >
                        {deadlineInfo.label}
                      </span>
                      {task.status === 'missed' && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-bold text-amber-700 dark:text-amber-400">
                            Needs reschedule
                          </span>
                        </>
                      )}
                    </div>

                    {/* Subtle Effort Size Bar */}
                    <div className="mt-2.5 h-1.5 w-32 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${effortPct}%`,
                          backgroundColor: isDone ? 'var(--text-secondary)' : 'var(--accent)',
                          opacity: isDone ? 0.45 : 0.75,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onEditTask(task)}
                    aria-label={`Edit ${task.title}`}
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteTask(task.id)}
                    aria-label={`Delete ${task.title}`}
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--text-secondary)] transition-colors hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </section>
    </div>
  );
};
