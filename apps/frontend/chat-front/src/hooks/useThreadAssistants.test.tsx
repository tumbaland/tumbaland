import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { act, renderHook, waitFor } from '@testing-library/react';
import { assistantsView } from '../components/thread/assistantsFixtures';

const api = vi.hoisted(() => ({
  getAssistants: vi.fn(),
  changeAssistants: vi.fn(),
  createBot: vi.fn(),
  updateBot: vi.fn(),
  deleteBot: vi.fn(),
  setAllowanceCap: vi.fn()
}));
vi.mock('../services/chatApi', () => ({ chatApi: api }));

import { useThreadAssistants } from './useThreadAssistants';

const open = (id: string | undefined, current: string | undefined = id) => renderHook(({ conversation }) => useThreadAssistants(conversation, { current }), { initialProps: { conversation: id } });

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.getAssistants.mockResolvedValue(assistantsView());
});

describe('useThreadAssistants', () => {
  it('has nothing until it is asked, then holds what it was told', async () => {
    const { result } = open('c1');
    expect(result.current.assistants).toBeNull();

    act(() => result.current.refreshAssistants());
    await waitFor(() => expect(result.current.assistants).toEqual(assistantsView()));
    expect(api.getAssistants).toHaveBeenCalledWith('c1');
  });

  it('asks for nothing with no conversation open', () => {
    const { result } = open(undefined);
    act(() => result.current.refreshAssistants());
    expect(api.getAssistants).not.toHaveBeenCalled();
  });

  it('forgets another conversation’s assistants when the thread changes', async () => {
    const { result, rerender } = open('c1');
    act(() => result.current.refreshAssistants());
    await waitFor(() => expect(result.current.assistants).not.toBeNull());
    rerender({ conversation: 'c2' });
    await waitFor(() => expect(result.current.assistants).toBeNull());
  });

  it('throws away an answer that arrives after the thread was switched', async () => {
    let answer: (view: unknown) => void = () => {};
    api.getAssistants.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const { result } = open('c1', 'c2');
    act(() => result.current.refreshAssistants());
    await act(async () => answer(assistantsView()));
    expect(result.current.assistants).toBeNull();
  });

  it('manages without them when the request fails', async () => {
    api.getAssistants.mockRejectedValue(new Error('offline'));
    const { result } = open('c1');
    act(() => result.current.refreshAssistants());
    await waitFor(() => expect(api.getAssistants).toHaveBeenCalled());
    expect(result.current.assistants).toBeNull();
  });

  it('keeps what a change answers with, so the dialog needs no second request', async () => {
    const changed = assistantsView({ mine: false, enabled: false });
    api.changeAssistants.mockResolvedValue(changed);
    const { result } = open('c1');

    await act(async () => {
      await result.current.assistantActions.change({ enabled: false });
    });

    expect(api.changeAssistants).toHaveBeenCalledWith('c1', { enabled: false });
    expect(result.current.assistants).toEqual(changed);
    expect(api.getAssistants).not.toHaveBeenCalled();
  });

  it('does the same for adding, changing and removing an assistant', async () => {
    const { result } = open('c1');
    api.createBot.mockResolvedValue(assistantsView({ canAdd: false }));
    api.updateBot.mockResolvedValue(assistantsView({ aboutUs: 'updated' }));
    api.deleteBot.mockResolvedValue(assistantsView({ aboutUs: 'deleted' }));

    await act(async () => {
      await result.current.assistantActions.createBot({ name: 'Tumbi' });
    });
    expect(api.createBot).toHaveBeenCalledWith('c1', { name: 'Tumbi' });
    expect(result.current.assistants?.canAdd).toBe(false);

    await act(async () => {
      await result.current.assistantActions.updateBot('b1', { paused: true });
    });
    expect(api.updateBot).toHaveBeenCalledWith('c1', 'b1', { paused: true });
    expect(result.current.assistants?.aboutUs).toBe('updated');

    await act(async () => {
      await result.current.assistantActions.deleteBot('b1');
    });
    expect(api.deleteBot).toHaveBeenCalledWith('c1', 'b1');
    expect(result.current.assistants?.aboutUs).toBe('deleted');
  });

  it('lets a refusal through, for the dialog to show', async () => {
    api.changeAssistants.mockRejectedValue(Object.assign(new Error('Nothing to change'), { status: 400 }));
    const { result } = open('c1');
    await expect(result.current.assistantActions.change({})).rejects.toThrow('Nothing to change');
    expect(result.current.assistants).toBeNull();
  });

  it('sets a cap of your own, then asks again, because the view carries the allowance', async () => {
    api.setAllowanceCap.mockResolvedValue({});
    const { result } = open('c1');
    await act(async () => {
      await result.current.assistantActions.setCap(50);
    });
    expect(api.setAllowanceCap).toHaveBeenCalledWith(50);
    await waitFor(() => expect(api.getAssistants).toHaveBeenCalledTimes(1));
  });
});
