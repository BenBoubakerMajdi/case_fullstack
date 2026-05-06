import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "react-hot-toast";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          backgroundColor: "#1a2236",
          border: "1px solid #1e2d45",
          color: "#e8edf5",
          fontFamily: "Inter, sans-serif",
          fontSize: "13px",
        },
        success: {
          iconTheme: {
            primary: "#00e5a0",
            secondary: "#0f1117",
          },
        },
        error: {
          iconTheme: {
            primary: "#f87171",
            secondary: "#0f1117",
          },
        },
      }}
    />
  </StrictMode>,
);
