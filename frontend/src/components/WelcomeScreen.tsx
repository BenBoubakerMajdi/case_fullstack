/**
 * WelcomeScreen — centered landing shown before the first message is sent.
 *
 * Sections:
 *   1. Matr logo + tagline
 *   2. Dataset pills — shows loaded CSV files
 *   3. Large centered input with Enter-to-send
 *   4. Suggested question buttons — 2-column grid
 *
 * Responsive behavior:
 *   Mobile:  Smaller logo, horizontal-scrolling dataset pills (no row count),
 *            2-column suggested questions with smaller text
 *   Desktop: Larger logo, wrapped dataset pills with row counts,
 *            2-column suggested questions with full padding
 *
 * This component is replaced by the chat layout as soon as the first
 * message is sent (controlled by hasMessages in App.tsx).
 */

import { useState, useRef, type KeyboardEvent } from "react";
import {
  Loader2,
  BarChart2,
  TrendingUp,
  PieChart,
  Table2,
  Database,
  ArrowUp,
} from "lucide-react";
import { type Dataset } from "../types/events";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WelcomeScreenProps {
  /** Datasets loaded from the backend — displayed as pills below the logo. */
  datasets: Dataset[];

  /** Called with the question text when the user submits. */
  onSend: (question: string) => void;

  /** Whether a question is currently being processed. */
  isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Pre-defined questions shown as quick-start buttons.
 * Each maps a display label + icon to the full question sent to the agent.
 * Update these to match the datasets available in the data/ directory.
 */
const SUGGESTED_QUESTIONS = [
  {
    icon: <BarChart2 className="w-4 h-4" />,
    label: "Total revenue by product",
    question: "Show me total revenue by product as a bar chart",
  },
  {
    icon: <TrendingUp className="w-4 h-4" />,
    label: "Monthly revenue trend",
    question: "What is the monthly revenue trend?",
  },
  {
    icon: <PieChart className="w-4 h-4" />,
    label: "Churn rate analysis",
    question: "What is the churn rate in the telco dataset?",
  },
  {
    icon: <Table2 className="w-4 h-4" />,
    label: "Top 5 products by revenue",
    question: "Show me the top 5 products by revenue as a table",
  },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WelcomeScreen({
  datasets,
  onSend,
  isLoading,
}: WelcomeScreenProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setValue("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  /** Auto-resize textarea height to fit content, up to 150px. */
  const handleInput = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 relative overflow-hidden">
      {/* Background glow — decorative radial gradient */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 sm:w-96 h-64 sm:h-96 rounded-full blur-3xl opacity-10 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, var(--accent-cyan), transparent)",
        }}
      />

      <div className="w-full max-w-2xl flex flex-col items-center gap-4 sm:gap-8 animate-fade-slide-in">
        {/* ── Logo + tagline ─────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-2 sm:gap-4">
          <div
            className="w-10 h-10 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shadow-2xl"
            style={{
              background:
                "linear-gradient(135deg, var(--accent-cyan), var(--accent-emerald))",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-6 h-6 sm:w-9 sm:h-9"
            >
              <path
                d="M3 18V6L8.5 14L12 8L15.5 14L21 6V18"
                stroke="#0f1117"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="text-center">
            <h1
              className="text-xl sm:text-3xl font-bold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              Matr Data Agent
            </h1>
            <p
              className="mt-1 text-xs sm:text-base"
              style={{ color: "var(--text-secondary)" }}
            >
              Ask questions about your data in plain English
            </p>
          </div>
        </div>

        {/* ── Dataset pills ──────────────────────────────────────── */}
        {datasets.length > 0 && (
          <div className="w-full">
            {/* Mobile: horizontal scroll — no row count to save space */}
            <div
              className="flex sm:hidden gap-2 overflow-x-auto pb-1"
              style={{ scrollbarWidth: "none" }}
            >
              {datasets.map((ds) => (
                <div
                  key={ds.name}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-mono border flex-shrink-0"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    borderColor: "var(--border-color)",
                    color: "var(--text-secondary)",
                  }}
                >
                  <Database
                    className="w-3 h-3 flex-shrink-0"
                    style={{ color: "var(--accent-cyan)" }}
                  />
                  {ds.name}
                </div>
              ))}
            </div>

            {/* Desktop: wrapped pills with row counts */}
            <div className="hidden sm:flex flex-wrap items-center justify-center gap-2">
              {datasets.map((ds) => (
                <div
                  key={ds.name}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-mono border"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    borderColor: "var(--border-color)",
                    color: "var(--text-secondary)",
                  }}
                >
                  <Database
                    className="w-3 h-3"
                    style={{ color: "var(--accent-cyan)" }}
                  />
                  {ds.name}
                  <span style={{ color: "var(--text-muted)" }}>
                    · {ds.rows.toLocaleString()} rows
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Main input ────────────────────────────────────────── */}
        <div
          className="w-full rounded-xl border transition-all duration-200"
          style={{
            backgroundColor: "var(--bg-secondary)",
            borderColor: focused ? "var(--accent-cyan)" : "var(--border-color)",
          }}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Ask anything about your data..."
            disabled={isLoading}
            rows={1}
            className="w-full resize-none bg-transparent px-4 sm:px-5 pt-3 sm:pt-4 pb-2 text-sm sm:text-base focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed max-h-36 overflow-y-auto"
            style={{ color: "var(--text-primary)" }}
          />

          {/* Input footer — Enter hint (desktop) + submit button */}
          <div className="flex items-center justify-between px-4 pb-3 pt-1">
            <p
              className="text-xs hidden sm:block"
              style={{ color: "var(--text-muted)" }}
            >
              Press{" "}
              <kbd
                className="px-1.5 py-0.5 rounded-md text-xs font-mono"
                style={{
                  backgroundColor: "var(--bg-card)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-color)",
                }}
              >
                Enter
              </kbd>{" "}
              to send
            </p>
            <button
              onClick={handleSubmit}
              disabled={!value.trim() || isLoading}
              className="flex items-center gap-2 p-2 rounded-lg text-sm font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed ml-auto"
              style={{
                background:
                  "linear-gradient(135deg, var(--accent-cyan), var(--accent-emerald))",
                color: "#0f1117",
              }}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ArrowUp className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* ── Suggested questions — 2 columns ───────────────────── */}
        <div className="w-full">
          <p
            className="text-xs font-medium text-center mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            Try asking
          </p>
          <div className="grid grid-cols-2 gap-2">
            {SUGGESTED_QUESTIONS.map((item) => (
              <button
                key={item.question}
                onClick={() => onSend(item.question)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-md text-left transition-all border"
                style={{
                  backgroundColor: "var(--bg-card)",
                  borderColor: "var(--border-color)",
                  color: "var(--text-secondary)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent-cyan)";
                  e.currentTarget.style.color = "var(--text-primary)";
                  e.currentTarget.style.backgroundColor = "var(--bg-secondary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-color)";
                  e.currentTarget.style.color = "var(--text-secondary)";
                  e.currentTarget.style.backgroundColor = "var(--bg-card)";
                }}
              >
                <span
                  className="flex-shrink-0"
                  style={{ color: "var(--accent-cyan)" }}
                >
                  {item.icon}
                </span>
                <span className="text-xs leading-tight">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
