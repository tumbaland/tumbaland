import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, vi } from 'vitest';

const mockedNavigate = vi.fn();
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, useNavigate: () => mockedNavigate };
});

vi.mock('../hooks/useCollage', () => ({
  useCollageDetails: vi.fn(),
  useCollageMutations: vi.fn()
}));

// CollageStage is a Phase 7 target (the interactive drag/resize/rotate
// canvas) — stub it so this test stays scoped to CollageDetailsPage's own
// routing/save/keyboard-shortcut/mode-switching logic. The stub exposes a
// couple of plain buttons wired to the real onEditItem/onDropPhoto props, so
// this page's own callback-wiring can still be verified without the real
// interactive canvas.
vi.mock('../components/collage/CollageStage', () => ({
  default: (props: {
    onEditItem?: (id: string) => void;
    onDropPhoto?: (photoId: string, x: number, y: number) => void;
  }) => (
    <div>
      collage stage
      <button onClick={() => props.onDropPhoto?.('photo-1', 10, 20)}>simulate drop photo-1</button>
      <button onClick={() => props.onDropPhoto?.('photo-2', 10, 20)}>simulate drop photo-2</button>
    </div>
  )
}));

vi.mock('../services/collageService', () => ({
  collageService: { applyChanges: vi.fn(), setPresence: vi.fn(), getCollageById: vi.fn(), liveUrl: vi.fn() }
}));

// exportCollage does real canvas work covered by its own dedicated test —
// stub it here so Export/Download stays a simple, deterministic call.
vi.mock('../components/collage/exportCollage', () => ({
  exportCollageToPng: vi.fn().mockResolvedValue(new Blob()),
  downloadBlob: vi.fn()
}));

import { useCollageDetails, useCollageMutations } from '../hooks/useCollage';
import { exportCollageToPng } from '../components/collage/exportCollage';
import { collageService } from '../services/collageService';
import CollageDetailsPage from './CollageDetailsPage';
import { Collage } from '../types/collage';

const mockedUseCollageDetails = useCollageDetails as unknown as ReturnType<typeof vi.fn>;
const mockedUseCollageMutations = useCollageMutations as unknown as ReturnType<typeof vi.fn>;
const mockedExportCollageToPng = exportCollageToPng as unknown as ReturnType<typeof vi.fn>;
const mockedApplyChanges = collageService.applyChanges as unknown as ReturnType<typeof vi.fn>;

const collage: Collage = {
  _id: 'collage-1',
  title: 'Summer trip',
  config: {
    version: '2',
    date: '2024-01-01',
    viewport: { width: 1600, height: 900 },
    theme: 'default',
    photos: [],
    texts: [],
    backgroundColor: '#111111'
  },
  albumIds: ['album-1'],
  ownerId: 'user-1',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z'
};

const albumPhotos = [
  { _id: 'photo-1', filename: 'a.jpg', signedUrl: 'https://cdn.example/a.jpg', width: 800, height: 600 }
];

const mutations = { updateCollage: vi.fn(), createCollage: vi.fn(), deleteCollage: vi.fn() };

function renderPage(initialPath = '/collages/collage-1') {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/collages/:id" element={<CollageDetailsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseCollageMutations.mockReturnValue(mutations);
  mockedApplyChanges.mockResolvedValue({ revision: 1 });
  mockedUseCollageDetails.mockReturnValue({
    data: { collage, albumPhotos: [] },
    isPending: false,
    error: null
  });
});

