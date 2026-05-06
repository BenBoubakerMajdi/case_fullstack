/**
 * Type definitions for SSE events, messages, and datasets.
 *
 * These types are shared across the entire frontend and mirror
 * the Pydantic schemas defined in backend/schemas.py.
 *
 * SSE event flow:
 *   thinking → tool_call → tool_result → visualization/table → text_delta → final → done
 *
 * Frontend rendering map:
 *   thinking      → ThinkingBlock    (collapsible reasoning block)
 *   tool_call     → ToolCallBlock    (shows tool name + arguments)
 *   tool_result   → ToolCallBlock    (shows tool return value)
 *   visualization → PlotlyChart      (interactive Plotly chart)
 *   table         → DataTable        (scrollable data table)
 *   streaming_text → plain text      (accumulated word by word, replaced by final)
 *   final         → ReactMarkdown    (fully rendered markdown answer)
 *   error         → error alert      (red error block)
 *   done          → (no render)      (signals stream completion to useChat)
 */

// ---------------------------------------------------------------------------
// SSE event types
// ---------------------------------------------------------------------------

/**
 * All possible event types streamed from the backend.
 * Must stay in sync with the Literal type in backend/schemas.py SSEEvent.
 */
export type SSEEventType =
  | "thinking" // Agent reasoning — shown in collapsible block
  | "tool_call" // Tool invocation — shows name and arguments
  | "tool_result" // Raw tool return — shown inside tool call block
  | "visualization" // Plotly chart JSON — rendered as interactive chart
  | "table" // Tabular data — rendered as scrollable DataTable
  | "text" // Legacy text event — kept for backward compatibility
  | "text_delta" // Single word delta — accumulated into streaming_text
  | "streaming_text" // Accumulated typed text — replaced by final on completion
  | "final" // Complete answer — rendered as markdown, replaces streaming_text
  | "error" // Error message — displayed as alert block
  | "done"; // Stream end signal — marks message as no longer streaming

/**
 * A single SSE event received from the backend stream.
 * Not all fields are present on every event — field presence depends on type.
 *
 * Field usage by event type:
 *   content       → thinking, text_delta, streaming_text, final, error
 *   tool_name     → tool_call, tool_result
 *   tool_args     → tool_call
 *   tool_result   → tool_result
 *   plotly_data   → visualization
 *   table_data    → table
 *   table_columns → table
 */
export interface SSEEvent {
  /** Determines which UI component renders this event. */
  type: SSEEventType;

  /** Text content — used by thinking, text_delta, streaming_text, final, error. */
  content?: string;

  /** Name of the tool being called or returning a result. */
  tool_name?: string;

  /** Arguments passed to the tool — displayed in the tool call block. */
  tool_args?: Record<string, unknown>;

  /** Raw string result returned by the tool. */
  tool_result?: string;

  /** Plotly figure as a JSON dict — passed directly to Plotly.react(). */
  plotly_data?: Record<string, unknown>;

  /** Row data for table events — each item is one row as a key-value dict. */
  table_data?: Record<string, unknown>[];

  /** Ordered column names for table events — defines column order in DataTable. */
  table_columns?: string[];
}

// ---------------------------------------------------------------------------
// Message
// ---------------------------------------------------------------------------

/**
 * A single message in the conversation — either from the user or the assistant.
 *
 * User messages contain a single SSEEvent of type "text" with the question.
 * Assistant messages contain a sequence of SSE events accumulated during streaming.
 *
 * The events array grows progressively as the backend streams events.
 * When isStreaming is false, the message is complete and the avatar transitions
 * from thinking to idle state.
 */
export interface Message {
  /** Unique identifier — generated client-side via crypto.randomUUID(). */
  id: string;

  /** Who sent this message. */
  role: "user" | "assistant";

  /**
   * Ordered list of SSE events that make up this message's content.
   * Rendered sequentially by MessageList — each event maps to a UI component.
   * For assistant messages: streaming_text is replaced by final on completion.
   */
  events: SSEEvent[];

  /**
   * Whether this message is still receiving SSE events.
   * Controls agent avatar state (thinking vs idle) and
   * whether the copy/timestamp row is shown.
   */
  isStreaming: boolean;

  /** When this message was created — displayed as HH:MM in the UI. */
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// Dataset
// ---------------------------------------------------------------------------

/**
 * Metadata for a single CSV dataset loaded by the backend.
 * Returned by GET /api/datasets and displayed in the sidebar.
 */
export interface Dataset {
  /** Sanitized SQL table name — e.g. "carpriceprediction", "telcoclient". */
  name: string;

  /** Total number of rows in the dataset. */
  rows: number;

  /** Ordered list of column names — first 3 shown as pills in the sidebar. */
  columns: string[];
}
