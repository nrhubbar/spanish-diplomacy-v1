import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  readonly children: ReactNode;
  readonly onError: (message: string) => void;
  readonly onReset: () => void;
}

interface ErrorBoundaryState {
  readonly failed: boolean;
}

/** Catches render errors, reports them to the notification shelf, and offers a way home. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError(`Something went wrong: ${error.message}`);
    console.error(error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="screen card-screen" aria-labelledby="error-title">
        <p className="screen-kicker">Unexpected error</p>
        <h1 id="error-title">This screen could not be shown</h1>
        <p className="screen-copy">The details are in the notification shelf. Returning home starts over.</p>
        <button
          onClick={() => {
            this.setState({ failed: false });
            this.props.onReset();
          }}
          type="button"
        >
          Return home
        </button>
      </main>
    );
  }
}
