import React from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message =
      error instanceof Error
        ? error.message
        : 'An unexpected runtime exception occurred in the JARVIS interface.';
    return { hasError: true, errorMessage: message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error('[JARVIS ErrorBoundary]', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetAndReload = () => {
    try {
      const keysToClear = [
        'jarvis_web_memories_v1',
        'jarvis_web_chats_v1',
        'jarvis_web_tasks_v1',
        'jarvis_web_security_logs_v1',
        'jarvis_web_smart_devices_v1',
        'jarvis_web_settings_v1',
      ];
      keysToClear.forEach((k) => localStorage.removeItem(k));
    } catch {
      // Ignore storage access failures
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-[#02040A] hud-grid-bg text-slate-100 flex items-center justify-center p-6">
        <div className="glass-panel-glow rounded-2xl p-6 max-w-md w-full space-y-4 border border-rose-500/40">
          <div className="flex items-center gap-3 text-rose-400">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            <h1 className="font-display text-base font-bold tracking-wider">
              JARVIS INTERFACE RECOVERY
            </h1>
          </div>

          <p className="text-sm text-slate-300 leading-relaxed">
            A client-side rendering fault interrupted this session. You can reload immediately or reset local browser storage if cached state became corrupted.
          </p>

          <div className="rounded-xl bg-[#040812] border border-slate-800 p-3 font-mono-hud text-xs text-rose-300 break-words">
            {this.state.errorMessage}
          </div>

          <div className="flex flex-wrap gap-2.5 pt-1">
            <button
              type="button"
              onClick={this.handleReload}
              className="flex-1 px-4 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#02040A] font-display text-xs font-bold tracking-wider flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>RELOAD INTERFACE</span>
            </button>

            <button
              type="button"
              onClick={this.handleResetAndReload}
              className="px-4 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 hover:bg-rose-500/25 text-rose-200 font-mono-hud text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>RESET CACHE</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
