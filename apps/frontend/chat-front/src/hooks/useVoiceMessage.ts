import { useCallback, useEffect, useState } from 'react';
import { useVoiceRecorder, type UseVoiceRecorderResult, type VoiceRecording } from './useVoiceRecorder';

/** Uploads and sends a finished recording. Rejects when the upload failed. */
export type SendVoice = (recording: VoiceRecording, onProgress: (percent: number) => void) => Promise<void>;

/**
 * A finished recording that has not gone: its send failed, or the microphone
 * was taken away mid-sentence. Kept so it can be sent rather than said twice,
 * or thrown away.
 */
export interface HeldVoice {
  recording: VoiceRecording;
  reason: 'failed' | 'interrupted';
}

export interface VoiceMessage extends Pick<
  UseVoiceRecorderResult,
  'supported' | 'state' | 'elapsedMs' | 'levels' | 'error'
> {
  held: HeldVoice | null;
  /** Upload progress while sending, 0 to 100; null when nothing is sending. */
  progress: number | null;
  /** Recording, sending, or holding one: the composer's row belongs to it. */
  active: boolean;
  start: () => Promise<void>;
  /** Send: stops a recording and sends it, or retries a held one. */
  finish: () => Promise<void>;
  /** Throws away whatever is recording or held. */
  discard: () => void;
}

/**
 * One voice message from the first tap to sent.
 *
 * It lives with the thread rather than the composer because the mic is on the
 * thread's header while the recording shows in the composer. Both read this.
 *
 * Opening another conversation drops a recording in progress: it was meant for
 * the one it was started in.
 */
export function useVoiceMessage(conversationId: string | undefined, send: SendVoice): VoiceMessage {
  const [held, setHeld] = useState<HeldVoice | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const deliver = async (recording: VoiceRecording) => {
    setProgress(0);
    try {
      await send(recording, setProgress);
      setHeld(null);
    } catch {
      setHeld({ recording, reason: 'failed' });
    } finally {
      setProgress(null);
    }
  };

  // Reaching the time limit sends what was said, the same as pressing Send. A
  // microphone taken away is not the person deciding they were done, so that
  // recording waits for them.
  const recorder = useVoiceRecorder((recording, reason) => {
    if (reason === 'limit') void deliver(recording);
    else setHeld({ recording, reason });
  });

  const { cancel } = recorder;
  const discard = useCallback(() => {
    cancel();
    setHeld(null);
  }, [cancel]);

  useEffect(() => discard, [conversationId, discard]);

  const finish = async () => {
    if (held) return deliver(held.recording);
    const recording = await recorder.stop();
    if (recording) await deliver(recording);
  };

  return {
    supported: recorder.supported,
    state: recorder.state,
    elapsedMs: recorder.elapsedMs,
    levels: recorder.levels,
    error: recorder.error,
    held,
    progress,
    active: recorder.state !== 'idle' || progress !== null || held !== null,
    start: recorder.start,
    finish,
    discard
  };
}
