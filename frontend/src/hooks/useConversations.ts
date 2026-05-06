/**
 * useConversations — manages conversation list and active conversation state.
 *
 * Responsibilities:
 * - Fetching conversation list from the backend
 * - Creating new conversations
 * - Deleting conversations
 * - Tracking the active conversation_id
 * - Loading a past conversation's messages for re-rendering
 */

import { useState, useCallback, useEffect } from "react";
import toast from "react-hot-toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  events: unknown[];
  created_at: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);

  // ── Fetch all conversations ──────────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    setIsLoadingConversations(true);
    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) throw new Error("Failed to fetch conversations.");
      const data: Conversation[] = await res.json();
      setConversations(data);
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    } finally {
      setIsLoadingConversations(false);
    }
  }, []);

  // Fetch on mount — call fetch directly to avoid setState cascade warning
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoadingConversations(true);
      try {
        const res = await fetch("/api/conversations");
        if (!res.ok) throw new Error("Failed to fetch conversations.");
        const data: Conversation[] = await res.json();
        if (!cancelled) setConversations(data);
      } catch (err) {
        console.error("Failed to fetch conversations:", err);
      } finally {
        if (!cancelled) setIsLoadingConversations(false);
      }
    };

    load();

    // Cleanup — prevents setState on unmounted component
    return () => {
      cancelled = true;
    };
  }, []); // Empty deps — runs once on mount only

  // ── Create a new conversation ────────────────────────────────────────────
  const createConversation = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/conversations", { method: "POST" });
      if (!res.ok) throw new Error("Failed to create conversation.");
      const data: Conversation = await res.json();

      setConversations((prev) => [data, ...prev]);
      setActiveConversationId(data.id);
      return data.id;
    } catch (err) {
      toast.error("Failed to create conversation.");
      return null;
    }
  }, []);

  // ── Delete a conversation ────────────────────────────────────────────────
  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/conversations/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to delete conversation.");

        setConversations((prev) => prev.filter((c) => c.id !== id));

        // If deleted conversation was active, clear it
        if (activeConversationId === id) {
          setActiveConversationId(null);
        }

        toast.success("Conversation deleted.");
      } catch (err) {
        toast.error("Failed to delete conversation.");
      }
    },
    [activeConversationId],
  );

  // ── Update title in local state ──────────────────────────────────────────
  // Called after first message to reflect auto-generated title
  const updateConversationTitle = useCallback((id: string, title: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c)),
    );
  }, []);

  // ── Load a past conversation's messages ──────────────────────────────────
  const loadConversation = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (!res.ok) throw new Error("Failed to load conversation.");
      return await res.json();
    } catch (err) {
      toast.error("Failed to load conversation.");
      return null;
    }
  }, []);
    
    const renameConversation = useCallback(
      async (id: string, newTitle: string) => {
        try {
          const res = await fetch(`/api/conversations/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: newTitle }),
          });
          if (!res.ok) throw new Error("Failed to rename.");
          setConversations((prev) =>
            prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c)),
          );
          toast.success("Conversation renamed.");
        } catch {
          toast.error("Failed to rename conversation.");
        }
      },
      [],
    );

  return {
    conversations,
    activeConversationId,
    isLoadingConversations,
    setActiveConversationId,
    fetchConversations,
    createConversation,
    deleteConversation,
    updateConversationTitle,
    loadConversation,
    renameConversation,
  };
}