it('shows a spinner while the collage is pending', () => {
  mockedUseCollageDetails.mockReturnValue({ data: undefined, isPending: true, error: null });

  renderPage();

  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

it('shows an error and a back button when the collage fails to load', async () => {
  mockedUseCollageDetails.mockReturnValue({ data: undefined, isPending: false, error: new Error('down') });

  renderPage();

  expect(screen.getByText('Failed to load collage')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button'));
  expect(mockedNavigate).toHaveBeenCalledWith('/album/collages');
});

it('renders the toolbar (edit mode) and the collage title, initializing the editor', () => {
  renderPage();

  expect(screen.getByText('Summer trip')).toBeInTheDocument();
  expect(screen.getByText('collage stage')).toBeInTheDocument();
  // Nothing to save yet, and no Save button to press.
  expect(screen.getByRole('status')).toHaveTextContent('Saved');
  expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument();
});

it('hides the toolbar and shows the mini action bar in view mode', () => {
  renderPage('/collages/collage-1?mode=view');

  expect(screen.queryByText('Summer trip')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /back to collages/i })).toBeInTheDocument();
});

it('saves a change by itself a moment after it is made, sending only what changed', async () => {
  renderPage();

  await userEvent.click(screen.getByRole('button', { name: /add text/i }));

  await waitFor(
    () =>
      expect(mockedApplyChanges).toHaveBeenCalledWith(
        'collage-1',
        [
          expect.objectContaining({
            type: 'put',
            layer: 'texts',
            item: expect.objectContaining({ text: 'Double-click to edit' })
          })
        ],
        expect.any(String)
      ),
    { timeout: 3000 }
  );
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved'));
  expect(mutations.updateCollage).not.toHaveBeenCalled();
});

it('says plainly when a save failed and keeps trying', async () => {
  mockedApplyChanges.mockRejectedValue(new Error('network down'));
  renderPage();

  await userEvent.click(screen.getByRole('button', { name: /add text/i }));

  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Not saved, retrying'), {
    timeout: 3000
  });
});

it('writes an older collage whole once, so every item gets an id to be saved by', async () => {
  mutations.updateCollage.mockResolvedValue(undefined);
  mockedUseCollageDetails.mockReturnValue({
    data: {
      collage: {
        ...collage,
        config: {
          ...collage.config,
          photos: [{ photoId: 'photo-1', position: { left: 5, top: 5 }, width: 10, height: 10 }]
        }
      },
      albumPhotos: []
    },
    isPending: false,
    error: null
  });

  renderPage();

  await waitFor(() =>
    expect(mutations.updateCollage).toHaveBeenCalledWith(
      'collage-1',
      expect.objectContaining({
        title: 'Summer trip',
        albumIds: ['album-1'],
        config: expect.objectContaining({
          photos: [expect.objectContaining({ id: expect.any(String), photoId: 'photo-1' })]
        })
      })
    )
  );
  expect(mockedApplyChanges).not.toHaveBeenCalled();
});

it('navigates back immediately when there are no unsaved changes', async () => {
  renderPage();

  await userEvent.click(screen.getByRole('button', { name: /back to collages/i }));

  expect(mockedNavigate).toHaveBeenCalledWith('/album/collages');
});

it('saves a waiting change before going back, without asking', async () => {
  const confirmSpy = vi.spyOn(window, 'confirm');
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: /add text/i }));

  await userEvent.click(screen.getByRole('button', { name: /back to collages/i }));

  await waitFor(() => expect(mockedNavigate).toHaveBeenCalledWith('/album/collages'));
  expect(mockedApplyChanges).toHaveBeenCalled();
  expect(confirmSpy).not.toHaveBeenCalled();
  confirmSpy.mockRestore();
});

it('asks before going back when the last change could not be saved', async () => {
  mockedApplyChanges.mockRejectedValue(new Error('network down'));
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: /add text/i }));

  await userEvent.click(screen.getByRole('button', { name: /back to collages/i }));

  await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
  expect(mockedNavigate).not.toHaveBeenCalled();
  confirmSpy.mockRestore();
});

it('undoes the last change via Ctrl+Z', async () => {
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: /add text/i }));
  // Adding the text selected it, which shows the selection actions.
  expect(screen.getByRole('button', { name: /edit item/i })).toBeInTheDocument();

  await userEvent.keyboard('{Control>}z{/Control}');

  expect(screen.queryByRole('button', { name: /edit item/i })).not.toBeInTheDocument();
});

it('exports the collage as PNG via the toolbar', async () => {
  renderPage();

  await userEvent.click(screen.getByRole('button', { name: /download as png/i }));

  await waitFor(() => expect(mockedExportCollageToPng).toHaveBeenCalled());
});

it('places a dropped photo, selecting it and revealing the selection-only toolbar actions', async () => {
  mockedUseCollageDetails.mockReturnValue({
    data: { collage, albumPhotos },
    isPending: false,
    error: null
  });
  renderPage();

  await userEvent.click(screen.getByText('simulate drop photo-1'));

  expect(screen.getByRole('status')).toHaveTextContent('Saving…');
  expect(screen.getByRole('button', { name: /edit item/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /bring forward/i })).toBeInTheDocument();
});

