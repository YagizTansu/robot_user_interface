import { Component, type ErrorInfo, type ReactNode } from 'react';
import '../styles/ErrorBoundary.css';

interface Props {
  children: ReactNode;
  label?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Unknown error' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.label ?? 'page'}]`, error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary" role="alert">
          <h2 className="error-boundary-title">
            {this.props.label ? `${this.props.label} failed to load` : 'Something went wrong'}
          </h2>
          <p className="error-boundary-message">{this.state.message}</p>
          <button type="button" className="error-boundary-retry" onClick={this.handleRetry}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
