"use client";

import { Component, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";

type Props = { children: ReactNode };
type State = { hasError: boolean; error?: Error };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[400px] items-center justify-center p-8">
          <div className="max-w-md text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-status-crit" />
            <h2 className="mt-4 text-lg font-semibold text-gold-400">Something went wrong</h2>
            <p className="mt-2 text-sm text-ink-500">
              {this.state.error?.message || "An unexpected error occurred in this section."}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="mt-4 rounded-lg border border-ink-700 px-4 py-2 text-sm text-ink-300 hover:border-gold-600 hover:text-gold-400 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
