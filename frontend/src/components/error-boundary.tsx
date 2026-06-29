import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode; fallback?: ReactNode; inline?: boolean };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      if (this.props.inline) {
        return (
          <div style={{ padding: 8, color: "#a1a1a1", fontFamily: "monospace", fontSize: 11 }}>
            [render error: {this.state.error.message}]
          </div>
        );
      }
      return (
        <div style={{ padding: 20, color: "#f5f5f5", fontFamily: "monospace", fontSize: 13, whiteSpace: "pre-wrap" }}>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>Something went wrong</h2>
          <p>{this.state.error.message}</p>
          <details style={{ marginTop: 12, fontSize: 11, opacity: 0.7 }}>
            <summary>Stack</summary>
            <p style={{ marginTop: 4 }}>{this.state.error.stack}</p>
          </details>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ marginTop: 16, padding: "8px 16px", border: "1px solid #555", borderRadius: 6, background: "transparent", color: "#f5f5f5", cursor: "pointer" }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
