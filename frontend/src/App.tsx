/**
 * App — root layout component with responsive sidebar and chat view.
 *
 * Layout modes:
 *   No messages  → WelcomeScreen (full page, centered)
 *   Has messages → Chat layout (sidebar + message list + input)
 *
 * Sidebar behavior:
 *   Desktop (lg+): persistent sidebar — always visible when chat is active
 *   Mobile (<lg):  hidden by default, slides in as a drawer when hamburger
 *                  is tapped, closes on backdrop click or X button
 *
 * Data flow:
 *   Datasets are fetched once on mount from GET /api/datasets.
 *   Conversation state lives in useChat() — messages, loading, send, stop.
 *   SidebarContent is a separate component (not inline) to avoid React's
 *   "components created during render" error.
 */

import { useEffect, useState } from "react";
import { Database, Trash2, Menu, X } from "lucide-react";
import { MessageList } from "./components/MessageList";
import { ChatInput } from "./components/ChatInput";
import { useChat } from "./hooks/useChat";
import { type Dataset } from "./types/events";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { DatasetUpload } from "./components/DatasetUpload";
import { useConversations } from "./hooks/useConversations";
import { ConversationList } from "./components/ConversationList";

// ---------------------------------------------------------------------------
// SidebarContent
//
// Extracted as a named component outside App to prevent React from treating
// it as a new component on every render, which would reset its internal state.
// Receives all data and callbacks as props from App.
// ---------------------------------------------------------------------------

interface SidebarContentProps {
  datasets: Dataset[];
  clearHistory: () => void;
  onClose: () => void;
  onUploadSuccess: (dataset: {
    name: string;
    rows: number;
    columns: string[];
  }) => void;
  // Conversation props
  conversations: ReturnType<typeof useConversations>["conversations"];
  activeConversationId: string | null;
  isLoadingConversations: boolean;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onNewConversation: () => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onToggle: () => void;
}

