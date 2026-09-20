import { Component, ErrorInfo, ReactNode } from 'react';
import { captureException } from '../../monitoring';
import { ErrorPage } from '../ErrorPage';

export interface AppErrorBoundaryProps {
  children: ReactNode;
  /** Reported to monitoring as the errored component/app (e.g. the app name) */
  component?: string;
  /** Fallback title shown to the user */
  title?: string;
  /** Fallback message shown to the user */
  message?: string;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches render-time errors anywhere below it in the tree, reports them via
 * captureException, and shows ErrorPage instead of an unhandled blank screen.
 * Retrying reloads the page rather than resetting local state, since a
 * subtree that just crashed is the least trustworthy place to re-render.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    void captureException(error, { componentStack: errorInfo.componentStack }, { component: this.props.component });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <ErrorPage
          title={this.props.title ?? 'Something went wrong'}
          message={this.props.message ?? 'An unexpected error occurred. Please try again.'}
        />
      );
    }
    return this.props.children;
  }
}
