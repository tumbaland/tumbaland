import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('../../services/groupApi', () => ({
  groupApi: {
    listMyGroups: vi.fn(),
    createGroup: vi.fn(),
    updateGroup: vi.fn(),
    deleteGroup: vi.fn()
  }
}));

vi.mock('../../services/authService', () => ({
  authService: { getCurrentUser: vi.fn() }
}));

import { groupApi } from '../../services/groupApi';
import { authService } from '../../services/authService';
import GroupsTab from './GroupsTab';
import { Group } from '../../types';

const mockedListMyGroups = groupApi.listMyGroups as unknown as ReturnType<typeof vi.fn>;
const mockedCreateGroup = groupApi.createGroup as unknown as ReturnType<typeof vi.fn>;
const mockedUpdateGroup = groupApi.updateGroup as unknown as ReturnType<typeof vi.fn>;
const mockedDeleteGroup = groupApi.deleteGroup as unknown as ReturnType<typeof vi.fn>;
const mockedGetCurrentUser = authService.getCurrentUser as unknown as ReturnType<typeof vi.fn>;

const groups: Group[] = [
  { _id: 'g1', name: 'Family', members: [{ email: 'owner@example.com', role: 'owner' }, { email: 'me@example.com', role: 'admin' }] },
  { _id: 'g2', name: 'Work', members: [{ email: 'me@example.com', role: 'member' }] }
];

function renderTab() {
  return render(
    <MemoryRouter>
      <GroupsTab />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetCurrentUser.mockResolvedValue({ email: 'me@example.com', name: 'Me' });
});

it('shows a loading message before groups arrive', () => {
  mockedListMyGroups.mockReturnValue(new Promise(() => {}));
  renderTab();
  expect(screen.getByText(/loading your groups/i)).toBeInTheDocument();
});

it('loads and displays groups with roles resolved from the current user email', async () => {
  mockedListMyGroups.mockResolvedValue(groups);
  renderTab();

  expect(await screen.findByText('Family')).toBeInTheDocument();
  expect(screen.getByText('Work')).toBeInTheDocument();
  expect(screen.getByText('admin')).toBeInTheDocument(); // role in Family
  expect(screen.getByText('member')).toBeInTheDocument(); // role in Work
});

it('shows a dismissible error alert when loading fails', async () => {
  mockedListMyGroups.mockRejectedValue(new Error('network down'));
  renderTab();

  expect(await screen.findByText('network down')).toBeInTheDocument();
  await userEvent.click(screen.getByLabelText(/close/i));
  expect(screen.queryByText('network down')).not.toBeInTheDocument();
});

it('shows a generic error message for a non-Error rejection', async () => {
  mockedListMyGroups.mockRejectedValue('boom');
  renderTab();
  expect(await screen.findByText('Failed to load groups')).toBeInTheDocument();
});

it('does not set currentUserEmail when getCurrentUser resolves null (roles default to member)', async () => {
  mockedListMyGroups.mockResolvedValue(groups);
  mockedGetCurrentUser.mockResolvedValue(null);
  renderTab();

  await screen.findByText('Family');
  // Both groups' roles fall back to 'member' since there's no current user email to match
  expect(screen.getAllByText('member').length).toBe(2);
});

it('creates a group via the header button and reloads the list', async () => {
  mockedListMyGroups.mockResolvedValueOnce(groups).mockResolvedValueOnce([...groups, { _id: 'g3', name: 'New Group' }]);
  mockedCreateGroup.mockResolvedValue({ _id: 'g3', name: 'New Group' });
  renderTab();
  await screen.findByText('Family');

  await userEvent.click(screen.getByRole('button', { name: /new group/i }));
  await userEvent.type(screen.getByLabelText('Group Name'), 'New Group');
  await userEvent.click(screen.getByRole('button', { name: 'Create Group' }));

  expect(mockedCreateGroup).toHaveBeenCalledWith('New Group');
  expect(await screen.findByText('New Group')).toBeInTheDocument();
});

