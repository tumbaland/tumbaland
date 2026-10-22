import { describe, expect, it, vi } from 'vite-plus/test';
import { onCallRequest, requestCall } from './callBus';

describe('callBus', () => {
  it('carries a call request from a thread to the call host, until the host stops listening', () => {
    const handler = vi.fn();
    const stop = onCallRequest(handler);

    requestCall({ conversationId: 'c1', peer: { userId: 'u-irja', name: 'Irja', picture: null } });
    stop();
    requestCall({ conversationId: 'c2' });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ conversationId: 'c1', peer: { userId: 'u-irja', name: 'Irja', picture: null } });
  });
});
