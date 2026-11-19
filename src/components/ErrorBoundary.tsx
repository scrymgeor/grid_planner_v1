import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected application error occurred.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('Grid ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas)] p-6 text-[var(--text-primary)]">
          <div className="tactile-card max-w-md p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-[var(--border-subtle)] bg-red-100 text-red-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-extrabold">Something went wrong</h2>
                <p className="text-xs text-[var(--text-secondary)]">Grid paused to protect your data</p>
              </div>
            </div>
            <p className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3 text-xs leading-relaxed text-[var(--text-secondary)]">
              Something unexpected interrupted your session. Reload Grid to get right back to your schedule—your saved tasks and habits are safe.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="comic-btn mt-5 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-bold"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-contrast)',
              }}
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reload Grid</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
