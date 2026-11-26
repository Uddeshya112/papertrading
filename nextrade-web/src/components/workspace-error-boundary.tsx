"use client";

import React from "react";

type Props = {
  viewName: string;
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  errorMessage: string;
};

export class WorkspaceErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message || "Unexpected rendering error occurred.",
    };
  }

  componentDidCatch(error: Error) {
    if (typeof console !== "undefined") {
      console.error(`[TradeGuru AI ErrorBoundary:${this.props.viewName}]`, error);
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.viewName !== this.props.viewName && this.state.hasError) {
      this.setState({ hasError: false, errorMessage: "" });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="surface-card" role="alert">
          <span className="card-kicker">WORKSPACE RECOVERY</span>
          <h2 style={{ margin: "6px 0 8px", fontFamily: "var(--display)" }}>
            {this.props.viewName} encountered a temporary error
          </h2>
          <p className="nt-muted-sm" style={{ marginBottom: 14 }}>
            Your virtual account, positions, and journal are safely preserved. Error details: {this.state.errorMessage}
          </p>
          <button
            type="button"
            className="primary-button"
            onClick={() => this.setState({ hasError: false, errorMessage: "" })}
          >
            Recover {this.props.viewName}
          </button>
        </section>
      );
    }
    return this.props.children;
  }
}
