import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, vi } from 'vite-plus/test';
import CollageToolbar from './CollageToolbar';

function baseProps() {
  return {
    title: 'My collage',
    saveStatus: 'saved' as const,
    canUndo: false,
    canRedo: false,
    background: '#111111',
    frameColor: '#ffffff',
    frameEnabled: true,
    zoom: 1,
    onBack: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onAddText: vi.fn(),
    onAddSticker: vi.fn(),
    onAddShape: vi.fn(),
    onAddDate: vi.fn(),
    onBackgroundChange: vi.fn(),
    onFrameColorChange: vi.fn(),
    onFrameEnabledChange: vi.fn(),
    onZoomChange: vi.fn(),
    onExport: vi.fn(),
    onPreview: vi.fn()
  };
}

it('shows the title and that everything is saved, with no Save button', () => {
  render(<CollageToolbar {...baseProps()} />);

  expect(screen.getByText('My collage')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Saved');
  expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument();
});

it('says when a change is being saved', () => {
  render(<CollageToolbar {...baseProps()} saveStatus="saving" />);
  expect(screen.getByRole('status')).toHaveTextContent('Saving…');
});

it('says plainly when a save failed and is being retried', () => {
  render(<CollageToolbar {...baseProps()} saveStatus="retrying" />);
  expect(screen.getByRole('status')).toHaveTextContent('Not saved, retrying');
});

it('disables Undo/Redo based on canUndo/canRedo', () => {
  const { container, rerender } = render(<CollageToolbar {...baseProps()} canUndo={false} canRedo={false} />);

  expect(container.querySelector('[data-testid="UndoIcon"]')!.closest('button')).toBeDisabled();
  expect(container.querySelector('[data-testid="RedoIcon"]')!.closest('button')).toBeDisabled();

  rerender(<CollageToolbar {...baseProps()} canUndo canRedo />);

  expect(container.querySelector('[data-testid="UndoIcon"]')!.closest('button')).toBeEnabled();
  expect(container.querySelector('[data-testid="RedoIcon"]')!.closest('button')).toBeEnabled();
});

it('calls onBack, onUndo, onRedo, onAddText, onPreview and onExport', async () => {
  const props = baseProps();
  const { container } = render(<CollageToolbar {...props} canUndo canRedo />);

  await userEvent.click(screen.getByRole('button', { name: /back to collages/i }));
  expect(props.onBack).toHaveBeenCalledTimes(1);

  // Undo/Redo IconButtons are wrapped in a <span> for the Tooltip (MUI's
  // disabled-target pattern), so the aria-label lands on that span, not the
  // button itself — select via the icon's data-testid instead.
  await userEvent.click(container.querySelector('[data-testid="UndoIcon"]')!.closest('button')!);
  expect(props.onUndo).toHaveBeenCalledTimes(1);

  await userEvent.click(container.querySelector('[data-testid="RedoIcon"]')!.closest('button')!);
  expect(props.onRedo).toHaveBeenCalledTimes(1);

  await userEvent.click(screen.getByRole('button', { name: /add text/i }));
  expect(props.onAddText).toHaveBeenCalledTimes(1);

  await userEvent.click(screen.getByRole('button', { name: /^preview$/i }));
  expect(props.onPreview).toHaveBeenCalledTimes(1);

  await userEvent.click(screen.getByRole('button', { name: /download as png/i }));
  expect(props.onExport).toHaveBeenCalledTimes(1);
});

it('toggles frame-enabled via the frame icon button', async () => {
  const props = baseProps();
  render(<CollageToolbar {...props} frameEnabled />);

  await userEvent.click(screen.getByRole('button', { name: /photo frames: on/i }));

  expect(props.onFrameEnabledChange).toHaveBeenCalledWith(false);
});

it('changes the zoom level via the select', async () => {
  const props = baseProps();
  render(<CollageToolbar {...props} zoom={1} />);

  await userEvent.click(screen.getByRole('combobox'));
  await userEvent.click(await screen.findByRole('option', { name: '50%' }));

  expect(props.onZoomChange).toHaveBeenCalledWith(0.5);
});

it('changes the background and frame colors via the color swatches', () => {
  const props = baseProps();
  const { container } = render(<CollageToolbar {...props} />);

  const colorInputs = container.querySelectorAll('input[type="color"]');
  expect(colorInputs).toHaveLength(2);

  fireEvent.change(colorInputs[0], { target: { value: '#ff0000' } });
  fireEvent.change(colorInputs[1], { target: { value: '#00ff00' } });

  expect(props.onBackgroundChange).toHaveBeenCalledWith('#ff0000');
  expect(props.onFrameColorChange).toHaveBeenCalledWith('#00ff00');
});

it('has no actions for a selected item: those are on the canvas', () => {
  render(<CollageToolbar {...baseProps()} />);

  expect(screen.queryByRole('button', { name: /bring forward/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
});

describe('on a phone', () => {
  // Every `max-width` breakpoint matches, as on a narrow screen.
  beforeEach(() => {
    const narrow = window.matchMedia;
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) => ({ ...narrow(query), matches: query.includes('max-width') }) as MediaQueryList
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it('keeps the everyday actions on one row, big enough for a finger, and the rest in the menu', async () => {
    const props = baseProps();
    render(<CollageToolbar {...props} canUndo />);

    expect(screen.getByRole('status')).toHaveAccessibleName('Saved');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(props.onUndo).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Download as PNG' }));
    expect(props.onExport).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Photo frames: on' }));
    expect(props.onFrameEnabledChange).toHaveBeenCalledWith(false);
  });

  it('changes the background colour from the menu', async () => {
    const props = baseProps();
    render(<CollageToolbar {...props} />);

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.change(screen.getByLabelText('Background color'), { target: { value: '#ff0000' } });

    expect(props.onBackgroundChange).toHaveBeenCalledWith('#ff0000');
  });
});

describe('stickers, shapes, chat and video', () => {
  it('adds a sticker or a shape from the element menu', async () => {
    const props = baseProps();
    render(<CollageToolbar {...props} />);

    await userEvent.click(screen.getByRole('button', { name: 'Add sticker or shape' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add sticker 🎉' }));
    expect(props.onAddSticker).toHaveBeenCalledWith('🎉');

    await userEvent.click(screen.getByRole('button', { name: 'Add sticker or shape' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add heart' }));
    expect(props.onAddShape).toHaveBeenCalledWith('heart');
  });

  it('shows the chat toggle only when there is a chat to show', async () => {
    const onToggle = vi.fn();
    const { rerender } = render(<CollageToolbar {...baseProps()} />);
    expect(screen.queryByRole('button', { name: 'Show chat' })).not.toBeInTheDocument();

    rerender(<CollageToolbar {...baseProps()} chat={{ open: false, onToggle }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Show chat' }));
    expect(onToggle).toHaveBeenCalled();
  });

  it('offers a video download only when the collage moves', async () => {
    const onExportVideo = vi.fn();
    render(<CollageToolbar {...baseProps()} onExportVideo={onExportVideo} />);

    await userEvent.click(screen.getByRole('button', { name: 'Download' }));
    await userEvent.click(screen.getByRole('menuitem', { name: /Video/ }));

    expect(onExportVideo).toHaveBeenCalled();
  });
});
