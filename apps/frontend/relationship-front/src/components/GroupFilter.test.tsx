import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('../services/groupService', () => ({
  getUserGroups: vi.fn()
}));

import { getUserGroups } from '../services/groupService';
import GroupFilter from './GroupFilter';

const mockedGetUserGroups = getUserGroups as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

it('shows a loading state while groups are fetched', () => {
  mockedGetUserGroups.mockReturnValue(new Promise(() => {}));
  render(<GroupFilter onChange={vi.fn()} />);
  expect(screen.getByText(/loading filters/i)).toBeInTheDocument();
});

it('shows an error alert when the fetch fails', async () => {
  mockedGetUserGroups.mockRejectedValue(new Error('boom'));
  render(<GroupFilter onChange={vi.fn()} />);
  expect(await screen.findByText(/unable to load group filters/i)).toBeInTheDocument();
});

it('renders All/Personal/group options with member counts when enabled', async () => {
  mockedGetUserGroups.mockResolvedValue([{ _id: 'g1', name: 'Family', isOwner: true, memberCount: 3 }]);
  const onChange = vi.fn();
  render(<GroupFilter value="all" onChange={onChange} showCounts />);

  await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());
  await userEvent.click(screen.getByRole('combobox'));

  expect((await screen.findAllByText('All Activities')).length).toBeGreaterThan(0);
  expect(screen.getByText('My Activities')).toBeInTheDocument();
  expect(screen.getByText('Family')).toBeInTheDocument();
  expect(screen.getByText('Owner')).toBeInTheDocument();
  expect(screen.getByText('3')).toBeInTheDocument();

  await userEvent.click(screen.getByText('Family'));
  expect(onChange).toHaveBeenCalledWith('g1');
});

it('maps the "all" selection back to undefined', async () => {
  mockedGetUserGroups.mockResolvedValue([]);
  const onChange = vi.fn();
  render(<GroupFilter value="personal" onChange={onChange} />);

  await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());
  await userEvent.click(screen.getByRole('combobox'));
  await userEvent.click(await screen.findByText('All Activities'));

  expect(onChange).toHaveBeenCalledWith(undefined);
});

it('hides member counts when showCounts is false', async () => {
  mockedGetUserGroups.mockResolvedValue([{ _id: 'g1', name: 'Family', memberCount: 3 }]);
  render(<GroupFilter onChange={vi.fn()} />);

  await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());
  await userEvent.click(screen.getByRole('combobox'));
  await screen.findByText('Family');

  expect(screen.queryByText('3')).not.toBeInTheDocument();
});
