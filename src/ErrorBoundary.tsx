import { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Zephyr React ErrorBoundary caught an error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: "100vh", width: "100vw", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", background: "#0d1117", color: "#e6edf3",
          fontFamily: "system-ui, sans-serif", padding: 24, gap: 16
        }}>
          <AlertCircle size={48} color="#f85149" />
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Something went wrong in Zephyr UI</h2>
          <pre style={{
            background: "#161b22", border: "1px solid #30363d", padding: "12px 16px",
            borderRadius: 6, fontSize: 12, maxWidth: 600, overflow: "auto", color: "#8b949e"
          }}>
            {this.state.error?.toString() || "Unknown UI Exception"}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "#38bdf8", color: "#0f172a", border: "none", padding: "8px 16px",
              borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex",
              alignItems: "center", gap: 8
            }}
          >
            <RefreshCw size={14} /> Reload Zephyr
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
