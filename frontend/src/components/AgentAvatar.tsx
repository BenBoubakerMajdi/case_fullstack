/**
 * AgentAvatar — animated Matr logo displayed below assistant messages.
 *
 * Behavior:
 *   Thinking (isThinking=true):
 *     - Outer ring spins with cyan-to-emerald gradient (animate-logo-spin)
 *     - Inner logo pulses (animate-logo-pulse)
 *     - Rotating status message appears beside the logo
 *
 *   Idle (isThinking=false):
 *     - Static gradient logo, no animation
 *     - No status message
 *
 * Placement (handled by MessageList):
 *     - Appears under the last assistant message only
 *     - Transitions smoothly from thinking to idle when streaming ends
 *     - Disappears when the user sends a new message
 */

import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentAvatarProps {
  /** Whether the agent is currently processing a response. */
  isThinking?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Status messages cycled while the agent is thinking.
 * Rotated every 2 seconds to indicate active processing.
 */
const THINKING_MESSAGES = [
  "Thinking...",
  "Analyzing...",
  "Querying data...",
  "Processing...",
  "Contemplating...",
  "Reasoning...",
  "Computing...",
  "Exploring...",
] as const;

/** How long each thinking message is shown before rotating (ms). */
const THINKING_MESSAGE_INTERVAL = 2000;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AgentAvatar({ isThinking = false }: AgentAvatarProps) {
  const [messageIndex, setMessageIndex] = useState(0);

  // Rotate through thinking messages while the agent is processing.
  // Interval is cleared when isThinking becomes false to prevent
  // state updates on an idle avatar.
  useEffect(() => {
    if (!isThinking) return;

    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % THINKING_MESSAGES.length);
    }, THINKING_MESSAGE_INTERVAL);

    return () => clearInterval(interval);
  }, [isThinking]);

  return (
    <div className="flex items-center gap-2 shrink-0">
      {/* Logo container — holds spinning ring and pulsing core */}
      <div className="relative w-10 h-10">
        {/* Spinning ring — visible only when thinking */}
        {isThinking && (
          <div
            className="absolute inset-0 rounded-full border-2 border-transparent animate-logo-spin"
            style={{
              borderTopColor: "var(--accent-cyan)",
              borderRightColor: "var(--accent-emerald)",
            }}
          />
        )}

        {/* Gradient logo core */}
        <div
          className={`
            absolute inset-1 rounded-full flex items-center justify-center
            ${isThinking ? "animate-logo-pulse" : ""}
          `}
          style={{ background: "linear-gradient(135deg, #00d4ff, #00e5a0)" }}
        >
          <svg viewBox="0 0 16 16" fill="none" className="w-6 h-6">
            <path
              d="M2 12V4L5.5 9.5L8 5L10.5 9.5L14 4V12"
              stroke="#0f1117"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* Rotating status message — visible only when thinking */}
      {isThinking && (
        <span
          key={messageIndex}
          className="text-sm font-medium whitespace-nowrap"
          style={{
            color: "var(--text-muted)",
            animation: "fadeIn 0.3s ease-out both",
          }}
        >
          {THINKING_MESSAGES[messageIndex]}
        </span>
      )}
    </div>
  );
}
