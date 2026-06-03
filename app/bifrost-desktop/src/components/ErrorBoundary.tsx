import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Bifrost UI runtime error", { error, componentStack: info.componentStack });
  }

  private retry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-full flex items-center justify-center p-6">
          <div className="glass-panel rounded-xl border border-border/60 max-w-md w-full p-6 text-center">
            <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
            <p className="text-sm text-muted-foreground mb-4">
              The current view crashed. You can retry or return to the dashboard.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button onClick={this.retry} className="px-4 py-2 rounded-lg border border-border hover:bg-white/5">
                Retry
              </button>
              <button onClick={() => window.location.assign("/")} className="px-4 py-2 rounded-lg rainbow-bg text-white">
                Go to Overview
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
