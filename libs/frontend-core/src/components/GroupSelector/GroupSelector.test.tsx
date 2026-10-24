import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vite-plus/test';

import { GroupSelector, type GroupSelectorProps } from './GroupSelector';

const mockedGetUserGroups = vi.fn();

// Every test supplies the source of groups the way an app does.
const Selector = (props: Omit<GroupSelectorProps, 'getGroups'>) => (
  <GroupSelector getGroups={mockedGetUserGroups} {...props} />
);

beforeEach(() => vi.clearAllMocks());

it('shows a loading state while groups are fetched', () => {
  mockedGetUserGroups.mockReturnValue(new Promise(() => {}));
  render(<Selector onChange={vi.fn()} />);
  expect(screen.getByText(/loading groups/i)).toBeInTheDocument();
});

it('shows an error alert when the fetch fails', async () => {
  mockedGetUserGroups.mockRejectedValue(new Error('boom'));
  render(<Selector onChange={vi.fn()} />);
  expect(await screen.findByText('boom')).toBeInTheDocument();
});

it('shows a generic error message for a non-Error rejection', async () => {
  mockedGetUserGroups.mockRejectedValue('not an error');
  render(<Selector onChange={vi.fn()} />);
  expect(await screen.findByText(/failed to load groups/i)).toBeInTheDocument();
});

it('renders the private/personal/group options and calls onChange on selection', async () => {
  mockedGetUserGroups.mockResolvedValue([{ _id: 'g1', name: 'Family', isOwner: true, memberCount: 3 }]);
  const onChange = vi.fn();
  render(<Selector value="" onChange={onChange} />);

  await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());

  await userEvent.click(screen.getByRole('combobox'));
  expect(await screen.findByText('No group (private)')).toBeInTheDocument();
  expect(screen.getByText('Personal only')).toBeInTheDocument();
  expect(screen.getByText('Family')).toBeInTheDocument();
  expect(screen.getByText('Owner')).toBeInTheDocument();
  expect(screen.getByText('3 members')).toBeInTheDocument();

  await userEvent.click(screen.getByText('Family'));
  expect(onChange).toHaveBeenCalledWith('g1');
});

it('omits the personal and none options when disabled via props', async () => {
  mockedGetUserGroups.mockResolvedValue([]);
  render(<Selector onChange={vi.fn()} includePersonal={false} includeNone={false} />);

  await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());
  await userEvent.click(screen.getByRole('combobox'));

  expect(screen.queryByText('No group (private)')).not.toBeInTheDocument();
  expect(screen.queryByText('Personal only')).not.toBeInTheDocument();
});
