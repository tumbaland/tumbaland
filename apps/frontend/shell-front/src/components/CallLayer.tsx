import { Component, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { logger } from '@tumbaland/frontend-core';
import { CHAT_APP, type RemoteApp } from '../config/apps';
import { remoteComponent } from '../remotes';

/** The module chat-front exposes for calls: the listener and the call screen. */
export const CHAT_CALLS_MODULE = './Calls';

/**
 * Made once, at module scope: `remoteComponent` only wraps the load in `lazy`,
 * and the config it needs is read when the load runs, not now.
 */
const Calls = remoteComponent(CHAT_APP as RemoteApp, CHAT_CALLS_MODULE);

/**
 * Silent where `RemoteBoundary` explains itself: this draws nothing until a
 * call rings, so failing to load it must not put a "could not load" card on
 * every page. Chat itself still works; only calls do not.
 */
class QuietBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('Calls failed to load', { error, componentStack: info.componentStack });
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Chat's calls, mounted once for the whole signed-in app rather than inside
 * chat's pages, so a call rings on any page and leaving the thread does not
 * hang up.
 */
export function CallLayer() {
  return (
    <QuietBoundary>
      <Suspense fallback={null}>
        <Calls />
      </Suspense>
    </QuietBoundary>
  );
}
