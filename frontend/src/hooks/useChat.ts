/**
 * useChat — manages conversation state and SSE streaming.
 *
 * Responsibilities:
 * - Sending user questions to the FastAPI backend
 * - Reading the SSE stream and dispatching events to the message list
 * - Building assistant messages progressively as events arrive
 * - Handling errors, loading state, and stream interruption
 *
 * SSE event handling strategy:
 *   text_delta  → accumulated into a single streaming_text event (typing effect)
 *   final       → replaces streaming_text with fully rendered markdown
 *   done        → marks message as no longer streaming
 *   error       → shows toast, marks message as done
 *   all others  → appended directly to the message's events array
 *
 * Multi-turn conversation:
 *   The backend maintains message_history in memory. This hook sends only
 *   the current question — history is managed server-side. clearHistory()
 *   calls DELETE /api/chat/history to reset it.
 */

import { useState, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import { type Message, type SSEEvent } from "../types/events";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_URL = "/api/chat/stream";
const HISTORY_URL = "/api/chat/history";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Ref to the active AbortController.
   * Allows stopMessage() to cancel an in-flight SSE stream.
   * Using a ref instead of state avoids unnecessary re-renders.
   */
  const abortControllerRef = useRef<AbortController | null>(null);

  // ── sendMessage ───────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (question: string, conversationId?: string | null) => {
      if (!question.trim() || isLoading) return;

      setError(null);

      // Build the user message immediately so it appears in the UI
      // before the backend responds
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        events: [{ type: "text", content: question }],
        isStreaming: false,
        timestamp: new Date(),
      };

      // Empty assistant message — filled progressively by SSE events
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        events: [],
        isStreaming: true,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsLoading(true);

      // Cancel any previous in-flight request before starting a new one
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            // Pass conversation_id if provided — backend saves to DB
            ...(conversationId && { conversation_id: conversationId }),
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) throw new Error("No response body");

        // ── Read SSE stream ─────────────────────────────────────────────
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            // SSE lines are prefixed with "data: "
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const event: SSEEvent = JSON.parse(jsonStr);

              // ── Done — mark message complete ──────────────────────────
              if (event.type === "done") {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessage.id
                      ? { ...msg, isStreaming: false }
                      : msg,
                  ),
                );
                break;
              }

              // ── Error — show toast and stop streaming ─────────────────
              if (event.type === "error") {
                setError(event.content || "An error occurred.");
                toast.error("Agent error: " + event.content);
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessage.id
                      ? {
                          ...msg,
                          isStreaming: false,
                          events: [...msg.events, event],
                        }
                      : msg,
                  ),
                );
                break;
              }

              // ── Final — replace streaming_text with rendered markdown ──
              // Filters out intermediate typed text and replaces with the
              // complete answer for proper markdown rendering.
              if (event.type === "final") {
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id !== assistantMessage.id) return msg;
                    const filteredEvents = msg.events.filter(
                      (e) =>
                        e.type !== "streaming_text" &&
                        e.type !== "text_delta" &&
                        e.type !== "text",
                    );
                    return { ...msg, events: [...filteredEvents, event] };
                  }),
                );
                continue;
              }

              // ── Text delta — accumulate into streaming_text ───────────
              // Words arrive one at a time from the backend's word-by-word
              // streaming. We accumulate them into a single streaming_text
              // event to minimise React state updates.
              if (event.type === "text_delta") {
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id !== assistantMessage.id) return msg;
                    const events = [...msg.events];
                    const lastEvent = events[events.length - 1];
                    if (lastEvent?.type === "streaming_text") {
                      // Append to existing streaming_text event
                      events[events.length - 1] = {
                        ...lastEvent,
                        content: (lastEvent.content || "") + event.content,
                      };
                    } else {
                      // First word — create new streaming_text event
                      events.push({
                        type: "streaming_text" as SSEEvent["type"],
                        content: event.content || "",
                      });
                    }
                    return { ...msg, events };
                  }),
                );
                continue;
              }

              // ── All other events — append to message ──────────────────
              // Covers: thinking, tool_call, tool_result, visualization, table
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessage.id
                    ? { ...msg, events: [...msg.events, event] }
                    : msg,
                ),
              );
            } catch {
              // Skip malformed JSON lines — backend may send keep-alive pings
              continue;
            }
          }
        }
      } catch (err) {
        // AbortError is expected when stopMessage() is called — not an error
        if ((err as Error).name === "AbortError") return;

        const errorMsg = (err as Error).message || "Connection failed.";
        setError(errorMsg);
        toast.error("Connection failed: " + errorMsg);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id
              ? { ...msg, isStreaming: false }
              : msg,
          ),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading],
  );

  // ── clearHistory ──────────────────────────────────────────────────────────
  /**
   * Clear all messages from the UI and reset server-side conversation history.
   * Called when the user clicks "Clear conversation" in the sidebar.
   */
  const clearHistory = useCallback(async () => {
    setMessages([]);
    setError(null);
    try {
      await fetch(HISTORY_URL, { method: "DELETE" });
      toast.success("Conversation cleared");
    } catch {
      toast.error("Failed to clear conversation");
    }
  }, []);

  // ── stopMessage ───────────────────────────────────────────────────────────
  /**
   * Interrupt the current agent run by aborting the SSE stream.
   * The backend will stop processing mid-response.
   * The partial message stays visible — it is marked as no longer streaming.
   */
  const stopMessage = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
    setMessages((prev) =>
      prev.map((msg, idx) =>
        idx === prev.length - 1 && msg.role === "assistant"
          ? { ...msg, isStreaming: false }
          : msg,
      ),
    );
  }, []);

  /**
   * Load messages from a past conversation into the chat view.
   * Converts DB message format to the Message type used by the UI.
   */
  const loadMessagesFromHistory = useCallback(
    (
      dbMessages: {
        id: string;
        role: "user" | "assistant";
        content: string;
        events: SSEEvent[];
        created_at: string;
      }[],
    ) => {
      const messages: Message[] = dbMessages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        events:
          msg.role === "user"
            ? [{ type: "text" as SSEEvent["type"], content: msg.content }]
            : msg.events,
        isStreaming: false,
        timestamp: new Date(msg.created_at),
      }));
      setMessages(messages);
    },
    [],
  );

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearHistory,
    stopMessage,
    loadMessagesFromHistory,
  };
}
