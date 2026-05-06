/**
 * PlotlyChart — renders an interactive Plotly figure from JSON data.
 *
 * Why CDN instead of npm package:
 *   The plotly.js npm package references Node.js globals (like `global`)
 *   that are not available in Vite's browser build environment, causing
 *   build errors. Loading Plotly from CDN via window.Plotly sidesteps
 *   this entirely. The CDN script is included in index.html.
 *
 * Rendering approach:
 *   Uses Plotly.newPlot() on mount and Plotly.purge() on unmount to
 *   avoid memory leaks. The layout is overridden with dark theme colors
 *   to match the app's design system regardless of what the agent produces.
 *
 * Data flow:
 *   visualize_web (Python) → fig.to_json() → SSE PLOTLY_JSON event
 *   → _parse_tool_result() → plotly_data prop → Plotly.newPlot()
 */

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Minimal type declaration for the Plotly global loaded from CDN.
 * Full types available via @types/plotly.js if needed in the future.
 */
declare const Plotly: {
  newPlot: (
    div: HTMLDivElement,
    data: unknown[],
    layout: unknown,
    config?: unknown,
  ) => void;
  /** Removes the chart and frees all associated memory. */
  purge: (div: HTMLDivElement) => void;
};

interface PlotlyChartProps {
  /**
   * Plotly figure as a parsed JSON object from fig.to_json().
   * Expected shape: { data: [...], layout: {...} }
   */
  plotlyData: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Dark theme layout overrides applied to every chart.
 * These ensure consistent styling regardless of the template
 * the agent uses (plotly_white, plotly_dark, etc.).
 */
const DARK_LAYOUT_OVERRIDES = {
  autosize: true,
  paper_bgcolor: "#161b27",
  plot_bgcolor: "#0f1117",
  font: { family: "Inter, sans-serif", size: 12, color: "#8899aa" },
  margin: { l: 60, r: 30, t: 60, b: 60 },
  xaxis: { gridcolor: "#1e2d45", zerolinecolor: "#1e2d45" },
  yaxis: { gridcolor: "#1e2d45", zerolinecolor: "#1e2d45" },
};

/** Plotly toolbar config — removes unused tools, hides Plotly branding. */
const PLOTLY_CONFIG = {
  responsive: true,
  displaylogo: false,
  modeBarButtonsToRemove: ["lasso2d", "select2d"],
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlotlyChart({ plotlyData }: PlotlyChartProps) {
  /** Ref to the DOM node where Plotly mounts the chart. */
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!divRef.current || !plotlyData || typeof Plotly === "undefined") return;

    const data = (plotlyData.data as unknown[]) || [];

    // Merge agent-provided layout with dark theme overrides.
    // Overrides take precedence to ensure consistent dark styling.
    const layout = {
      ...(plotlyData.layout as object),
      ...DARK_LAYOUT_OVERRIDES,
    };

    Plotly.newPlot(divRef.current, data, layout, PLOTLY_CONFIG);

    // Purge on unmount to prevent memory leaks from detached DOM nodes
    return () => {
      if (divRef.current) Plotly.purge(divRef.current);
    };
  }, [plotlyData]);

  // Empty state — shown if plotlyData is null/undefined
  if (!plotlyData) {
    return (
      <div className="flex items-center justify-center h-48 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-400">No chart data available.</p>
      </div>
    );
  }

  return (
    <div
      className="my-3 rounded-lg border overflow-hidden"
      style={{
        borderColor: "var(--border-color)",
        backgroundColor: "var(--bg-secondary)",
      }}
    >
      <div
        ref={divRef}
        style={{
          width: "100%",
          minHeight: "380px",
          backgroundColor: "var(--bg-secondary)",
        }}
      />
    </div>
  );
}
