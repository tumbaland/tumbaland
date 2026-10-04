import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vite-plus/test';
import CreateAlbumDialog from './CreateAlbumDialog';

it('shows a validation error and does not create when the name is blank', async () => {
  const onCreate = vi.fn();
  render(<CreateAlbumDialog open onClose={vi.fn()} onCreate={onCreate} />);

  await userEvent.click(screen.getByRole('button', { name: /create album/i }));

  expect(screen.getByText('Album name is required')).toBeInTheDocument();
  expect(onCreate).not.toHaveBeenCalled();
});

it('creates an album with name, description, and groupId from tenantGroupId, then resets and closes', async () => {
  const onCreate = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(<CreateAlbumDialog open onClose={onClose} onCreate={onCreate} tenantGroupId="group-1" />);

  await userEvent.type(screen.getByLabelText('Album Name'), 'Trip');
  await userEvent.type(screen.getByLabelText(/description/i), 'Summer trip');
  await userEvent.click(screen.getByRole('button', { name: /create album/i }));

  expect(onCreate).toHaveBeenCalledWith({ name: 'Trip', description: 'Summer trip', tags: [], groupId: 'group-1' });
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('shows the personal-context message when there is no tenantGroupId', () => {
  render(<CreateAlbumDialog open onClose={vi.fn()} onCreate={vi.fn()} />);

  expect(screen.getByText(/personal context/i)).toBeInTheDocument();
});

it('shows the group-context message when there is a tenantGroupId', () => {
  render(<CreateAlbumDialog open onClose={vi.fn()} onCreate={vi.fn()} tenantGroupId="group-1" />);

  expect(screen.getByText(/selected group context/i)).toBeInTheDocument();
});

it('adds a tag on Enter, ignores blank input, dedupes, and removes via the chip delete icon', async () => {
  const onCreate = vi.fn().mockResolvedValue(undefined);
  render(<CreateAlbumDialog open onClose={vi.fn()} onCreate={onCreate} />);

  const tagInput = screen.getByLabelText(/tags/i);
  await userEvent.type(tagInput, 'summer{Enter}');
  await userEvent.type(tagInput, '   {Enter}'); // blank input is ignored
  await userEvent.type(tagInput, 'summer{Enter}'); // duplicate is ignored

  expect(screen.getAllByText('summer')).toHaveLength(1);

  await userEvent.type(screen.getByLabelText('Album Name'), 'Trip');
  await userEvent.click(screen.getByRole('button', { name: /create album/i }));

  expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ tags: ['summer'] }));
});

it('removes a tag when its chip delete icon is clicked', async () => {
  render(<CreateAlbumDialog open onClose={vi.fn()} onCreate={vi.fn()} />);

  await userEvent.type(screen.getByLabelText(/tags/i), 'summer{Enter}');
  expect(screen.getByText('summer')).toBeInTheDocument();

  await userEvent.click(screen.getByTestId('CancelIcon'));

  expect(screen.queryByText('summer')).not.toBeInTheDocument();
});

it('shows an error message when onCreate rejects', async () => {
  const onCreate = vi.fn().mockRejectedValue(new Error('name already taken'));
  render(<CreateAlbumDialog open onClose={vi.fn()} onCreate={onCreate} />);

  await userEvent.type(screen.getByLabelText('Album Name'), 'Trip');
  await userEvent.click(screen.getByRole('button', { name: /create album/i }));

  expect(await screen.findByText('name already taken')).toBeInTheDocument();
});

it('calls onClose without creating when Cancel is clicked', async () => {
  const onCreate = vi.fn();
  const onClose = vi.fn();
  render(<CreateAlbumDialog open onClose={onClose} onCreate={onCreate} />);

  await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

  expect(onCreate).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledTimes(1);
});
