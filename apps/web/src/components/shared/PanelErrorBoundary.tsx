"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PanelErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex flex-col items-center justify-center p-4 text-center">
          <AlertTriangle className="w-6 h-6 text-f1-amber mb-2" />
          <p className="text-[13px] font-display font-bold uppercase tracking-wider text-f1-text-dim mb-1">
            {this.props.fallbackTitle || "Panel Error"}
          </p>
          <p className="text-[13px] text-f1-text-muted mb-3">
            {this.state.error?.message || "Something went wrong"}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="flex items-center gap-1 px-3 py-1.5 text-[13px] font-bold rounded-md bg-f1-surface-2 text-f1-text-dim hover:text-f1-text border border-f1-border transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
