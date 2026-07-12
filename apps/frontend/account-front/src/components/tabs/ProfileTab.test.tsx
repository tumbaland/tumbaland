import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('../../services/authService', () => ({
  authService: {
    isAuthenticated: vi.fn(),
    getProfile: vi.fn(),
    redirectToLogin: vi.fn()
  }
}));

vi.mock('../../services/profileService', () => ({
  profileService: {
    updateProfile: vi.fn()
  }
}));

vi.mock('@tumbaland/frontend-core', async () => {
  const actual = await vi.importActual('@tumbaland/frontend-core');
  return { ...actual, logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() } };
});

import { authService } from '../../services/authService';
import { profileService } from '../../services/profileService';
import ProfileTab from './ProfileTab';

const mockedIsAuthenticated = authService.isAuthenticated as unknown as ReturnType<typeof vi.fn>;
const mockedGetProfile = authService.getProfile as unknown as ReturnType<typeof vi.fn>;
const mockedRedirectToLogin = authService.redirectToLogin as unknown as ReturnType<typeof vi.fn>;
const mockedUpdateProfile = profileService.updateProfile as unknown as ReturnType<typeof vi.fn>;

const user = { id: 'u1', email: 'jane@example.com', firstName: 'Jane', lastName: 'Doe' };

beforeEach(() => {
  vi.clearAllMocks();
  mockedIsAuthenticated.mockResolvedValue(true);
  mockedGetProfile.mockResolvedValue(user);
});

it('shows a loading spinner before data resolves', () => {
  mockedIsAuthenticated.mockReturnValue(new Promise(() => {}));
  render(<ProfileTab />);
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

it('loads and displays the current profile', async () => {
  render(<ProfileTab />);

  expect(await screen.findByDisplayValue('Jane')).toBeInTheDocument();
  expect(screen.getByDisplayValue('Doe')).toBeInTheDocument();
  expect(screen.getByDisplayValue('jane@example.com')).toBeInTheDocument();
});

it('redirects to login when the user is not authenticated', async () => {
  mockedIsAuthenticated.mockResolvedValue(false);
  render(<ProfileTab />);

  await waitFor(() => expect(mockedRedirectToLogin).toHaveBeenCalled());
  expect(mockedGetProfile).not.toHaveBeenCalled();
});

it('shows an error message when no profile data comes back', async () => {
  mockedGetProfile.mockResolvedValue(null);
  render(<ProfileTab />);

  expect(await screen.findByText(/failed to load profile data/i)).toBeInTheDocument();
});

it('redirects to login when loading throws a 401 error', async () => {
  mockedGetProfile.mockRejectedValue(new Error('request failed: 401'));
  render(<ProfileTab />);

  await waitFor(() => expect(mockedRedirectToLogin).toHaveBeenCalled());
});

it('shows a generic error message for a non-401 load failure', async () => {
  mockedGetProfile.mockRejectedValue(new Error('boom'));
  render(<ProfileTab />);

  expect(await screen.findByText(/failed to load user data/i)).toBeInTheDocument();
  expect(mockedRedirectToLogin).not.toHaveBeenCalled();
});

it('handles firstName/lastName being absent from the loaded user', async () => {
  mockedGetProfile.mockResolvedValue({ id: 'u1', email: 'jane@example.com' });
  render(<ProfileTab />);

  const firstNameInput = (await screen.findByLabelText('First Name')) as HTMLInputElement;
  expect(firstNameInput.value).toBe('');
});

it('updates the last name field and the notifications toggle', async () => {
  const { container } = render(<ProfileTab />);
  const lastNameInput = (await screen.findByLabelText('Last Name')) as HTMLInputElement;
  const notificationsSwitch = container.querySelector('input[type="checkbox"]') as HTMLInputElement;

  expect(notificationsSwitch).toBeChecked();

  await userEvent.clear(lastNameInput);
  await userEvent.type(lastNameInput, 'Smith');
  await userEvent.click(notificationsSwitch);

  expect(lastNameInput.value).toBe('Smith');
  expect(notificationsSwitch).not.toBeChecked();
});

it('enables Save only after a name field actually changes, and disables it again on cancel', async () => {
  render(<ProfileTab />);
  const firstNameInput = await screen.findByLabelText('First Name');
  const saveButton = screen.getByRole('button', { name: /save changes/i });
  const cancelButton = screen.getByRole('button', { name: /cancel/i });

  expect(saveButton).toBeDisabled();
  expect(cancelButton).toBeDisabled();

  await userEvent.clear(firstNameInput);
  await userEvent.type(firstNameInput, 'Janet');

  expect(saveButton).toBeEnabled();
  expect(cancelButton).toBeEnabled();

  await userEvent.click(cancelButton);

  expect(firstNameInput).toHaveValue('Jane');
  expect(saveButton).toBeDisabled();
});

it('saves changes and shows a success message', async () => {
  mockedUpdateProfile.mockResolvedValue({ success: true, user: { ...user, firstName: 'Janet' } });
  render(<ProfileTab />);

  const firstNameInput = await screen.findByLabelText('First Name');
  await userEvent.clear(firstNameInput);
  await userEvent.type(firstNameInput, 'Janet');
  await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

  expect(await screen.findByText(/profile updated successfully/i)).toBeInTheDocument();
  expect(mockedUpdateProfile).toHaveBeenCalledWith({ firstName: 'Janet', lastName: 'Doe' });
  // hasChanges resets after a successful save, so Save is disabled again
  expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
});

it('shows the server-provided error message when the update reports failure', async () => {
  mockedUpdateProfile.mockResolvedValue({ success: false, message: 'Name too long' });
  render(<ProfileTab />);

  const firstNameInput = await screen.findByLabelText('First Name');
  await userEvent.clear(firstNameInput);
  await userEvent.type(firstNameInput, 'Janet');
  await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

  expect(await screen.findByText('Name too long')).toBeInTheDocument();
});

it('falls back to a generic error message when the update fails without one', async () => {
  mockedUpdateProfile.mockResolvedValue({ success: false });
  render(<ProfileTab />);

  const firstNameInput = await screen.findByLabelText('First Name');
  await userEvent.clear(firstNameInput);
  await userEvent.type(firstNameInput, 'Janet');
  await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

  expect(await screen.findByText(/failed to update profile$/i)).toBeInTheDocument();
});

it('shows an error message when saving throws', async () => {
  mockedUpdateProfile.mockRejectedValue(new Error('network down'));
  render(<ProfileTab />);

  const firstNameInput = await screen.findByLabelText('First Name');
  await userEvent.clear(firstNameInput);
  await userEvent.type(firstNameInput, 'Janet');
  await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

  expect(await screen.findByText(/failed to update profile\. please try again/i)).toBeInTheDocument();
});

it('dismisses the alert message when its close button is clicked', async () => {
  mockedGetProfile.mockResolvedValue(null);
  render(<ProfileTab />);

  const alert = await screen.findByText(/failed to load profile data/i);
  const closeButton = screen.getByRole('button', { name: /close/i });
  await userEvent.click(closeButton);

  expect(alert).not.toBeInTheDocument();
});

it('shows a placeholder alert when deleting the account', async () => {
  const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
  render(<ProfileTab />);

  await userEvent.click(await screen.findByRole('button', { name: /delete account/i }));

  expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/not implemented/i));
});
