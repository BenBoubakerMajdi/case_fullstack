/**
 * ThinkingBlock — collapsible block showing the agent's internal reasoning.
 *
 * The agent wraps its reasoning in <thinking> tags before each tool call.
 * The backend extracts these and sends them as 'thinking' SSE events.
 * This component renders them in a collapsible purple-themed block so
 * the user can inspect the agent's reasoning without it cluttering the UI.
 *
 * Design: dark purple background (#140f1f) with purple border (#2d1f4a)
 * — visually distinct from tool call blocks (amber) and charts.
 */

import { useState } from "react";
import { ChevronDown, ChevronRight, Brain } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ThinkingBlockProps {
  /** The agent's raw reasoning text extracted from <thinking> tags. */
  content: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ThinkingBlock({ content }: ThinkingBlockProps) {
  /** Controls whether the reasoning content is expanded or collapsed. */
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="my-2 rounded-lg border overflow-hidden"
      style={{ backgroundColor: "#140f1f", borderColor: "#2d1f4a" }}
    >
      {/* Toggle header */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors"
        style={{ color: "#a78bfa" }}
      >
        <Brain className="w-4 h-4 flex-shrink-0" />
        <span className="font-medium">Agent thinking</span>
        <span className="ml-auto">
          {isOpen ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </span>
      </button>

      {/* Collapsible content */}
      {isOpen && (
        <div className="px-4 py-3 border-t" style={{ borderColor: "#2d1f4a" }}>
          <p
            className="text-sm whitespace-pre-wrap font-mono leading-relaxed"
            style={{ color: "#c4b5fd" }}
          >
            {content}
          </p>
        </div>
      )}
    </div>
  );
}
