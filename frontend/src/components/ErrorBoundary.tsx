/**
 * ErrorBoundary — catches unhandled React rendering errors.
 *
 * Without this, any crash in the component tree shows a blank white screen
 * with no explanation. This component intercepts the crash and shows a
 * friendly error message with a retry button instead.
 *
 * Usage:
 *   Wrap the root App component in main.tsx:
 *   <ErrorBoundary><App /></ErrorBoundary>
 *
 * React error boundaries must be class components — there is no hook
 * equivalent for componentDidCatch as of React 18.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ErrorBoundaryProps {
  /** The component tree to protect. */
  children: ReactNode;
}

interface ErrorBoundaryState {
  /** Whether an error has been caught. */
  hasError: boolean;

  /** The caught error — displayed in development mode. */
  error: Error | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so next render shows the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console in development — replace with Sentry in production
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        className="min-h-screen flex items-center justify-center px-6"
        style={{ backgroundColor: "var(--bg-primary)" }}
      >
        <div
          className="w-full max-w-md rounded-2xl border p-8 text-center"
          style={{
            backgroundColor: "var(--bg-card)",
            borderColor: "var(--border-color)",
          }}
        >
          {/* Matr logo */}
          {/* Matr logo — floating animation */}
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{
              background:
                "linear-gradient(135deg, var(--accent-cyan), var(--accent-emerald))",
              animation: "float 2s ease-in-out infinite",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
              <path
                d="M3 18V6L8.5 14L12 8L15.5 14L21 6V18"
                stroke="#0f1117"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <h1
            className="text-xl font-bold mb-2"
            style={{ color: "var(--text-primary)" }}
          >
            Something went wrong
          </h1>

          <p
            className="text-sm mb-6"
            style={{ color: "var(--text-secondary)" }}
          >
            An unexpected error occurred. Our team has been notified and will
            resolve this as soon as possible. Please refresh the page to try
            again.
          </p>

          {/* Show error details in development */}
          {import.meta.env.DEV && this.state.error && (
            <div
              className="text-left rounded-lg p-4 font-mono text-xs overflow-auto max-h-32"
              style={{
                backgroundColor: "#1f0f0f",
                border: "1px solid #4a1515",
                color: "#f87171",
              }}
            >
              <div className="flex items-start gap-2">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="w-4 h-4 flex-shrink-0 mt-0.5"
                  style={{ color: "#f87171" }}
                >
                  <path
                    d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="mt-0.5">{this.state.error.message}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
}
