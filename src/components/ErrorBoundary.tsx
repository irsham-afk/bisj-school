import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error) { console.error("Page error:", error); }
  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="max-w-md mx-auto mt-10 rounded-xl border border-line bg-white p-6 text-center">
          <h2 className="font-display text-xl mb-1">Something went wrong on this page</h2>
          <p className="text-sm text-muted mb-4">The rest of the app is fine — you can go back to the dashboard and try again.</p>
          <div className="flex gap-2 justify-center">
            <a href="/" className="px-4 py-2 rounded-lg bg-brand text-white text-sm">Go to dashboard</a>
            <button onClick={this.reset} className="px-4 py-2 rounded-lg border text-sm">Try again</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
