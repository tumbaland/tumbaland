import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { vi } from 'vitest';

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

// exportCollage does real canvas work covered by its own dedicated test —
// stub it here so Export/Download stays a simple, deterministic call.
vi.mock('../components/collage/exportCollage', () => ({
  exportCollageToPng: vi.fn().mockResolvedValue(new Blob()),
  downloadBlob: vi.fn()
}));

import { useCollageDetails, useCollageMutations } from '../hooks/useCollage';
import { exportCollageToPng } from '../components/collage/exportCollage';
import CollageDetailsPage from './CollageDetailsPage';
import { Collage } from '../types/collage';

const mockedUseCollageDetails = useCollageDetails as unknown as ReturnType<typeof vi.fn>;
const mockedUseCollageMutations = useCollageMutations as unknown as ReturnType<typeof vi.fn>;
const mockedExportCollageToPng = exportCollageToPng as unknown as ReturnType<typeof vi.fn>;

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
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/collages/:id" element={<CollageDetailsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseCollageMutations.mockReturnValue(mutations);
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
  expect(mockedNavigate).toHaveBeenCalledWith('/collages');
});

it('renders the toolbar (edit mode) and the collage title, initializing the editor', () => {
  renderPage();

  expect(screen.getByText('Summer trip')).toBeInTheDocument();
  expect(screen.getByText('collage stage')).toBeInTheDocument();
  // Not yet dirty: Save starts disabled.
  expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
});

it('hides the toolbar and shows the mini action bar in view mode', () => {
  renderPage('/collages/collage-1?mode=view');

  expect(screen.queryByText('Summer trip')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /back to collages/i })).toBeInTheDocument();
});

it('saves via the toolbar, calling updateCollage and showing a success toast', async () => {
  mutations.updateCollage.mockResolvedValue(undefined);
  renderPage();

  // Dirty the doc via a keyboard shortcut so Save becomes enabled: Ctrl+Z is
  // a no-op with empty history, so use the toolbar's "Add text" instead.
  await userEvent.click(screen.getByRole('button', { name: /add text/i }));
  expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled();

  await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

  await waitFor(() =>
    expect(mutations.updateCollage).toHaveBeenCalledWith(
      'collage-1',
      expect.objectContaining({ title: 'Summer trip', albumIds: ['album-1'] })
    )
  );
  expect(await screen.findByText('Collage saved')).toBeInTheDocument();
});

it('shows an error toast when saving fails', async () => {
  mutations.updateCollage.mockRejectedValue(new Error('network down'));
  renderPage();

  await userEvent.click(screen.getByRole('button', { name: /add text/i }));
  await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

  expect(await screen.findByText('Failed to save collage')).toBeInTheDocument();
});

it('navigates back immediately when there are no unsaved changes', async () => {
  renderPage();

  await userEvent.click(screen.getByRole('button', { name: /back to collages/i }));

  expect(mockedNavigate).toHaveBeenCalledWith('/collages');
});

it('confirms before navigating back when there are unsaved changes', async () => {
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: /add text/i }));

  await userEvent.click(screen.getByRole('button', { name: /back to collages/i }));

  expect(confirmSpy).toHaveBeenCalled();
  expect(mockedNavigate).toHaveBeenCalledWith('/collages');
  confirmSpy.mockRestore();
});

it('stays on the page when the unsaved-changes confirmation is declined', async () => {
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: /add text/i }));

  await userEvent.click(screen.getByRole('button', { name: /back to collages/i }));

  expect(mockedNavigate).not.toHaveBeenCalled();
  confirmSpy.mockRestore();
});

it('undoes the last change via Ctrl+Z, clearing the dirty flag', async () => {
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: /add text/i }));
  expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled();

  await userEvent.keyboard('{Control>}z{/Control}');

  expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
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

  expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled();
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

  expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled();
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

it('dismisses the save-success toast', async () => {
  mutations.updateCollage.mockResolvedValue(undefined);
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: /add text/i }));
  await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
  expect(await screen.findByText('Collage saved')).toBeInTheDocument();

  const closeButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="CloseIcon"]'));
  await userEvent.click(closeButtons[closeButtons.length - 1]);

  await waitFor(() => expect(screen.queryByText('Collage saved')).not.toBeInTheDocument());
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

  await waitFor(() => expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled());
  vi.unstubAllGlobals();
});
