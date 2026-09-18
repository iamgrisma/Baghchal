import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled Baghchal Exception:', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-stone-950 text-stone-100 flex flex-col items-center justify-center p-6 text-center select-none z-50">
          <div className="max-w-xs w-full bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-100">Something went wrong</h2>
              <p className="text-xs text-stone-400 mt-1">
                A temporary error occurred while updating the game.
              </p>
            </div>
            <button
              onClick={this.handleReload}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs shadow transition active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Resume Game</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
