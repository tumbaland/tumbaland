import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CollageSelectionBar from './CollageSelectionBar';

const handlers = () => ({ onEdit: vi.fn(), onBringForward: vi.fn(), onSendBackward: vi.fn(), onDelete: vi.fn() });

describe('CollageSelectionBar', () => {
  it('labels every action, named for what is selected', async () => {
    const on = handlers();
    render(<CollageSelectionBar kind="photo" {...on} />);

    expect(screen.getByRole('toolbar', { name: 'Selected photo' })).toHaveTextContent(/Edit.*Forward.*Backward.*Delete/);
    await userEvent.click(screen.getByRole('button', { name: 'Edit photo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Bring forward' }));
    await userEvent.click(screen.getByRole('button', { name: 'Send backward' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete photo' }));

    expect(on.onEdit).toHaveBeenCalled();
    expect(on.onBringForward).toHaveBeenCalled();
    expect(on.onSendBackward).toHaveBeenCalled();
    expect(on.onDelete).toHaveBeenCalled();
  });

  it('keeps its own presses from reaching the canvas, which would clear the selection', () => {
    const canvasDown = vi.fn();
    render(
      <div onPointerDown={canvasDown}>
        <CollageSelectionBar kind="text" {...handlers()} />
      </div>
    );

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Edit text' }));

    expect(canvasDown).not.toHaveBeenCalled();
  });
});
