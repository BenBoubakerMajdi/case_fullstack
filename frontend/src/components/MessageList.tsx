/**
 * MessageList — renders the full conversation with progressive SSE event display.
 *
 * Layout behavior:
 *   User messages    → right-aligned dark bubble (max 75% width)
 *   Assistant messages → full width, no bubble, events rendered sequentially
 *   Agent avatar     → appears below the last assistant message only,
 *                       animates while streaming, goes idle when done
 *
 * Scroll behavior:
 *   overflow-x: hidden — prevents wide tables from expanding the page
 *   overflow-y: auto   — vertical scroll only
 *   Auto-scrolls to bottom on each new message/event via bottomRef
 *
 * Event rendering:
 *   Each SSE event type maps to a specific component via renderEvent().
 *   Events are wrapped in a fade-in animation with staggered delays.
 *   streaming_text events are suppressed — replaced by final on completion.
 */

import { useEffect, useRef, useState } from "react";
import { type Message, type SSEEvent } from "../types/events";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolCallBlock } from "./ToolCallBlock";
import { PlotlyChart } from "./PlotlyChart";
import { DataTable } from "./DataTable";
import { AgentAvatar } from "./AgentAvatar";
import { AlertCircle, Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "react-hot-toast";
import type { Components } from "react-markdown";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MessageListProps {
  /** Full conversation history — both user and assistant messages. */
  messages: Message[];
}

// ---------------------------------------------------------------------------
// CopyButton
// ---------------------------------------------------------------------------

interface CopyButtonProps {
  /** Text to copy to clipboard when clicked. */
  text: string;
}

/**
 * Small icon button that copies text to clipboard and shows a toast.
 * Displays a checkmark for 2 seconds after a successful copy.
 */
function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-md transition-all"
      style={{ color: "var(--text-muted)", backgroundColor: "transparent" }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.color = "var(--text-secondary)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
      title="Copy to clipboard"
    >
      {copied ? (
        <Check
          className="w-3.5 h-3.5"
          style={{ color: "var(--accent-emerald)" }}
        />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Markdown component overrides
// ---------------------------------------------------------------------------

/**
 * Custom ReactMarkdown component renderers for the dark theme.
 *
 * Why custom renderers:
 *   ReactMarkdown's default output uses plain HTML with no styling.
 *   These overrides apply the app's CSS variables and design tokens
 *   so the agent's markdown answers match the dark UI consistently.
 *
 * Table note:
 *   Tables are wrapped in an overflow-x: auto div to prevent them
 *   from expanding the page layout for wide result sets.
 */
const MARKDOWN_COMPONENTS: Components = {
  p: ({ children }) => (
    <p
      className="mb-2 mt-5 last:mb-0 last:mt-2"
      style={{ color: "var(--text-primary)" }}
    >
      {children}
    </p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold" style={{ color: "var(--accent-cyan)" }}>
      {children}
    </strong>
  ),
  code: ({ children }) => (
    <code
      className="px-1.5 py-0.5 rounded text-xs font-mono"
      style={{
        backgroundColor: "var(--bg-card)",
        color: "var(--accent-emerald)",
      }}
    >
      {children}
    </code>
  ),
  table: ({ children }) => (
    <div
      style={{
        marginTop: "10px",
        overflowX: "auto",
        width: "100%",
        display: "block",
      }}
    >
      <table
        style={{
          borderCollapse: "collapse",
          fontSize: "12px",
          whiteSpace: "nowrap",
          width: "max-content",
          minWidth: "100%",
        }}
      >
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th
      className="px-3 py-1.5 text-left font-semibold border"
      style={{
        backgroundColor: "var(--bg-card)",
        color: "var(--text-secondary)",
        borderColor: "var(--border-color)",
      }}
    >
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td
      className="px-3 py-1.5 border"
      style={{
        color: "var(--text-primary)",
        borderColor: "var(--border-color)",
      }}
    >
      {children}
    </td>
  ),
  ul: ({ children }) => (
    <ul
      className="list-disc list-inside space-y-1 mb-2"
      style={{ color: "var(--text-primary)" }}
    >
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol
      className="space-y-4 mb-2"
      style={{
        color: "var(--text-primary)",
        listStyle: "none",
        padding: 0,
        counterReset: "list-counter",
      }}
    >
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="flex gap-3" style={{ counterIncrement: "list-counter" }}>
      <span
        className="flex-shrink-0 font-semibold text-sm mt-0.5"
        style={{ color: "var(--accent-cyan)", minWidth: "20px" }}
      >
        {/* Number rendered by CSS counter */}
      </span>
      <div className="flex-1">{children}</div>
    </li>
  ),
  h1: ({ children }) => (
    <h1
      className="text-base font-semibold mt-6 mb-2"
      style={{ color: "var(--accent-cyan)" }}
    >
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2
      className="text-base font-semibold mt-6 mb-2"
      style={{ color: "var(--accent-cyan)" }}
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3
      className="text-sm font-semibold mt-5 mb-2"
      style={{ color: "var(--accent-cyan)" }}
    >
      {children}
    </h3>
  ),
};

// ---------------------------------------------------------------------------
// Event animation wrapper
// ---------------------------------------------------------------------------

/**
 * Wraps any React node in a fade-in animation div with a staggered delay.
 * The delay is based on the event's index within the message — earlier
 * events appear first, creating a cascading reveal effect.
 */
function wrapWithAnimation(content: React.ReactNode, index: number) {
  return (
    <div
      key={index}
      className="animate-fade-in"
      style={{ animationDelay: `${index * 0.06}s`, opacity: 0 }}
    >
      {content}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event renderer
// ---------------------------------------------------------------------------

/**
 * Maps a single SSE event to its corresponding UI component.
 *
 * Returns null for:
 *   - streaming_text: suppressed because final replaces it on completion
 *   - unknown types: defensive fallback
 *
 * All rendered components are wrapped in wrapWithAnimation() for
 * the staggered cascade effect as events arrive.
 */
function renderEvent(event: SSEEvent, index: number) {
  switch (event.type) {
    case "thinking":
      return wrapWithAnimation(
        <ThinkingBlock content={event.content || ""} />,
        index,
      );

    case "tool_call":
      return wrapWithAnimation(
        <ToolCallBlock
          toolName={event.tool_name || "tool"}
          toolArgs={event.tool_args}
        />,
        index,
      );

    case "tool_result":
      return wrapWithAnimation(
        <ToolCallBlock
          toolName={event.tool_name || "query_data"}
          toolResult={event.tool_result}
        />,
        index,
      );

    case "visualization":
      return wrapWithAnimation(
        event.plotly_data ? (
          <PlotlyChart plotlyData={event.plotly_data} />
        ) : null,
        index,
      );

    case "table":
      return wrapWithAnimation(
        event.table_columns && event.table_data ? (
          <DataTable columns={event.table_columns} data={event.table_data} />
        ) : null,
        index,
      );

    case "streaming_text":
      // Suppressed — useChat replaces streaming_text with final on completion.
      // Rendering it here would cause the answer to appear twice.
      return null;

    case "final":
      return wrapWithAnimation(
        <div className="text-sm leading-relaxed mt-2">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={MARKDOWN_COMPONENTS}
          >
            {event.content || ""}
          </ReactMarkdown>
        </div>,
        index,
      );

    case "error":
      return wrapWithAnimation(
        <div
          className="flex items-start gap-2 p-3 rounded-lg mt-2"
          style={{ backgroundColor: "#1f0f0f", border: "1px solid #4a1515" }}
        >
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{event.content}</p>
        </div>,
        index,
      );

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MessageList({ messages }: MessageListProps) {
  /** Ref attached to an invisible div at the bottom of the list.
   *  Scrolled into view on every new message to keep the latest content visible. */
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const lastMessage = messages[messages.length - 1];
  const isLastMessageAssistant = lastMessage?.role === "assistant";

  return (
    <div
      className="flex-1 py-6"
      style={{ overflowX: "hidden", overflowY: "auto" }}
    >
      <div className="max-w-4xl mx-auto px-3 sm:px-6">
        {messages.map((message, messageIndex) => (
          <div
            key={message.id}
            className="animate-fade-slide-in mb-8"
            style={{ animationDelay: `${messageIndex * 0.04}s`, opacity: 0 }}
          >
            {/* ── User message — right-aligned bubble ───────────── */}
            {message.role === "user" ? (
              <div className="flex justify-end">
                <div className="max-w-[90%] sm:max-w-[75%]">
                  <div
                    className="rounded-xl rounded-tr-sm px-4 py-3"
                    style={{
                      background: "linear-gradient(135deg, #1a2236, #1e2a3a)",
                      border: "1px solid var(--border-color)",
                    }}
                  >
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {message.events[0]?.content}
                    </p>
                  </div>

                  {/* Timestamp + copy */}
                  <div className="flex items-center justify-end gap-2 mt-1">
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {message.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <CopyButton text={message.events[0]?.content || ""} />
                  </div>
                </div>
              </div>
            ) : (
              /* ── Assistant message — full width, no bubble ───── */
              <div className="w-full" style={{ minWidth: 0 }}>
                {/* Event sequence — renders progressively as SSE events arrive */}
                <div className="w-full" style={{ minWidth: 0 }}>
                  {message.events.length === 0 && message.isStreaming
                    ? null // Avatar alone handles loading state
                    : message.events.map((event, idx) =>
                        renderEvent(event, idx),
                      )}
                </div>

                {/* Timestamp + copy — shown only after streaming completes */}
                {!message.isStreaming &&
                  message.events.some((e) => e.type === "final") && (
                    <div className="flex items-center justify-end gap-2 mt-2">
                      <span
                        className="text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {message.timestamp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <CopyButton
                        text={
                          message.events
                            .filter((e) => e.type === "final")
                            .map((e) => e.content)
                            .join("\n") || ""
                        }
                      />
                    </div>
                  )}
              </div>
            )}
          </div>
        ))}

        {/* ── Agent avatar — below last assistant message ────────── */}
        {isLastMessageAssistant && (
          <div
            className="flex items-center gap-3 mt-3 mb-4 animate-fade-in"
            style={{ opacity: 0 }}
          >
            <AgentAvatar isThinking={lastMessage.isStreaming} />
          </div>
        )}

        {/* Invisible scroll anchor */}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
