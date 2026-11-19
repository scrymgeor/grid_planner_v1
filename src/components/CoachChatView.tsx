import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, CalendarCheck, Send } from 'lucide-react';
import { ChatMessage, MoodType } from '../types/grid';
import { PeekingCatSticker } from './CatStickers';

interface CoachChatViewProps {
  messages: ChatMessage[];
  mood: MoodType;
  isSending: boolean;
  onChangeMood: (mood: MoodType) => void;
  onSendMessage: (text: string) => void;
  onGoToSchedule: () => void;
  compactPanel?: boolean;
}

const MOODS: { value: MoodType; label: string }[] = [
  { value: 'focused', label: 'Focused' },
  { value: 'energized', label: 'Energized' },
  { value: 'tired', label: 'Tired' },
  { value: 'stressed', label: 'Stressed' },
  { value: 'overwhelmed', label: 'Overwhelmed' },
];

export const CoachChatView: React.FC<CoachChatViewProps> = ({
  messages,
  mood,
  isSending,
  onChangeMood,
  onSendMessage,
  onGoToSchedule,
  compactPanel = false,
}) => {
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isSending]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || isSending) return;
    onSendMessage(draft.trim());
    setDraft('');
  };

  return (
    <div
      className={`tactile-card flex flex-col overflow-hidden ${
        compactPanel ? 'h-[calc(100vh-8.5rem)]' : 'h-[calc(100vh-12rem)] min-h-[460px]'
      }`}
    >
      {/* Header & Mood Selector */}
      <div className="border-b-2 border-[var(--border-subtle)] p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-display text-sm font-extrabold text-[var(--text-primary)]">
              Echo
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Mood-aware support & automatic schedule rearrangement
            </p>
          </div>
          <PeekingCatSticker className="h-9 w-14 shrink-0" perked={isSending} />
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {MOODS.map((m) => {
            const active = mood === m.value;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => onChangeMood(m.value)}
                className={`min-h-[34px] whitespace-nowrap rounded-lg border-2 px-2.5 py-1 text-[11px] font-bold transition-all ${
                  active
                    ? 'border-[var(--border-subtle)] shadow-[2px_2px_0px_var(--border-subtle)]'
                    : 'border-transparent bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Messages */}
      <div className="scrollbar-sleek flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const timeLabel = msg.timestamp
            ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '';
          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.16 }}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl border-2 border-[var(--border-subtle)] px-4 py-3 text-sm leading-relaxed ${
                  isUser
                    ? 'shadow-[2px_2px_0px_var(--border-subtle)]'
                    : msg.isError
                    ? 'bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-200'
                    : 'bg-[var(--bg-canvas)] text-[var(--text-primary)]'
                }`}
                style={
                  isUser
                    ? {
                        backgroundColor: 'var(--accent)',
                        color: 'var(--accent-contrast)',
                      }
                    : undefined
                }
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {timeLabel && (
                  <p
                    className="mt-1.5 font-mono text-[10px] font-semibold tabular-nums opacity-65"
                    style={{ textAlign: isUser ? 'right' : 'left' }}
                  >
                    {timeLabel}
                  </p>
                )}

                {msg.appliedRearrange && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t-2 border-[var(--border-subtle)] pt-2.5 text-xs">
                    <span className="inline-flex items-center gap-1.5 font-extrabold text-emerald-700 dark:text-emerald-400">
                      <CalendarCheck className="h-3.5 w-3.5" />
                      <span>Schedule updated ({msg.strategyLabel || 'Optimized'})</span>
                    </span>
                    {!compactPanel && (
                      <button
                        type="button"
                        onClick={onGoToSchedule}
                        className="inline-flex items-center gap-1 font-extrabold underline underline-offset-2"
                      >
                        <span>View Schedule</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {!isUser && msg.suggestedPrompts && msg.suggestedPrompts.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {msg.suggestedPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      disabled={isSending}
                      onClick={() => onSendMessage(prompt)}
                      className="comic-btn min-h-[36px] rounded-xl bg-[var(--bg-surface)] px-3 py-1.5 text-left text-xs font-bold text-[var(--text-primary)]"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })}

        {isSending && (
          <div className="flex items-start">
            <div className="rounded-2xl border-2 border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-4 py-3 text-xs font-bold text-[var(--text-secondary)]">
              Reviewing your mood, deadlines, and free hours…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Composer */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t-2 border-[var(--border-subtle)] p-3"
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Chat with Echo — how are you feeling or what changed?"
          disabled={isSending}
          className="min-h-[44px] flex-1 rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
        />
        <button
          type="submit"
          disabled={!draft.trim() || isSending}
          aria-label="Send message"
          className="comic-btn flex h-11 w-11 shrink-0 items-center justify-center rounded-xl disabled:opacity-40"
          style={{
            backgroundColor: 'var(--accent)',
            color: 'var(--accent-contrast)',
          }}
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
};
