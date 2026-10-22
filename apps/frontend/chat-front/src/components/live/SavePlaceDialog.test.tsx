import { describe, expect, it, vi } from 'vite-plus/test';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SavePlaceDialog } from './SavePlaceDialog';

describe('SavePlaceDialog', () => {
  it('saves under the name given, then closes', async () => {
    const onSave = vi.fn(async () => {});
    const onClose = vi.fn();
    render(<SavePlaceDialog open address="Viru 4, Tallinn" onClose={onClose} onSave={onSave} />);

    expect(screen.getByText('Viru 4, Tallinn')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Name'), '  Home ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith('Home');
    expect(onClose).toHaveBeenCalled();
  });

  it('stays open and says why when it could not save', async () => {
    const onClose = vi.fn();
    render(
      <SavePlaceDialog
        open
        address="Viru 4"
        onClose={onClose}
        onSave={() => Promise.reject(new Error('You can keep 50 places. Delete one first.'))}
      />
    );

    await userEvent.type(screen.getByLabelText('Name'), 'Gym');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('You can keep 50 places. Delete one first.')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
