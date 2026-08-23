import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import TagPhotosDialog from './TagPhotosDialog';
import { makePhoto } from '../test/fixtures';

const photo = (id: string, tags: string[]) => makePhoto({ _id: id, tags });

it('prefills the field with a single photo\'s tags', () => {
  render(
    <TagPhotosDialog
      open
      photos={[photo('p1', ['beach', 'sunset'])]}
      suggestions={[]}
      onClose={vi.fn()}
      onApply={vi.fn()}
    />
  );

  expect(screen.getByText('beach')).toBeInTheDocument();
  expect(screen.getByText('sunset')).toBeInTheDocument();
});

it('sends only the added tag, not the untouched ones', async () => {
  const onApply = vi.fn().mockResolvedValue(undefined);
  render(
    <TagPhotosDialog open photos={[photo('p1', ['beach'])]} suggestions={[]} onClose={vi.fn()} onApply={onApply} />
  );

  await userEvent.type(screen.getByRole('combobox'), 'sunset{Enter}');
  await userEvent.click(screen.getByRole('button', { name: /save tags/i }));

  await waitFor(() =>
    expect(onApply).toHaveBeenCalledWith(['p1'], { add: ['sunset'], remove: [] })
  );
});

it('sends a removal when a prefilled tag is deleted', async () => {
  const onApply = vi.fn().mockResolvedValue(undefined);
  render(
    <TagPhotosDialog
      open
      photos={[photo('p1', ['beach', 'sunset'])]}
      suggestions={[]}
      onClose={vi.fn()}
      onApply={onApply}
    />
  );

  // Backspace in the empty input removes the last chip.
  await userEvent.type(screen.getByRole('combobox'), '{Backspace}');
  await userEvent.click(screen.getByRole('button', { name: /save tags/i }));

  await waitFor(() => expect(onApply).toHaveBeenCalledWith(['p1'], { add: [], remove: ['sunset'] }));
});

it('titles itself for the whole selection and prefills only the shared tags', () => {
  render(
    <TagPhotosDialog
      open
      photos={[photo('p1', ['beach', 'sunset']), photo('p2', ['beach'])]}
      suggestions={[]}
      onClose={vi.fn()}
      onApply={vi.fn()}
    />
  );

  expect(screen.getByText('Tag 2 photos')).toBeInTheDocument();
  // 'beach' is on both photos, so it is editable; 'sunset' is listed as partial.
  expect(screen.getByText('beach')).toBeInTheDocument();
  expect(screen.getByText('sunset (1/2)')).toBeInTheDocument();
});

it('cycles a partial tag through add and remove', async () => {
  const onApply = vi.fn().mockResolvedValue(undefined);
  render(
    <TagPhotosDialog
      open
      photos={[photo('p1', ['sunset']), photo('p2', [])]}
      suggestions={[]}
      onClose={vi.fn()}
      onApply={onApply}
    />
  );

  const chip = screen.getByText('sunset (1/2)');

  await userEvent.click(chip); // keep -> add
  await userEvent.click(screen.getByRole('button', { name: /save tags/i }));
  await waitFor(() =>
    expect(onApply).toHaveBeenCalledWith(['p1', 'p2'], { add: ['sunset'], remove: [] })
  );
});

it('keeps Save disabled until something actually changes', async () => {
  render(
    <TagPhotosDialog open photos={[photo('p1', ['beach'])]} suggestions={[]} onClose={vi.fn()} onApply={vi.fn()} />
  );

  expect(screen.getByRole('button', { name: /save tags/i })).toBeDisabled();

  await userEvent.type(screen.getByRole('combobox'), 'new{Enter}');

  expect(screen.getByRole('button', { name: /save tags/i })).toBeEnabled();
});

it('stays open when applying fails', async () => {
  const onApply = vi.fn().mockRejectedValue(new Error('nope'));
  const onClose = vi.fn();
  render(
    <TagPhotosDialog open photos={[photo('p1', [])]} suggestions={[]} onClose={onClose} onApply={onApply} />
  );

  await userEvent.type(screen.getByRole('combobox'), 'beach{Enter}');
  await userEvent.click(screen.getByRole('button', { name: /save tags/i }));

  await waitFor(() => expect(onApply).toHaveBeenCalled());
  expect(onClose).not.toHaveBeenCalled();
});
