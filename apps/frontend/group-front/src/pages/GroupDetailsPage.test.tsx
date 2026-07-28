import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const mockedNavigate = vi.fn();
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, useParams: () => ({ id: 'g1' }), useNavigate: () => mockedNavigate };
});

vi.mock('../services/authService', () => ({
  authService: { checkAuth: vi.fn() }
}));

vi.mock('../services/groupApi', () => ({
  groupApi: {
    getGroup: vi.fn(),
    updateGroup: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
    updateMemberRole: vi.fn()
  }
}));

import { authService } from '../services/authService';
import { groupApi } from '../services/groupApi';
import GroupDetailsPage from './GroupDetailsPage';
import { Group } from '../types';

const mockedCheckAuth = authService.checkAuth as unknown as ReturnType<typeof vi.fn>;
const mockedGetGroup = groupApi.getGroup as unknown as ReturnType<typeof vi.fn>;
const mockedUpdateGroup = groupApi.updateGroup as unknown as ReturnType<typeof vi.fn>;
const mockedAddMember = groupApi.addMember as unknown as ReturnType<typeof vi.fn>;
const mockedRemoveMember = groupApi.removeMember as unknown as ReturnType<typeof vi.fn>;
const mockedUpdateMemberRole = groupApi.updateMemberRole as unknown as ReturnType<typeof vi.fn>;

const group: Group = {
  _id: 'g1',
  name: 'Family',
  members: [
    { email: 'me@example.com', role: 'owner' },
    { email: 'other@example.com', role: 'member' }
  ]
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedCheckAuth.mockResolvedValue({ authenticated: true, user: { email: 'me@example.com', name: 'Me' } });
  mockedGetGroup.mockResolvedValue(group);
});

it('shows a spinner while loading', () => {
  mockedGetGroup.mockReturnValue(new Promise(() => {}));
  render(<GroupDetailsPage />);
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

it('shows an error message when the group fails to load', async () => {
  mockedGetGroup.mockRejectedValue(new Error('boom'));
  render(<GroupDetailsPage />);
  expect(await screen.findByText('Failed to load group details')).toBeInTheDocument();
});

it('renders the group header, stats, and members once loaded, resolving the current user role', async () => {
  render(<GroupDetailsPage />);

  expect(await screen.findByText('Family')).toBeInTheDocument();
  // GroupDetailsHeader shows "Edit Group" only for owner/admin — 'me' is the owner here.
  expect(screen.getByRole('button', { name: /edit group/i })).toBeInTheDocument();
});

it('navigates back to the groups list', async () => {
  render(<GroupDetailsPage />);
  await screen.findByText('Family');

  await userEvent.click(screen.getByRole('button', { name: /back to groups/i }));

  expect(mockedNavigate).toHaveBeenCalledWith('/');
});

it('logs and swallows a failed auth check without blocking the page', async () => {
  mockedCheckAuth.mockRejectedValue(new Error('auth down'));
  render(<GroupDetailsPage />);
  expect(await screen.findByText('Family')).toBeInTheDocument();
});

it('edits the group name via the header button', async () => {
  mockedUpdateGroup.mockResolvedValue({ ...group, name: 'Family Renamed' });
  render(<GroupDetailsPage />);
  await screen.findByText('Family');

  await userEvent.click(screen.getByRole('button', { name: /edit group/i }));
  const nameInput = screen.getByLabelText('Group Name') as HTMLInputElement;
  expect(nameInput.value).toBe('Family');
  await userEvent.clear(nameInput);
  await userEvent.type(nameInput, 'Family Renamed');
  await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

  expect(mockedUpdateGroup).toHaveBeenCalledWith('g1', { name: 'Family Renamed' });
  await waitFor(() => expect(mockedGetGroup).toHaveBeenCalledTimes(2));
});

it('adds a member via the members list button', async () => {
  mockedAddMember.mockResolvedValue(group);
  render(<GroupDetailsPage />);
  await screen.findByText('Family');

  await userEvent.click(screen.getByRole('button', { name: /add member/i }));
  await userEvent.type(screen.getByLabelText(/^Email Address/), 'new@example.com');
  await userEvent.click(screen.getByRole('button', { name: 'Add Member' }));

  expect(mockedAddMember).toHaveBeenCalledWith('g1', 'new@example.com');
});

it('removes a member via the member menu', async () => {
  mockedRemoveMember.mockResolvedValue(group);
  render(<GroupDetailsPage />);
  await screen.findByText('Family');

  const menuButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="MoreVertIcon"]'));
  await userEvent.click(menuButtons[0]);
  await userEvent.click(await screen.findByText('Remove from Group'));

  expect(mockedRemoveMember).toHaveBeenCalledWith('g1', 'other@example.com');
});

it('changes a member\'s role via the member menu', async () => {
  mockedUpdateMemberRole.mockResolvedValue(group);
  render(<GroupDetailsPage />);
  await screen.findByText('Family');

  const menuButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="MoreVertIcon"]'));
  await userEvent.click(menuButtons[0]);
  await userEvent.click(await screen.findByText('Change Role'));

  await userEvent.click(screen.getByRole('radio', { name: 'Admin' }));
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  expect(mockedUpdateMemberRole).toHaveBeenCalledWith('g1', 'other@example.com', 'admin');
});
