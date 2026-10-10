import { useEffect, useRef, useState } from 'react';
import { logger } from '@tumbaland/frontend-core';
import { ConfigProvider } from '../config/ConfigProvider';
import { CallScreen } from '../components/call/CallScreen';
import { useChatStream } from '../hooks/useChatStream';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { CallEngine, IDLE, type CallState } from '../services/callEngine';
import { onCallRequest } from '../services/callBus';
import { preferredMicrophone } from '../services/audioDevices';
import { chatApi, newClientId } from '../services/chatApi';
import { playTone } from '../services/ringtone';

/**
 * This tab, as far as calls are concerned. New per page load: a reloaded page
 * cannot pick up a call's connection anyway, so it should not pretend to be
 * the device that held it.
 */
const DEVICE_ID = newClientId();

/** Rings, and plays the ringback while calling out. */
function useCallSounds(state: CallState): void {
  const tone = state.phase === 'incoming' ? 'ring' : state.phase === 'outgoing' ? 'ringback' : null;
  useEffect(() => {
    if (!tone) return;
    return playTone(tone);
  }, [tone]);
}

/** Keeps the screen on during a call, and takes the lock back after the app returns from the background. */
function useWakeLock(on: boolean): void {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let released = false;

    const acquire = () => {
      if (document.visibilityState !== 'visible') return;
      navigator.wakeLock
        .request('screen')
        .then((sentinel) => {
          if (released) void sentinel.release();
          else lock = sentinel;
        })
        .catch(() => undefined);
    };
    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', acquire);
      void lock?.release().catch(() => undefined);
    };
  }, [on]);
}

/**
 * Takes the "Calling you" notification down once the call is answered,
 * declined or over, on this device. A phone that is locked keeps it until the
 * server's "Missed call" replaces it.
 */
function useCloseCallNotification(state: CallState): void {
  const ringingId = state.phase === 'incoming' ? state.call?.id : null;
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (ringingId) {
      last.current = ringingId;
      return;
    }
    const callId = last.current;
    last.current = null;
    if (!callId || !('serviceWorker' in navigator)) return;
    void navigator.serviceWorker
      .getRegistration()
      .then((registration) => registration?.getNotifications({ tag: `call-${callId}` }))
      .then((notifications) => notifications?.forEach((notification) => notification.close()))
      .catch(() => undefined);
  }, [ringingId]);
}

/**
 * Calls, for the whole app: listens for a call ringing, places calls when a
 * thread asks, and draws the call screen over whatever page is open.
 *
 * Mounted once, above the pages, so going from a thread to Album does not hang
 * up. Holds its own stream, which stays open with the screen off while a call
 * is on, since the call's signals and the server's "still there" check both
 * ride on it.
 */
export function CallLayer() {
  const { user } = useCurrentUser();
  const [state, setState] = useState<CallState>(IDLE);
  const engineRef = useRef<CallEngine | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const engine = new CallEngine({
      api: chatApi,
      deviceId: DEVICE_ID,
      userId: user.id,
      onChange: setState,
      preferredMicrophone
    });
    engineRef.current = engine;
    void engine.resume();

    const stopListening = onCallRequest(({ conversationId, peer }) => void engine.start(conversationId, peer));
    // Opened from a "Calling you" notification, the page may have been alive
    // in the background all along, with the ringing event long gone.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void engine.resume();
    };
    document.addEventListener('visibilitychange', onVisible);
    // Closing the tab mid-call hangs up instead of leaving the other side on
    // until the server notices. Not `dispose`: the page may only be going into
    // the back-forward cache and come back, and must still ring then.
    const onLeave = () => engine.leave();
    window.addEventListener('pagehide', onLeave);

    return () => {
      stopListening();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pagehide', onLeave);
      engine.dispose();
      engineRef.current = null;
      setState(IDLE);
    };
  }, [user?.id]);

  const inCall = state.phase !== 'idle' && state.phase !== 'ended';

  // Shrunk to a bar so the app stays usable while talking. Every new call
  // starts on the full screen.
  const [minimized, setMinimized] = useState(false);
  const callId = state.call?.id ?? null;
  useEffect(() => {
    if (!inCall) setMinimized(false);
  }, [inCall, callId]);

  useChatStream({
    enabled: Boolean(user?.id),
    // Lets the server tell whether this tab, the one on the call, is still here.
    deviceId: DEVICE_ID,
    keepOpenWhenHidden: inCall,
    onEvent: (event) => engineRef.current?.handleEvent(event),
    onResync: () => void engineRef.current?.resume(),
    onStateChange: (connection) => {
      if (inCall && connection === 'polling') logger.warn('Call stream fell back to polling; the call may not connect');
    }
  });

  useCallSounds(state);
  useWakeLock(state.phase === 'connecting' || state.phase === 'active');
  useCloseCallNotification(state);

  const engine = () => engineRef.current;
  return (
    <CallScreen
      state={state}
      onAccept={() => void engine()?.accept()}
      onDecline={() => engine()?.decline()}
      onHangUp={() => engine()?.hangUp()}
      onToggleMute={() => engine()?.toggleMute()}
      onSelectMicrophone={(deviceId) => void engine()?.switchMicrophone(deviceId)}
      onDismiss={() => engine()?.dismiss()}
      minimized={minimized}
      onMinimize={() => setMinimized(true)}
      onExpand={() => setMinimized(false)}
    />
  );
}

/** As the shell mounts it: with chat's own config, read from chat's origin. */
export default function CallHost() {
  return (
    <ConfigProvider>
      <CallLayer />
    </ConfigProvider>
  );
}
