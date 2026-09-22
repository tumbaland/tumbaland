import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// The real package registers a custom element and opens an IndexedDB, neither
// of which belongs in a unit test. What matters here is that it is loaded
// lazily, that one download serves concurrent callers, and that its events are
// wired up.
vi.mock('emoji-picker-element', () => {
  if (!customElements.get('emoji-picker')) {
    customElements.define('emoji-picker', class extends HTMLElement {});
  }
  return {};
});

import { FullEmojiPicker, loadEmojiPicker, resetEmojiPickerLoader } from './FullEmojiPicker';

beforeEach(() => resetEmojiPickerLoader());
afterEach(() => vi.clearAllMocks());

describe('loadEmojiPicker', () => {
  it('registers the custom element', async () => {
    await loadEmojiPicker();

    expect(customElements.get('emoji-picker')).toBeDefined();
  });

  it('hands concurrent callers the same download rather than racing several', () => {
    // The promise is cached, not the result.
    expect(loadEmojiPicker()).toBe(loadEmojiPicker());
  });
});

describe('FullEmojiPicker', () => {
  it('renders nothing at all until it is opened', () => {
    // Its emoji database is far larger than the rest of the module; putting it
    // in the initial chunk would cost everyone who only reads messages.
    const { baseElement } = render(<FullEmojiPicker anchorEl={null} onClose={() => {}} onPick={() => {}} />);

    expect(baseElement.querySelector('emoji-picker')).toBeNull();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('renders the picker once loaded', async () => {
    const anchor = document.createElement('button');
    const { baseElement } = render(<FullEmojiPicker anchorEl={anchor} onClose={() => {}} onPick={() => {}} />);

    await waitFor(() => expect(baseElement.querySelector('emoji-picker')).toBeInTheDocument());
  });

  it('fills the picker again when it is reopened, with nothing else re-rendering', async () => {
    // The second open used to show an empty strip: the grid went in before the
    // popover's portal had attached the box meant to hold it.
    const anchor = document.createElement('button');
    const onClose = () => {};
    const onPick = () => {};
    const { baseElement, rerender } = render(<FullEmojiPicker anchorEl={anchor} onClose={onClose} onPick={onPick} />);
    await waitFor(() => expect(baseElement.querySelector('emoji-picker')).toBeInTheDocument());

    rerender(<FullEmojiPicker anchorEl={null} onClose={onClose} onPick={onPick} />);
    await waitFor(() => expect(baseElement.querySelector('emoji-picker')).toBeNull());

    rerender(<FullEmojiPicker anchorEl={anchor} onClose={onClose} onPick={onPick} />);
    await waitFor(() => expect(baseElement.querySelector('emoji-picker')).toBeInTheDocument());
  });

  it('shows a loader while the chunk is on its way', () => {
    const anchor = document.createElement('button');
    render(<FullEmojiPicker anchorEl={anchor} onClose={() => {}} onPick={() => {}} />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('reports a picked emoji and closes', async () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    const anchor = document.createElement('button');
    const { baseElement } = render(
      <FullEmojiPicker anchorEl={anchor} onClose={onClose} onPick={onPick} />
    );

    const element = await waitFor(() => {
      const found = baseElement.querySelector('emoji-picker');
      expect(found).toBeInTheDocument();
      return found!;
    });
    element.dispatchEvent(new CustomEvent('emoji-click', { detail: { unicode: '🎉' } }));

    expect(onPick).toHaveBeenCalledWith('🎉');
    expect(onClose).toHaveBeenCalled();
  });

  it('says so when the chunk cannot be fetched, rather than spinning forever', async () => {
    vi.resetModules();
    vi.doMock('emoji-picker-element', () => {
      throw new Error('Failed to fetch dynamically imported module');
    });
    const module = await import('./FullEmojiPicker');
    module.resetEmojiPickerLoader();

    const anchor = document.createElement('button');
    render(<module.FullEmojiPicker anchorEl={anchor} onClose={() => {}} onPick={() => {}} />);

    await waitFor(() => expect(screen.getByText(/could not load/)).toBeInTheDocument());
    vi.doUnmock('emoji-picker-element');
  });

  it('ignores an event carrying no emoji', async () => {
    const onPick = vi.fn();
    const anchor = document.createElement('button');
    const { baseElement } = render(<FullEmojiPicker anchorEl={anchor} onClose={() => {}} onPick={onPick} />);

    const element = await waitFor(() => {
      const found = baseElement.querySelector('emoji-picker');
      expect(found).toBeInTheDocument();
      return found!;
    });
    element.dispatchEvent(new CustomEvent('emoji-click', { detail: {} }));

    expect(onPick).not.toHaveBeenCalled();
  });
});
