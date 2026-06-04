import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = {
    error: null
  };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Erreur front Grimoire", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app-shell">
          <p className="feedback feedback--error">
            Une erreur d'affichage est survenue. Recharge la page pour relancer l'interface.
          </p>
          <button type="button" onClick={() => window.location.reload()}>
            Recharger
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
