/**
 * ConversationList — sidebar list of past conversations.
 */

import { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  Plus,
  MoreHorizontal,
  Trash2,
  Pencil,
} from "lucide-react";
import { type Conversation } from "../hooks/useConversations";
import { createPortal } from "react-dom";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConversationListProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  isLoading: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
  onNew: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// ContextMenu
// ---------------------------------------------------------------------------

interface ContextMenuProps {
  onDelete: () => void;
  onRename: () => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

function ContextMenu({
  onDelete,
  onRename,
  onClose,
  anchorRef,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Calculate position from anchor button
  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: rect.right - 140,
      });
    }
  }, [anchorRef]);

  // Close when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className="fixed rounded-lg border py-1 shadow-2xl"
      style={{
        top: position.top,
        left: position.left,
        backgroundColor: "#0f1117",
        borderColor: "var(--border-color)",
        minWidth: "140px",
        zIndex: 9999,
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRename();
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors text-left"
        style={{ color: "var(--text-secondary)" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "var(--bg-card)";
          e.currentTarget.style.color = "var(--text-primary)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.color = "var(--text-secondary)";
        }}
      >
        <Pencil className="w-3.5 h-3.5" />
        Rename
      </button>

      <div
        className="my-1 border-t"
        style={{ borderColor: "var(--border-color)" }}
      />

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors text-left"
        style={{ color: "#f87171" }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = "#1f0f0f")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = "transparent")
        }
      >
        <Trash2 className="w-3.5 h-3.5" />
        Delete
      </button>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// RenameInput
// ---------------------------------------------------------------------------

interface RenameInputProps {
  initialValue: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

function RenameInput({ initialValue, onConfirm, onCancel }: RenameInputProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onConfirm(value.trim() || initialValue);
        if (e.key === "Escape") onCancel();
        e.stopPropagation();
      }}
      onBlur={() => onConfirm(value.trim() || initialValue)}
      onClick={(e) => e.stopPropagation()}
      className="w-full text-xs rounded px-2 py-1 focus:outline-none"
      style={{
        backgroundColor: "var(--bg-secondary)",
        border: "1px solid var(--accent-cyan)",
        color: "var(--text-primary)",
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConversationList({
  conversations,
  activeConversationId,
  isLoading,
  onSelect,
  onDelete,
  onRename,
  onNew,
}: ConversationListProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleRenameConfirm = async (id: string, newTitle: string) => {
    setRenamingId(null);
    if (newTitle) onRename(id, newTitle);
  };

  return (
    <div className="flex flex-col h-full">
      <p
        className="text-xs font-semibold uppercase tracking-widest mb-3 mt-3 ml-3"
        style={{ color: "var(--text-muted)" }}
      >
        Conversations
      </p>
      {/* New conversation button */}
      <button
        onClick={onNew}
        className="flex items-center gap-2 mx-4 mt-3 mb-2 px-3 py-2 rounded-lg text-sm transition-all border"
        style={{
          color: "var(--accent-cyan)",
          borderColor: "var(--accent-cyan)",
          backgroundColor: "transparent",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = "rgba(0, 212, 255, 0.08)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = "transparent")
        }
      >
        <Plus className="w-4 h-4" />
        New conversation
      </button>

      {/* Divider */}
      <div
        className="mx-4 mb-2 border-t"
        style={{ borderColor: "var(--border-color)" }}
      />

      {/* List */}
      <div
        className="overflow-y-auto overflow-x-visible px-2"
        style={{ maxHeight: "280px", minHeight: "120px" }}
      >
        {isLoading ? (
          [1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 rounded-lg mb-1 animate-pulse"
              style={{ backgroundColor: "var(--bg-card)" }}
            />
          ))
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <MessageSquare
              className="w-8 h-8 mb-2"
              style={{ color: "var(--text-muted)" }}
            />
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              No conversations yet.
              <br />
              Ask a question to get started.
            </p>
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            const isRenaming = renamingId === conv.id;
            const menuOpen = openMenuId === conv.id;

            return (
              <div
                key={conv.id}
                className="group relative flex items-center gap-2 px-3 py-2 rounded-lg mb-1 cursor-pointer transition-all"
                style={{
                  backgroundColor: isActive
                    ? "rgba(0, 212, 255, 0.08)"
                    : "transparent",
                  border: isActive
                    ? "1px solid rgba(0, 212, 255, 0.2)"
                    : "1px solid transparent",
                }}
                onClick={() => !isRenaming && onSelect(conv.id)}
                onMouseEnter={(e) => {
                  if (!isActive)
                    e.currentTarget.style.backgroundColor = "var(--bg-card)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive)
                    e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                {/* Icon */}
                <MessageSquare
                  className="w-3.5 h-3.5 flex-shrink-0"
                  style={{
                    color: isActive
                      ? "var(--accent-cyan)"
                      : "var(--text-muted)",
                  }}
                />

                {/* Title or rename input */}
                <div className="flex-1 min-w-0">
                  {isRenaming ? (
                    <RenameInput
                      initialValue={conv.title}
                      onConfirm={(val) => handleRenameConfirm(conv.id, val)}
                      onCancel={() => setRenamingId(null)}
                    />
                  ) : (
                    <>
                      <p
                        className="text-xs font-medium truncate"
                        style={{
                          color: isActive
                            ? "var(--text-primary)"
                            : "var(--text-secondary)",
                        }}
                      >
                        {conv.title}
                      </p>
                      <p
                        className="text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {formatRelativeTime(conv.updated_at)}
                      </p>
                    </>
                  )}
                </div>

                {/* 3-dots menu button */}
                {!isRenaming && (
                  <div className="relative">
                    <button
                      ref={menuButtonRef}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(menuOpen ? null : conv.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all hover:cursor-pointer"
                      style={{
                        color: menuOpen
                          ? "var(--text-primary)"
                          : "var(--text-muted)",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.color = "var(--text-primary)")
                      }
                      onMouseLeave={(e) => {
                        if (!menuOpen)
                          e.currentTarget.style.color = "var(--text-muted)";
                      }}
                      title="More options"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>

                    {menuOpen && (
                      <ContextMenu
                        onDelete={() => onDelete(conv.id)}
                        onRename={() => setRenamingId(conv.id)}
                        onClose={() => setOpenMenuId(null)}
                        anchorRef={menuButtonRef}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