it('shows an error message when creating a group fails', async () => {
  mockedListMyGroups.mockResolvedValue(groups);
  mockedCreateGroup.mockRejectedValue(new Error('name taken'));
  renderTab();
  await screen.findByText('Family');

  await userEvent.click(screen.getByRole('button', { name: /new group/i }));
  await userEvent.type(screen.getByLabelText('Group Name'), 'Dup');
  await userEvent.click(screen.getByRole('button', { name: 'Create Group' }));

  expect(await screen.findByText('name taken')).toBeInTheDocument();
});

it('edits a group\'s name via its card menu (available to owner/admin)', async () => {
  mockedListMyGroups.mockResolvedValue(groups);
  mockedUpdateGroup.mockResolvedValue({ _id: 'g1', name: 'Family Renamed' });
  renderTab();
  await screen.findByText('Family');

  const menuButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="MoreVertIcon"]'));
  await userEvent.click(menuButtons[0]); // Family card, admin can modify
  await userEvent.click(await screen.findByText('Edit Name'));

  const nameInput = screen.getByLabelText('Group Name') as HTMLInputElement;
  expect(nameInput.value).toBe('Family');
  await userEvent.clear(nameInput);
  await userEvent.type(nameInput, 'Family Renamed');
  await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

  expect(mockedUpdateGroup).toHaveBeenCalledWith('g1', { name: 'Family Renamed' });
});

it('shows an error message when editing a group fails', async () => {
  mockedListMyGroups.mockResolvedValue(groups);
  mockedUpdateGroup.mockRejectedValue(new Error('fail'));
  renderTab();
  await screen.findByText('Family');

  const menuButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="MoreVertIcon"]'));
  await userEvent.click(menuButtons[0]);
  await userEvent.click(await screen.findByText('Edit Name'));
  await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

  expect(await screen.findByText('fail')).toBeInTheDocument();
});

it('only offers Delete Group in the menu for a group the user owns', async () => {
  mockedListMyGroups.mockResolvedValue(groups);
  renderTab();
  await screen.findByText('Family');

  // Work card: 'me' is only a 'member' there, so canModifyGroup is false -> no menu button at all
  const menuButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="MoreVertIcon"]'));
  expect(menuButtons.length).toBe(1); // only Family (admin can modify, but not delete since not owner)

  await userEvent.click(menuButtons[0]);
  expect(await screen.findByText('Edit Name')).toBeInTheDocument();
  expect(screen.queryByText('Delete Group')).not.toBeInTheDocument();
});

it('deletes a group the user owns via the card menu', async () => {
  const ownedGroups: Group[] = [{ _id: 'g1', name: 'Family', members: [{ email: 'me@example.com', role: 'owner' }] }];
  mockedListMyGroups.mockResolvedValueOnce(ownedGroups).mockResolvedValueOnce([]);
  mockedDeleteGroup.mockResolvedValue(undefined);
  renderTab();
  await screen.findByText('Family');

  const menuButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="MoreVertIcon"]'));
  await userEvent.click(menuButtons[0]);
  await userEvent.click(await screen.findByText('Delete Group'));

  await userEvent.click(screen.getByRole('button', { name: 'Delete Group' }));

  expect(mockedDeleteGroup).toHaveBeenCalledWith('g1');
  await waitFor(() => expect(screen.getByText('No groups yet')).toBeInTheDocument());
});

it('shows an error message when deleting a group fails', async () => {
  const ownedGroups: Group[] = [{ _id: 'g1', name: 'Family', members: [{ email: 'me@example.com', role: 'owner' }] }];
  mockedListMyGroups.mockResolvedValue(ownedGroups);
  mockedDeleteGroup.mockRejectedValue(new Error('fail'));
  renderTab();
  await screen.findByText('Family');

  const menuButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="MoreVertIcon"]'));
  await userEvent.click(menuButtons[0]);
  await userEvent.click(await screen.findByText('Delete Group'));
  await userEvent.click(screen.getByRole('button', { name: 'Delete Group' }));

  expect(await screen.findByText('fail')).toBeInTheDocument();
});
