import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { logger } from '@tumbaland/frontend-core';
import { ink } from '@tumbaland/frontend-core';

interface RemoteBoundaryProps {
  children: ReactNode;
  /** The module's name, for the message a reader sees. */
  appTitle: string;
  onRetry: () => void;
}

interface RemoteBoundaryState {
  failed: boolean;
}

/**
 * Catches a module that fails to load, so one unreachable app does not take the
 * shell down with it.
 *
 * With the iframe this was free: a frame that failed to load broke only itself,
 * and the navigation around it stayed up. A federated remote runs in the
 * shell's own React tree, so without this boundary a network failure loading
 * Album would blank the whole page — navigation included, leaving no way out.
 */
export class RemoteBoundary extends Component<RemoteBoundaryProps, RemoteBoundaryState> {
  state: RemoteBoundaryState = { failed: false };

  static getDerivedStateFromError(): RemoteBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('Module failed to load', { error, componentStack: info.componentStack });
  }

  handleRetry = (): void => {
    this.setState({ failed: false });
    this.props.onRetry();
  };

  render(): ReactNode {
    if (!this.state.failed) {
      return this.props.children;
    }

    return (
      <Box sx={{ py: 8, px: 3, textAlign: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: ink.strong }}>
          {this.props.appTitle} would not load
        </Typography>
        <Typography variant="body2" sx={{ color: ink.muted, mt: 1, mb: 3 }}>
          It may be updating, or your connection dropped. The rest of Tumbaland still works.
        </Typography>
        <Button variant="contained" onClick={this.handleRetry}>
          Try again
        </Button>
      </Box>
    );
  }
}

export default RemoteBoundary;
