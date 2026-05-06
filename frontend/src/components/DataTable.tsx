/**
 * DataTable — scrollable dark-themed table for tabular query results.
 */

import { Download } from "lucide-react";
import { useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DataTableProps {
  columns: string[];
  data: Record<string, unknown>[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCellValue(value: unknown): string {
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? String(value)
      : value.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  }
  return String(value ?? "");
}

/**
 * Convert columns + data to a CSV string and trigger a browser download.
 */
function downloadCSV(columns: string[], data: Record<string, unknown>[]) {
  // Header row
  const header = columns.join(",");

  // Data rows — wrap values in quotes to handle commas inside values
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const val = String(row[col] ?? "");
        // Escape quotes and wrap in quotes if value contains comma or newline
        const escaped = val.replace(/"/g, '""');
        return /[,\n"]/.test(val) ? `"${escaped}"` : escaped;
      })
      .join(","),
  );

  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  // Trigger download
  const link = document.createElement("a");
  link.href = url;
  link.download = "export.csv";
  link.click();

  // Clean up
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DataTable({ columns, data }: DataTableProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = () => {
    setIsDownloading(true);
    downloadCSV(columns, data);
    setTimeout(() => setIsDownloading(false), 1000);
  };

  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center h-24 rounded-lg border"
        style={{ borderColor: "var(--border-color)" }}
      >
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No data available.
        </p>
      </div>
    );
  }

  return (
    <div
      className="my-3 rounded-lg border"
      style={{
        borderColor: "var(--border-color)",
        maxWidth: "100%",
        overflow: "hidden",
      }}
    >
      {/* Scroll container */}
      <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "320px" }}>
        <table
          style={{
            borderCollapse: "collapse",
            whiteSpace: "nowrap",
            fontSize: "12px",
            width: "max-content",
            minWidth: "100%",
          }}
        >
          {/* Sticky header */}
          <thead
            style={{
              backgroundColor: "var(--bg-card)",
              position: "sticky",
              top: 0,
              zIndex: 1,
            }}
          >
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  style={{
                    padding: "8px 16px",
                    textAlign: "left",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    fontSize: "11px",
                    color: "var(--text-secondary)",
                    borderBottom: `1px solid var(--border-color)`,
                    whiteSpace: "nowrap",
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {data.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                style={{ borderBottom: `1px solid var(--border-color)` }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "var(--bg-card)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
              >
                {columns.map((col) => (
                  <td
                    key={col}
                    style={{
                      padding: "8px 16px",
                      color: "var(--text-primary)",
                      fontFamily: "monospace",
                      fontSize: "12px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatCellValue(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer — row count + export button */}
      <div
        className="flex items-center justify-between px-4 py-2 border-t"
        style={{
          borderColor: "var(--border-color)",
          backgroundColor: "var(--bg-card)",
        }}
      >
        <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          {data.length} rows
        </p>

        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all hover:cursor-pointer"
          style={{
            color: "var(--text-muted)",
            border: "1px solid var(--border-color)",
            backgroundColor: "transparent",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--accent-cyan)";
            e.currentTarget.style.borderColor = "var(--accent-cyan)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-muted)";
            e.currentTarget.style.borderColor = "var(--border-color)";
          }}
        >
          <Download className="w-3.5 h-3.5" />
          {isDownloading ? "Downloading..." : "Export CSV"}
        </button>
      </div>
    </div>
  );
}
