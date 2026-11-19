import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { EnergyLevel, Priority, Task } from '../types/grid';
import { addDaysToDateStr, toLocalDateString } from '../utils/scheduler';

interface TaskModalProps {
  open: boolean;
  editingTask?: Task | null;
  onClose: () => void;
  onSave: (taskData: {
    id?: string;
    title: string;
    notes: string;
    priority: Priority;
    energyRequired: EnergyLevel;
    durationMinutes: number;
    deadline: string;
  }) => void;
}

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

export const TaskModal: React.FC<TaskModalProps> = ({ open, editingTask, onClose, onSave }) => {
  const defaultDeadline = `${addDaysToDateStr(toLocalDateString(), 1)}T20:00`;

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<Priority>('high');
  const [energyRequired, setEnergyRequired] = useState<EnergyLevel>('medium');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      if (editingTask) {
        setTitle(editingTask.title);
        setNotes(editingTask.notes || '');
        setPriority(editingTask.priority);
        setEnergyRequired(editingTask.energyRequired);
        setDurationMinutes(editingTask.durationMinutes);
        setDeadline(editingTask.deadline.slice(0, 16));
      } else {
        setTitle('');
        setNotes('');
        setPriority('high');
        setEnergyRequired('medium');
        setDurationMinutes(60);
        setDeadline(`${addDaysToDateStr(toLocalDateString(), 1)}T20:00`);
      }
      setError('');
    }
  }, [open, editingTask]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please enter a task title.');
      return;
    }
    if (!deadline) {
      setError('Please choose a deadline.');
      return;
    }
    onSave({
      id: editingTask?.id,
      title: title.trim(),
      notes: notes.trim(),
      priority,
      energyRequired,
      durationMinutes: Math.max(15, Math.min(480, Number(durationMinutes) || 30)),
      deadline,
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-xs sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ y: 36, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="tactile-card max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl p-6 sm:rounded-2xl"
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[var(--border-subtle)] sm:hidden" />
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-extrabold text-[var(--text-primary)]">
                {editingTask ? 'Edit Task' : 'New Task'}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label htmlFor="task-title" className="block text-xs font-bold text-[var(--text-secondary)]">
                  Task Title
                </label>
                <input
                  id="task-title"
                  type="text"
                  maxLength={200}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Ship authentication module"
                  className="mt-1.5 min-h-[44px] w-full rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3.5 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="task-deadline" className="block text-xs font-bold text-[var(--text-secondary)]">
                    Deadline
                  </label>
                  <input
                    id="task-deadline"
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="mt-1.5 min-h-[44px] w-full rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 py-2 font-mono text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)]">
                    Priority
                  </label>
                  <div className="mt-1.5 grid grid-cols-3 gap-1.5 rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-1">
                    {(['high', 'medium', 'low'] as Priority[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className={`min-h-[36px] rounded-lg text-xs font-bold capitalize transition-colors ${
                          priority === p
                            ? p === 'high'
                              ? 'bg-[#E85454] text-white'
                              : p === 'medium'
                              ? 'bg-amber-500 text-[#141418]'
                              : 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)]">
                  Estimated Duration
                </label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {DURATION_PRESETS.map((mins) => {
                    const active = durationMinutes === mins;
                    return (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setDurationMinutes(mins)}
                        className={`min-h-[40px] rounded-xl border-2 px-3 font-mono text-xs font-bold transition-all ${
                          active
                            ? 'border-[var(--border-subtle)] shadow-[2px_2px_0px_var(--border-subtle)]'
                            : 'border-transparent bg-[var(--bg-subtle)] text-[var(--text-primary)]'
                        }`}
                        style={
                          active
                            ? {
                                backgroundColor: 'var(--accent)',
                                color: 'var(--accent-contrast)',
                              }
                            : undefined
                        }
                      >
                        {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                      </button>
                    );
                  })}
                  <input
                    type="number"
                    min={15}
                    max={480}
                    step={5}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    aria-label="Custom minutes"
                    className="min-h-[40px] w-20 rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2.5 font-mono text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)]">
                  Cognitive Effort (used by AI mood rescheduling)
                </label>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5 rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-1">
                  {(
                    [
                      { value: 'deep', label: 'Deep Focus' },
                      { value: 'medium', label: 'Balanced' },
                      { value: 'light', label: 'Light / Easy' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setEnergyRequired(item.value)}
                      className={`min-h-[36px] whitespace-nowrap rounded-lg px-2 text-xs font-bold transition-colors ${
                        energyRequired === item.value
                          ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="task-notes" className="block text-xs font-bold text-[var(--text-secondary)]">
                  Notes (optional)
                </label>
                <textarea
                  id="task-notes"
                  rows={2}
                  maxLength={1000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Context, links, or checklist details"
                  className="mt-1.5 w-full rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3.5 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                />
              </div>

              {error && <p className="text-xs font-bold text-red-600 dark:text-red-400">{error}</p>}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="comic-btn min-h-[44px] rounded-xl bg-[var(--bg-subtle)] px-4 py-2 text-sm font-bold text-[var(--text-primary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="comic-btn min-h-[44px] rounded-xl px-5 py-2 text-sm font-extrabold"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-contrast)',
                  }}
                >
                  {editingTask ? 'Save & Reschedule' : 'Add & Schedule'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
