/**
 * ToolCallBlock — collapsible block showing a tool invocation and its result.
 *
 * Renders two types of events from the SSE stream:
 *   tool_call   → shows tool name, icon, and arguments (no result yet)
 *   tool_result → adds the result section below the arguments
 *
 * Both event types reuse this component — the result is optional.
 * A CheckCircle icon appears when the result is successful.
 * An AlertCircle icon appears when the result starts with "Error".
 *
 * Two tool types are supported with distinct color themes:
 *   query_data    → amber theme (database queries)
 *   visualize_web → blue/teal theme (chart creation)
 */

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Wrench,
  CheckCircle,
  Database,
  BarChart2,
  AlertCircle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ToolCallBlockProps {
  /** Internal tool function name — mapped to a human-readable label. */
  toolName: string;

  /** Arguments passed to the tool — displayed as key-value pairs. */
  toolArgs?: Record<string, unknown>;

  /**
   * Raw string result returned by the tool.
   * Results starting with "Error" are styled in red.
   * Undefined when the tool call event arrives before the result.
   */
  toolResult?: string;
}

// ---------------------------------------------------------------------------
// Tool configuration
// ---------------------------------------------------------------------------

/**
 * Maps internal tool names to display labels, icons, and color themes.
 * Add new tools here when extending the agent with additional capabilities.
 */
const TOOL_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  query_data: {
    label: "Query data",
    icon: <Database className="w-4 h-4" />,
    color: "amber",
  },
  visualize_web: {
    label: "Create visualization",
    icon: <BarChart2 className="w-4 h-4" />,
    color: "blue",
  },
  visualize: {
    label: "Create visualization",
    icon: <BarChart2 className="w-4 h-4" />,
    color: "blue",
  },
  tool: {
    label: "Tool result",
    icon: <Wrench className="w-4 h-4" />,
    color: "amber",
  },
};

/**
 * CSS-in-JS style objects for each color theme.
 * Uses CSS variables defined in index.css for consistency with the dark theme.
 */
const COLOR_CLASSES = {
  amber: {
    wrapper: "border rounded-md overflow-hidden",
    wrapperStyle: {
      backgroundColor: "var(--tool-query-bg)",
      borderColor: "var(--tool-query-border)",
    },
    buttonStyle: { color: "var(--tool-query-text)" },
    labelStyle: { color: "var(--tool-query-text)", opacity: 0.7 },
    resultStyle: {
      backgroundColor: "var(--bg-card)",
      color: "var(--accent-emerald)",
    },
    resultLabelStyle: { color: "var(--accent-emerald)", opacity: 0.8 },
    argKeyStyle: { color: "var(--tool-query-text)" },
    argValStyle: { color: "var(--text-secondary)" },
  },
  blue: {
    wrapper: "border rounded-lg overflow-hidden",
    wrapperStyle: {
      backgroundColor: "var(--tool-viz-bg)",
      borderColor: "var(--tool-viz-border)",
    },
    buttonStyle: { color: "var(--tool-viz-text)" },
    labelStyle: { color: "var(--tool-viz-text)", opacity: 0.7 },
    resultStyle: {
      backgroundColor: "var(--bg-card)",
      color: "var(--accent-emerald)",
    },
    resultLabelStyle: { color: "var(--accent-emerald)", opacity: 0.8 },
    argKeyStyle: { color: "var(--tool-viz-text)" },
    argValStyle: { color: "var(--text-secondary)" },
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ToolCallBlock({
  toolName,
  toolArgs,
  toolResult,
}: ToolCallBlockProps) {
  /** Controls whether the arguments and result are expanded or collapsed. */
  const [isOpen, setIsOpen] = useState(false);

  // Fall back to generic wrench icon for unknown tools
  const config = TOOL_CONFIG[toolName] || {
    label: toolName,
    icon: <Wrench className="w-4 h-4" />,
    color: "amber",
  };

  const colors = COLOR_CLASSES[config.color as keyof typeof COLOR_CLASSES];
  const hasError = toolResult?.startsWith("Error");

  return (
    <div className={`my-2 ${colors.wrapper}`} style={colors.wrapperStyle}>

      {/* Collapsible header — shows tool name, status icon, and toggle */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors"
        style={colors.buttonStyle}
      >
        <span>{config.icon}</span>
        <span className="font-medium">{config.label}</span>

        {/* Status icon — shown when result is available */}
        {toolResult && !hasError && (
          <CheckCircle
            className="w-4 h-4 ml-1 flex-shrink-0"
            style={{ color: "var(--accent-emerald)" }}
          />
        )}
        {toolResult && hasError && (
          <AlertCircle className="w-4 h-4 ml-1 flex-shrink-0 text-red-400" />
        )}

        <span className="ml-auto">
          {isOpen
            ? <ChevronDown className="w-4 h-4" />
            : <ChevronRight className="w-4 h-4" />
          }
        </span>
      </button>

      {/* Expandable content — arguments and result */}
      {isOpen && (
        <div
          className="px-4 py-3 space-y-3 border-t"
          style={{ borderColor: colors.wrapperStyle.borderColor }}
        >
          {/* Tool arguments */}
          {toolArgs && Object.keys(toolArgs).length > 0 && (
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-wide mb-2"
                style={colors.labelStyle}
              >
                Arguments
              </p>
              <div className="space-y-1">
                {Object.entries(toolArgs).map(([key, value]) => (
                  <div key={key}>
                    <span
                      className="text-xs font-mono font-bold"
                      style={colors.argKeyStyle}
                    >
                      {key}:{" "}
                    </span>
                    <span
                      className="text-xs font-mono whitespace-pre-wrap"
                      style={colors.argValStyle}
                    >
                      {typeof value === "string"
                        ? value
                        : JSON.stringify(value, null, 2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tool result — red styling for errors, normal styling otherwise */}
          {toolResult && (
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-wide mb-2"
                style={hasError ? { color: "#f87171" } : colors.resultLabelStyle}
              >
                Result
              </p>
              <p
                className="text-xs font-mono whitespace-pre-wrap rounded p-2"
                style={
                  hasError
                    ? { backgroundColor: "#1f0f0f", color: "#f87171" }
                    : colors.resultStyle
                }
              >
                {toolResult}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}