it('opens the photo settings dialog via "Edit item" once a dropped photo is selected', async () => {
  mockedUseCollageDetails.mockReturnValue({
    data: { collage, albumPhotos },
    isPending: false,
    error: null
  });
  renderPage();
  await userEvent.click(screen.getByText('simulate drop photo-1'));

  await userEvent.click(screen.getByRole('button', { name: /edit item/i }));

  expect(screen.getByText('Photo settings')).toBeInTheDocument();
});

it('removes the selected item via "Delete item", hiding the selection-only actions again', async () => {
  mockedUseCollageDetails.mockReturnValue({
    data: { collage, albumPhotos },
    isPending: false,
    error: null
  });
  renderPage();
  await userEvent.click(screen.getByText('simulate drop photo-1'));
  expect(screen.getByRole('button', { name: /edit item/i })).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: /delete item/i }));

  expect(screen.queryByRole('button', { name: /edit item/i })).not.toBeInTheDocument();
});

it('switches to preview (view) mode via the toolbar', async () => {
  renderPage();

  await userEvent.click(screen.getByRole('button', { name: /^preview$/i }));

  expect(screen.queryByText('Summer trip')).not.toBeInTheDocument();
});

it('switches back to edit mode from the view-mode mini action bar', async () => {
  renderPage('/collages/collage-1?mode=view');

  await userEvent.click(screen.getByRole('button', { name: /edit collage/i }));

  expect(screen.getByText('Summer trip')).toBeInTheDocument();
});

it('exports the collage as PNG from the view-mode mini action bar', async () => {
  renderPage('/collages/collage-1?mode=view');

  await userEvent.click(screen.getByRole('button', { name: /download as png/i }));

  await waitFor(() => expect(mockedExportCollageToPng).toHaveBeenCalled());
});

it('reorders the selected item via Bring forward / Send backward', async () => {
  mockedUseCollageDetails.mockReturnValue({
    data: { collage, albumPhotos },
    isPending: false,
    error: null
  });
  renderPage();
  await userEvent.click(screen.getByText('simulate drop photo-1'));

  await userEvent.click(screen.getByRole('button', { name: /bring forward/i }));
  await userEvent.click(screen.getByRole('button', { name: /send backward/i }));

  // Reordering a single item is a no-op on doc contents, but exercising the
  // handlers shouldn't throw or clear the selection.
  expect(screen.getByRole('button', { name: /edit item/i })).toBeInTheDocument();
});

it('changes background color, frame color, and toggles photo frames via the toolbar', async () => {
  renderPage();

  const colorInputs = document.querySelectorAll('input[type="color"]');
  const { fireEvent } = await import('@testing-library/react');
  fireEvent.change(colorInputs[0], { target: { value: '#222222' } });
  fireEvent.change(colorInputs[1], { target: { value: '#333333' } });
  await userEvent.click(screen.getByRole('button', { name: /photo frames/i }));

  // The three edits land within one quiet period, so they go as one save.
  await waitFor(
    () =>
      expect(mockedApplyChanges).toHaveBeenCalledWith(
        'collage-1',
        [
          {
            type: 'settings',
            values: { backgroundColor: '#222222', borderColor: '#333333', photoTransparencyMode: false }
          }
        ],
        expect.any(String)
      ),
    { timeout: 3000 }
  );
});

it('edits a text item via "Edit item", saving the new text and closing the dialog', async () => {
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: /add text/i }));

  await userEvent.click(screen.getByRole('button', { name: /edit item/i }));
  expect(screen.getByText('Edit text')).toBeInTheDocument();

  const textInput = screen.getByLabelText('Text');
  await userEvent.clear(textInput);
  await userEvent.type(textInput, 'Hello world');
  await userEvent.click(screen.getByRole('button', { name: /^apply$/i }));

  await waitFor(() => expect(screen.queryByText('Edit text')).not.toBeInTheDocument());
});

it('deletes a text item from within its edit dialog', async () => {
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: /add text/i }));
  await userEvent.click(screen.getByRole('button', { name: /edit item/i }));

  await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));

  await waitFor(() => expect(screen.queryByText('Edit text')).not.toBeInTheDocument());
  expect(screen.queryByRole('button', { name: /edit item/i })).not.toBeInTheDocument();
});

it('cancels out of a text item edit dialog without saving', async () => {
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: /add text/i }));
  await userEvent.click(screen.getByRole('button', { name: /edit item/i }));

  await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

  await waitFor(() => expect(screen.queryByText('Edit text')).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: /edit item/i })).toBeInTheDocument();
});

