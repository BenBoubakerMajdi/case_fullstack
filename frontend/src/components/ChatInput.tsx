/**
 * ChatInput — auto-expanding textarea input for the active chat view.
 *
 * Behavior:
 *   - Auto-expands vertically as the user types (max 200px / ~8 lines)
 *   - Enter submits, Shift+Enter adds a new line
 *   - Send button transforms into a stop button while the agent is responding
 *   - No disabled state on textarea — only the button is disabled when empty
 *
 * Responsive:
 *   Desktop: textarea + footer row with Enter hint and send/stop button
 *   Mobile:  textarea only + absolute-positioned button at bottom-right
 *
 * Stop behavior:
 *   When isLoading=true, the button calls onStop() to abort the SSE stream.
 *   The partial response stays visible, marked as no longer streaming.
 */

import { useState, useRef, type KeyboardEvent } from "react";
import { ArrowUp } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatInputProps {
  /** Called with the trimmed question text when the user submits. */
  onSend: (question: string) => void;

  /** Whether the agent is currently streaming a response. */
  isLoading: boolean;

  /** Called when the user clicks the stop button during streaming. */
  onStop?: () => void;

  /** Reserved for future use — currently unused. */
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatInput({ onSend, isLoading, onStop }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setValue("");
    // Reset height after clearing so the textarea shrinks back to 1 row
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter submits — Shift+Enter inserts a newline instead
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  /** Auto-resize textarea height to fit content, up to 200px. */
  const handleInput = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  };

  return (
    <div className="px-3 sm:px-6 pb-3 sm:pb-4 pt-2">
      <div className="max-w-4xl mx-auto">
        {/* Input container — rounded border with cyan focus ring */}
        <div
          className="rounded-2xl border transition-all duration-200 relative"
          style={{
            backgroundColor: "var(--bg-secondary)",
            borderColor: focused ? "var(--accent-cyan)" : "var(--border-color)",
            boxShadow: focused
              ? "0 0 0 1px var(--accent-cyan), 0 8px 30px rgba(0,212,255,0.06)"
              : "none",
          }}
        >
          {/* Textarea — no disabled prop so cursor stays default when loading */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Write a message..."
            rows={1}
            className="w-full resize-none bg-transparent px-4 sm:px-5 pt-3 sm:pt-4 pb-8 text-sm focus:outline-none max-h-48"
            style={{
              color: "var(--text-primary)",
              // Hide scrollbar when empty — only show when content overflows
              overflowY: value ? "auto" : "hidden",
            }}
          />

          {/* Desktop footer — Enter hint + send/stop button */}
          <div className="hidden sm:flex items-center justify-between px-4 pb-3 pt-1">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              <kbd
                className="px-1.5 py-0.5 rounded font-mono"
                style={{
                  backgroundColor: "var(--bg-card)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-color)",
                  fontSize: "10px",
                }}
              >
                Enter
              </kbd>{" "}
              to send
            </p>

            {/* Send button → Stop button when agent is responding */}
            <button
              onClick={isLoading ? onStop : handleSubmit}
              disabled={!isLoading && !value.trim()}
              className="flex items-center gap-2 p-2 rounded-lg text-sm font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background: isLoading
                  ? "var(--bg-card)"
                  : value.trim()
                    ? "linear-gradient(135deg, var(--accent-cyan), var(--accent-emerald))"
                    : "var(--bg-card)",
                color: isLoading
                  ? "var(--text-secondary)"
                  : value.trim()
                    ? "#0f1117"
                    : "var(--text-muted)",
                border: "1px solid var(--border-color)",
              }}
            >
              {isLoading ? (
                /* Stop icon — filled square */
                <div
                  className="w-4 h-4 rounded-sm"
                  style={{ backgroundColor: "var(--accent-cyan)" }}
                />
              ) : (
                <ArrowUp className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Mobile button — absolute bottom-right corner of textarea */}
          <button
            onClick={isLoading ? onStop : handleSubmit}
            disabled={!isLoading && !value.trim()}
            className="sm:hidden absolute bottom-2 right-2 p-2 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: isLoading
                ? "var(--bg-card)"
                : value.trim()
                  ? "linear-gradient(135deg, var(--accent-cyan), var(--accent-emerald))"
                  : "var(--bg-card)",
              border: "1px solid var(--border-color)",
            }}
          >
            {isLoading ? (
              <div
                className="w-3.5 h-3.5 rounded-sm"
                style={{ backgroundColor: "var(--text-secondary)" }}
              />
            ) : (
              <ArrowUp
                className="w-4 h-4"
                style={{
                  color: value.trim() ? "#0f1117" : "var(--text-muted)",
                }}
              />
            )}
          </button>
        </div>

        {/* Disclaimer */}
        <p
          className="text-center mt-2 px-2"
          style={{ fontSize: "11px", color: "var(--text-muted)" }}
        >
          Matr is AI and can make mistakes. Please double-check responses.
        </p>
      </div>
    </div>
  );
}
