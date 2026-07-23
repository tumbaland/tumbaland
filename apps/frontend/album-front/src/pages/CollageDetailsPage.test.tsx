import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';

const mockedNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
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
  default: (props: { onEditItem?: (id: string) => void; onDropPhoto?: (photoId: string, x: number, y: number) => void }) => (
    <div>
      collage stage
      <button onClick={() => props.onDropPhoto?.('photo-1', 10, 20)}>simulate drop photo-1</button>
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