it('saves photo settings via "Apply" in the photo settings dialog', async () => {
  mockedUseCollageDetails.mockReturnValue({
    data: { collage, albumPhotos },
    isPending: false,
    error: null
  });
  renderPage();
  await userEvent.click(screen.getByText('simulate drop photo-1'));
  await userEvent.click(screen.getByRole('button', { name: /edit item/i }));

  await userEvent.type(screen.getByLabelText('Caption'), 'Beach day');
  await userEvent.click(screen.getByRole('button', { name: /^apply$/i }));

  await waitFor(() => expect(screen.queryByText('Photo settings')).not.toBeInTheDocument());
});

it('removes a photo from the collage via "Remove from collage" in the photo settings dialog', async () => {
  mockedUseCollageDetails.mockReturnValue({
    data: { collage, albumPhotos },
    isPending: false,
    error: null
  });
  renderPage();
  await userEvent.click(screen.getByText('simulate drop photo-1'));
  await userEvent.click(screen.getByRole('button', { name: /edit item/i }));

  await userEvent.click(screen.getByRole('button', { name: /remove from collage/i }));

  await waitFor(() => expect(screen.queryByText('Photo settings')).not.toBeInTheDocument());
  expect(screen.queryByRole('button', { name: /edit item/i })).not.toBeInTheDocument();
});

it('warns before closing the tab when there are unsaved changes', async () => {
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: /add text/i }));

  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);

  expect(event.defaultPrevented).toBe(true);
});

it('places a photo with no stored dimensions by reading them from the loaded image', async () => {
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = 400;
    naturalHeight = 300;
    private _src = '';
    set src(value: string) {
      this._src = value;
      queueMicrotask(() => this.onload?.());
    }
    get src() {
      return this._src;
    }
  }
  vi.stubGlobal('Image', FakeImage as unknown as typeof Image);

  mockedUseCollageDetails.mockReturnValue({
    data: {
      collage,
      albumPhotos: [{ _id: 'photo-2', filename: 'b.jpg', signedUrl: 'https://cdn.example/b.jpg' }]
    },
    isPending: false,
    error: null
  });
  renderPage();

  await userEvent.click(screen.getByText('simulate drop photo-2'));

  await waitFor(
    () =>
      expect(mockedApplyChanges).toHaveBeenCalledWith(
        'collage-1',
        [
          expect.objectContaining({
            type: 'put',
            layer: 'photos',
            item: expect.objectContaining({ photoId: 'photo-2' })
          })
        ],
        expect.any(String)
      ),
    { timeout: 3000 }
  );
  vi.unstubAllGlobals();
});

describe('with someone else in the collage', () => {
  /** Just enough EventSource to speak to the page through. */
  class FakeEventSource {
    static latest: FakeEventSource | null = null;
    listeners = new Map<string, ((event: MessageEvent) => void)[]>();
    onerror: (() => void) | null = null;
    constructor() {
      FakeEventSource.latest = this;
    }
    addEventListener(type: string, listener: (event: MessageEvent) => void) {
      this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
    }
    close() {}
    emit(type: string, data: unknown) {
      for (const listener of this.listeners.get(type) ?? []) listener({ data: JSON.stringify(data) } as MessageEvent);
    }
  }

  beforeEach(() => vi.stubGlobal('EventSource', FakeEventSource));
  afterEach(() => vi.unstubAllGlobals());

  it('shows their face, not yours, and tells them what you selected', async () => {
    const mockedSetPresence = collageService.setPresence as unknown as ReturnType<typeof vi.fn>;
    mockedSetPresence.mockResolvedValue(undefined);
    renderPage();
    const stream = FakeEventSource.latest!;

    await act(async () => stream.emit('ready', { heartbeatMs: 25_000, revision: 0 }));
    await waitFor(() => expect(mockedSetPresence).toHaveBeenCalledWith('collage-1', expect.any(String), null));
    const session = mockedSetPresence.mock.calls.at(-1)![1] as string;

    await act(async () =>
      stream.emit('presence', {
        viewers: [
          { session, userId: 'user-1', name: 'Tom', picture: null, selection: null },
          { session: 'other-tab', userId: 'user-2', name: 'Irja', picture: null, selection: null }
        ]
      })
    );

    expect(screen.getByLabelText('Irja is here')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Tom is here/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /add text/i }));
    await waitFor(() => expect(mockedSetPresence).toHaveBeenLastCalledWith('collage-1', session, expect.any(String)));
  });
});
