import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PhotoSearchBar from './PhotoSearchBar';

it('shows the current search term and placeholder', () => {
  render(<PhotoSearchBar searchTerm="sunset" onSearchChange={vi.fn()} />);
  expect(screen.getByPlaceholderText('Search photos...')).toHaveValue('sunset');
});

it('calls onSearchChange as the user types', async () => {
  const onSearchChange = vi.fn();
  render(<PhotoSearchBar searchTerm="" onSearchChange={onSearchChange} />);

  await userEvent.type(screen.getByPlaceholderText('Search photos...'), 'ab');

  expect(onSearchChange).toHaveBeenCalledTimes(2);
  expect(onSearchChange).toHaveBeenNthCalledWith(1, 'a');
  expect(onSearchChange).toHaveBeenNthCalledWith(2, 'b');
});