function SidebarContent({
  datasets,
  clearHistory,
  onClose,
  onUploadSuccess,
  conversations,
  activeConversationId,
  isLoadingConversations,
  onSelectConversation,
  onDeleteConversation,
  onNewConversation,
  onToggle,
  onRenameConversation,
}: SidebarContentProps) {
  return (
    <>
      {/* Header */}
      <div
        className="px-5 py-4 border-b flex items-center justify-between shrink-0"
        style={{ borderColor: "var(--border-color)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, var(--accent-cyan), var(--accent-emerald))",
            }}
          >
            <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
              <path
                d="M2 12V4L5.5 9.5L8 5L10.5 9.5L14 4V12"
                stroke="#0f1117"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span
            className="font-bold text-base"
            style={{ color: "var(--text-primary)" }}
          >
            Matr
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Data Agent
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Desktop toggle — hidden on mobile */}
          <button
            onClick={onToggle}
            className="hidden lg:flex p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--text-secondary)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-muted)")
            }
            title="Toggle sidebar"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-4 h-4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 3v18" />
            </svg>
          </button>

          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-lg"
            style={{ color: "var(--text-muted)" }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
        {/* Conversation history */}
        <div className="flex flex-col" style={{ minHeight: "300px" }}>
          <ConversationList
            conversations={conversations}
            activeConversationId={activeConversationId}
            isLoading={isLoadingConversations}
            onSelect={(id) => {
              onSelectConversation(id);
              onClose();
            }}
            onDelete={onDeleteConversation}
            onNew={() => {
              onNewConversation();
              onClose();
            }}
            onRename={onRenameConversation}
          />
        </div>

        {/* Divider */}
        <div
          className="mx-4 my-2 border-t"
          style={{ borderColor: "var(--border-color)" }}
        />

        {/* Datasets section */}
        <div className="px-4 pb-2">
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-3"
            style={{ color: "var(--text-muted)" }}
          >
            Datasets
          </p>

          {/* Upload */}
          <div className="mb-3">
            <DatasetUpload onUploadSuccess={onUploadSuccess} />
          </div>

          {/* Dataset cards */}
          <div className="space-y-2">
            {datasets.length === 0
              ? [1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="rounded-lg border p-3 animate-pulse"
                    style={{
                      backgroundColor: "var(--bg-card)",
                      borderColor: "var(--border-color)",
                    }}
                  >
                    <div
                      className="h-3 rounded w-2/3 mb-2"
                      style={{ backgroundColor: "var(--bg-input)" }}
                    />
                    <div
                      className="h-2 rounded w-1/2 ml-5"
                      style={{ backgroundColor: "var(--bg-input)" }}
                    />
                  </div>
                ))
              : datasets.map((ds) => (
                  <div
                    key={ds.name}
                    className="rounded-lg border p-3"
                    style={{
                      backgroundColor: "var(--bg-card)",
                      borderColor: "var(--border-color)",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Database
                        className="w-3.5 h-3.5 flex-shrink-0"
                        style={{ color: "var(--accent-cyan)" }}
                      />
                      <span
                        className="text-sm font-medium font-mono truncate"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {ds.name}
                      </span>
                    </div>
                    <p
                      className="text-xs ml-5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {ds.rows.toLocaleString()} rows · {ds.columns.length} cols
                    </p>
                    <div className="mt-1.5 ml-5 flex flex-wrap gap-1">
                      {ds.columns.slice(0, 3).map((col) => (
                        <span
                          key={col}
                          className="text-xs rounded px-1.5 py-0.5 font-mono"
                          style={{
                            backgroundColor: "var(--bg-input)",
                            color: "var(--text-secondary)",
                            border: "1px solid var(--border-color)",
                          }}
                        >
                          {col}
                        </span>
                      ))}
                      {ds.columns.length > 3 && (
                        <span
                          className="text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          +{ds.columns.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        className="px-4 py-4 border-t shrink-0"
        style={{ borderColor: "var(--border-color)" }}
      >
        <button
          onClick={() => {
            clearHistory();
            onClose();
          }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors"
          style={{
            color: "var(--text-secondary)",
            border: "1px solid var(--border-color)",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "var(--bg-card)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "transparent")
          }
        >
          <Trash2 className="w-4 h-4" />
          Clear conversation
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  const {
    messages,
    isLoading,
    sendMessage,
    clearHistory,
    stopMessage,
    loadMessagesFromHistory,
  } = useChat();

  const {
    conversations,
    activeConversationId,
    isLoadingConversations,
    setActiveConversationId,
    createConversation,
    deleteConversation,
    updateConversationTitle,
    loadConversation,
    renameConversation,
  } = useConversations();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [datasets, setDatasets] = useState<Dataset[]>([]);

  /**
   * Controls mobile sidebar drawer visibility.
   * Desktop sidebar is always shown when hasMessages=true — this state
   * only affects the mobile drawer.
   */
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fetch dataset metadata once on mount.
  // Datasets are displayed in the sidebar and welcome screen pills.
  useEffect(() => {
    fetch("/api/datasets")
      .then((res) => res.json())
      .then(setDatasets)
      .catch(console.error);
  }, []);

  /** True once the user has sent at least one message. Switches layouts. */
  const hasMessages = messages.length > 0;

  // for testing the error boundary UI
  // throw new Error("Test error boundary");

  // ── Handle sending a message ───────────────────────────────────────────
  const handleSend = async (question: string) => {
    let convId = activeConversationId;

    // Create a new conversation if none is active
    if (!convId) {
      convId = await createConversation();
    }

    await sendMessage(question, convId);

    // Update title in sidebar after first message
    if (convId) {
      const isFirstMessage =
        messages.filter((m) => m.role === "user").length === 0;
      if (isFirstMessage) {
        updateConversationTitle(
          convId,
          question.slice(0, 60) + (question.length > 60 ? "..." : ""),
        );
      }
    }
  };

  // ── Handle selecting a past conversation ──────────────────────────────
  const handleSelectConversation = async (id: string) => {
    setActiveConversationId(id);
    clearHistory();

    const data = await loadConversation(id);
    if (data?.messages) {
      loadMessagesFromHistory(data.messages);
    }
  };

  // ── Handle new conversation ────────────────────────────────────────────
  const handleNewConversation = async () => {
    clearHistory();
    setActiveConversationId(null);
  };

  // ── Handle upload success ──────────────────────────────────────────────
  const handleUploadSuccess = (dataset: {
    name: string;
    rows: number;
    columns: string[];
  }) => {
    setDatasets((prev) => {
      const exists = prev.find((d) => d.name === dataset.name);
      if (exists)
        return prev.map((d) => (d.name === dataset.name ? dataset : d));
      return [...prev, dataset];
    });
  };

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{
        backgroundColor: "var(--bg-primary)",
        color: "var(--text-primary)",
      }}
    >
      {/* ── Desktop sidebar ── */}
      {(hasMessages || conversations.length > 0) && (
        <aside
          className="hidden lg:flex flex-col border-r shrink-0"
          style={{
            backgroundColor: "var(--bg-sidebar)",
            borderColor: "var(--border-color)",
            width: sidebarCollapsed ? "0px" : "256px",
            minWidth: sidebarCollapsed ? "0px" : "256px",
            overflow: "hidden",
            transition:
              "width 0.3s cubic-bezier(0.16, 1, 0.3, 1), min-width 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <SidebarContent
            datasets={datasets}
            clearHistory={clearHistory}
            onClose={() => setSidebarOpen(false)}
            onUploadSuccess={handleUploadSuccess}
            conversations={conversations}
            activeConversationId={activeConversationId}
            isLoadingConversations={isLoadingConversations}
            onSelectConversation={handleSelectConversation}
            onDeleteConversation={deleteConversation}
            onNewConversation={handleNewConversation}
            onToggle={() => setSidebarCollapsed(true)}
            onRenameConversation={renameConversation}
          />
        </aside>
      )}

      {/* ── Mobile sidebar drawer — only shown when chat is active ── */}
      {(hasMessages || conversations.length > 0) && sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 lg:hidden"
            style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
            onClick={() => setSidebarOpen(false)}
          />
          <aside
            className="fixed left-0 top-0 h-full w-72 z-50 flex flex-col lg:hidden animate-slide-in-left"
            style={{
              backgroundColor: "var(--bg-sidebar)",
              borderRight: "1px solid var(--border-color)",
              opacity: 0,
            }}
          >
            <SidebarContent
              datasets={datasets}
              clearHistory={clearHistory}
              onClose={() => setSidebarOpen(false)}
              onUploadSuccess={handleUploadSuccess}
              conversations={conversations}
              activeConversationId={activeConversationId}
              isLoadingConversations={isLoadingConversations}
              onSelectConversation={handleSelectConversation}
              onDeleteConversation={deleteConversation}
              onNewConversation={handleNewConversation}
              onToggle={() => setSidebarCollapsed(true)}
              onRenameConversation={renameConversation}
            />
          </aside>
        </>
      )}

      {/* ── Desktop re-open sidebar button ────────────────────── */}
      {/* ── Desktop re-open tab — shown when collapsed ───── */}
      {(hasMessages || conversations.length > 0) && sidebarCollapsed && (
        <button
          onClick={() => setSidebarCollapsed(false)}
          className="hidden lg:flex fixed left-0 top-1/2 -translate-y-1/2 z-30 p-2 rounded-r-lg border-r border-t border-b transition-all duration-200"
          style={{
            backgroundColor: "var(--bg-sidebar)",
            borderColor: "var(--border-color)",
            color: "var(--text-muted)",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = "var(--accent-cyan)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "var(--text-muted)")
          }
          title="Open sidebar"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-4 h-4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 3v18" />
          </svg>
        </button>
      )}

      {/* ── Main area ─────────────────────────────────────────── */}
      <main
        className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden"
        style={{ backgroundColor: "var(--bg-primary)" }}
      >
        {!hasMessages ? (
          <WelcomeScreen
            datasets={datasets}
            onSend={handleSend}
            isLoading={isLoading}
          />
        ) : (
          <div
            className="flex-1 flex flex-col min-w-0 overflow-hidden animate-scale-in"
            style={{ opacity: 0 }}
          >
            {/* Mobile top bar */}
            <div
              className="flex flex-row-reverse justify-between lg:hidden items-center gap-3 px-4 py-4 border-b shrink-0"
              style={{ borderColor: "var(--border-color)" }}
            >
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1 rounded-lg transition-colors"
                style={{ color: "var(--text-secondary)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "var(--bg-card)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
              >
                <Menu className="w-6 h-6" />
              </button>
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center"
                style={{
                  background:
                    "linear-gradient(135deg, var(--accent-cyan), var(--accent-emerald))",
                }}
              >
                <svg viewBox="0 0 16 16" fill="none" className="w-5 h-5">
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

            {/* Messages */}
            <div className="flex-1 overflow-y-auto">
              <MessageList messages={messages} />
            </div>

            {/* Input */}
            <div
              className="shrink-0"
              style={{ backgroundColor: "var(--bg-primary)" }}
            >
              <ChatInput
                onSend={handleSend}
                isLoading={isLoading}
                onStop={stopMessage}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
