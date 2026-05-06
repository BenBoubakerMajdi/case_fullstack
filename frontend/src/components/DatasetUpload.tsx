/**
 * DatasetUpload — drag and drop CSV upload component.
 *
 * Allows users to add new datasets without touching the filesystem.
 * Uploads to POST /api/datasets/upload and calls onUploadSuccess
 * so the parent can refresh the dataset list.
 *
 * Design: subtle dashed border that highlights cyan on drag-over.
 */

import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DatasetUploadProps {
  /** Called after a successful upload with the new dataset metadata. */
  onUploadSuccess: (dataset: {
    name: string;
    rows: number;
    columns: string[];
  }) => void;
}

type UploadState = "idle" | "dragging" | "uploading" | "success" | "error";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DatasetUpload({ onUploadSuccess }: DatasetUploadProps) {
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Upload logic ──────────────────────────────────────────────────────────
  const uploadFile = async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      setErrorMessage("Only CSV files are supported.");
      setUploadState("error");
      toast.error("Only CSV files are supported.");
      return;
    }

    setUploadState("uploading");
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/datasets/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Upload failed.");
      }

      const data = await response.json();
      setUploadState("success");
      toast.success(
        `"${data.name}" uploaded — ${data.rows.toLocaleString()} rows`,
      );
      onUploadSuccess({
        name: data.name,
        rows: data.rows,
        columns: data.columns,
      });

      // Reset to idle after 2 seconds
      setTimeout(() => setUploadState("idle"), 2000);
    } catch (err) {
      const msg = (err as Error).message || "Upload failed.";
      setErrorMessage(msg);
      setUploadState("error");
      toast.error(msg);
      setTimeout(() => setUploadState("idle"), 3000);
    }
  };

  // ── Drag and drop handlers ─────────────────────────────────────────────
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setUploadState("dragging");
  };

  const handleDragLeave = () => {
    setUploadState("idle");
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  // ── Border color by state ─────────────────────────────────────────────
  const borderColor = {
    idle: "var(--border-color)",
    dragging: "var(--accent-cyan)",
    uploading: "var(--accent-cyan)",
    success: "var(--accent-emerald)",
    error: "#f87171",
  }[uploadState];

  return (
    <div
      className="rounded-lg border-2 border-dashed p-4 mx-4 mt-4 text-center cursor-pointer transition-all duration-200"
      style={{
        borderColor,
        backgroundColor:
          uploadState === "dragging"
            ? "rgba(0, 212, 255, 0.04)"
            : "transparent",
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => {
        if (uploadState === "error") {
          setUploadState("idle");
          setErrorMessage("");
        }
        if (uploadState === "idle" || uploadState === "error") {
          if (fileInputRef.current) {
            fileInputRef.current.value = ""; // Reset so same file can be re-selected
            fileInputRef.current.click();
          }
        }
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileChange}
        title="Upload CSV dataset"
        aria-label="Upload CSV dataset"
      />

      {/* Icon */}
      <div className="flex justify-center mb-2">
        {uploadState === "idle" || uploadState === "dragging" ? (
          <Upload
            className="w-5 h-5"
            style={{
              color:
                uploadState === "dragging"
                  ? "var(--accent-cyan)"
                  : "var(--text-muted)",
            }}
          />
        ) : uploadState === "uploading" ? (
          <Loader2
            className="w-5 h-5 animate-spin"
            style={{ color: "var(--accent-cyan)" }}
          />
        ) : uploadState === "success" ? (
          <CheckCircle
            className="w-5 h-5"
            style={{ color: "var(--accent-emerald)" }}
          />
        ) : (
          <AlertCircle className="w-5 h-5 text-red-400" />
        )}
      </div>

      {/* Label */}
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {uploadState === "idle" && "Drop CSV or click to upload"}
        {uploadState === "dragging" && (
          <span style={{ color: "var(--accent-cyan)" }}>Drop to upload</span>
        )}
        {uploadState === "uploading" && (
          <span style={{ color: "var(--accent-cyan)" }}>Uploading...</span>
        )}
        {uploadState === "success" && (
          <span style={{ color: "var(--accent-emerald)" }}>
            Upload successful
          </span>
        )}
        {uploadState === "error" && (
          <span className="text-red-400">{errorMessage}</span>
        )}
      </p>
    </div>
  );
}
