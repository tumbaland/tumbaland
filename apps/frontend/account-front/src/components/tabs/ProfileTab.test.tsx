import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vite-plus/test';

vi.mock('../../services/authService', () => ({
  authService: {
    isAuthenticated: vi.fn(),
    getProfile: vi.fn(),
    redirectToLogin: vi.fn()
  }
}));

vi.mock('../../services/profileService', () => ({
  profileService: {
    updateProfile: vi.fn(),
    requestDeletion: vi.fn(),
    cancelDeletion: vi.fn(),
    uploadPicture: vi.fn(),
    removePicture: vi.fn()
  }
}));

// Canvas is not available in jsdom; the resize itself is the browser's job.
vi.mock('../../services/avatarImage', () => ({
  squareAvatar: vi.fn(async () => new Blob(['jpeg'], { type: 'image/jpeg' }))
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
const mockedRequestDeletion = profileService.requestDeletion as unknown as ReturnType<typeof vi.fn>;
const mockedCancelDeletion = profileService.cancelDeletion as unknown as ReturnType<typeof vi.fn>;

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

it('shows the last login time when the profile includes it', async () => {
  mockedGetProfile.mockResolvedValue({ ...user, lastLoginAt: '2026-07-27T10:00:00.000Z' });
  render(<ProfileTab />);

  expect(await screen.findByText(/last login:/i)).toBeInTheDocument();
});

it('omits the last login line when the profile has no lastLoginAt', async () => {
  render(<ProfileTab />);

  await screen.findByDisplayValue('Jane');
  expect(screen.queryByText(/last login:/i)).not.toBeInTheDocument();
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

/**
 * Asking for the account to be removed.
 *
 * Nothing is deleted here. The request is recorded, an administrator acts on it
 * by hand later, and in the meantime the account works exactly as before — so
 * the copy has to say that, and these tests are as much about the promise the
 * page makes as about the call it sends.
 */
describe('the danger zone', () => {
  const REQUESTED = '2026-09-01T10:00:00.000Z';

  const openConfirm = async () => {
    const person = userEvent.setup();
    render(<ProfileTab />);
    await person.click(await screen.findByRole('button', { name: /Request account deletion/i }));
    return person;
  };

  it('does not promise an immediate deletion, because there is not one', async () => {
    render(<ProfileTab />);

    // A button labelled "delete" that quietly does not delete is worse than one
    // that never existed: somebody would leave believing their data was gone.
    expect(await screen.findByRole('button', { name: /Request account deletion/i })).toBeInTheDocument();
    expect(screen.getByText(/Nothing is removed straight away/i)).toBeInTheDocument();
    expect(screen.getByText(/withdraw the request whenever you like/i)).toBeInTheDocument();
  });

  it('asks for the email address before it will send the request', async () => {
    await openConfirm();

    // A guard against a mis-click, not a lock: the action behind it is slow and
    // reversible.
    expect(screen.getByRole('button', { name: /^Request deletion$/i })).toBeDisabled();
  });

  it('sends the request once the address matches', async () => {
    const person = await openConfirm();
    mockedRequestDeletion.mockResolvedValue({ success: true, deletionRequestedAt: REQUESTED });

    await person.type(screen.getByLabelText(/Type your email address/i), 'jane@example.com');
    await person.click(screen.getByRole('button', { name: /^Request deletion$/i }));

    await waitFor(() => expect(mockedRequestDeletion).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Nothing has been removed yet/i)).toBeInTheDocument();
  });

  it('ignores the case of the address, since nobody types their own email carefully', async () => {
    const person = await openConfirm();
    mockedRequestDeletion.mockResolvedValue({ success: true, deletionRequestedAt: REQUESTED });

    await person.type(screen.getByLabelText(/Type your email address/i), '  Jane@Example.com  ');

    expect(screen.getByRole('button', { name: /^Request deletion$/i })).toBeEnabled();
  });

  it('says the data is still there once a request stands', async () => {
    mockedGetProfile.mockResolvedValue({ ...user, deletionRequestedAt: REQUESTED });
    render(<ProfileTab />);

    expect(await screen.findByText(/Deletion requested/i)).toBeInTheDocument();
    expect(screen.getByText(/Nothing has been removed/i)).toBeInTheDocument();
    // The date an administrator will work from, so the person can see it took.
    expect(screen.getByText(/1 September 2026|September 1, 2026/)).toBeInTheDocument();
  });

  it('offers no second request while one is already standing', async () => {
    mockedGetProfile.mockResolvedValue({ ...user, deletionRequestedAt: REQUESTED });
    render(<ProfileTab />);

    await screen.findByText(/Deletion requested/i);
    expect(screen.queryByRole('button', { name: /Request account deletion/i })).not.toBeInTheDocument();
  });

  it('withdraws the request and goes back to normal', async () => {
    const person = userEvent.setup();
    mockedGetProfile.mockResolvedValue({ ...user, deletionRequestedAt: REQUESTED });
    mockedCancelDeletion.mockResolvedValue({ success: true, deletionRequestedAt: null });
    render(<ProfileTab />);

    await person.click(await screen.findByRole('button', { name: /Withdraw request/i }));

    await waitFor(() => expect(mockedCancelDeletion).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Your account stays as it is/i)).toBeInTheDocument();
    // Back to the state it started in, without a reload.
    expect(await screen.findByRole('button', { name: /Request account deletion/i })).toBeInTheDocument();
  });

  it('says so when the request could not be sent', async () => {
    const person = await openConfirm();
    mockedRequestDeletion.mockRejectedValue(new Error('network is down'));

    await person.type(screen.getByLabelText(/Type your email address/i), 'jane@example.com');
    await person.click(screen.getByRole('button', { name: /^Request deletion$/i }));

    expect(await screen.findByText(/Could not send the request/i)).toBeInTheDocument();
  });

  it('says so when the withdrawal could not be sent', async () => {
    const person = userEvent.setup();
    mockedGetProfile.mockResolvedValue({ ...user, deletionRequestedAt: REQUESTED });
    mockedCancelDeletion.mockRejectedValue(new Error('network is down'));
    render(<ProfileTab />);

    await person.click(await screen.findByRole('button', { name: /Withdraw request/i }));

    expect(await screen.findByText(/Could not withdraw the request/i)).toBeInTheDocument();
    // The request is still standing, so the button that clears it has to stay.
    expect(screen.getByRole('button', { name: /Withdraw request/i })).toBeInTheDocument();
  });
});

describe('profile picture', () => {
  const photo = new File(['x'], 'me.jpg', { type: 'image/jpeg' });

  it('uploads a chosen photo and shows it', async () => {
    vi.mocked(profileService.uploadPicture).mockResolvedValue('https://auth.example/auth/avatars/u1?v=1');
    const { container } = render(<ProfileTab />);
    await screen.findByDisplayValue('Jane');

    await userEvent.upload(screen.getByTestId('picture-input'), photo);

    expect(await screen.findByText('Picture updated.')).toBeInTheDocument();
    expect(profileService.uploadPicture).toHaveBeenCalledWith(expect.any(Blob));
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://auth.example/auth/avatars/u1?v=1');
    // Now there is an upload, it can be taken away again.
    expect(screen.getByRole('button', { name: 'Remove picture' })).toBeInTheDocument();
  });

  it('says why when the upload is refused', async () => {
    vi.mocked(profileService.uploadPicture).mockRejectedValue(new Error('That picture is too large'));
    render(<ProfileTab />);
    await screen.findByDisplayValue('Jane');

    await userEvent.upload(screen.getByTestId('picture-input'), photo);

    expect(await screen.findByText('That picture is too large')).toBeInTheDocument();
  });

  it('offers no remove button for a picture that came from Google', async () => {
    mockedGetProfile.mockResolvedValue({ ...user, picture: 'google.png', hasCustomPicture: false });
    render(<ProfileTab />);
    await screen.findByDisplayValue('Jane');

    expect(screen.queryByRole('button', { name: 'Remove picture' })).not.toBeInTheDocument();
  });

  it('removes an uploaded picture, falling back to Google’s', async () => {
    mockedGetProfile.mockResolvedValue({ ...user, picture: 'mine.jpg', hasCustomPicture: true });
    vi.mocked(profileService.removePicture).mockResolvedValue('google.png');
    const { container } = render(<ProfileTab />);
    await screen.findByDisplayValue('Jane');

    await userEvent.click(screen.getByRole('button', { name: 'Remove picture' }));

    await waitFor(() => expect(container.querySelector('img')).toHaveAttribute('src', 'google.png'));
    expect(screen.queryByRole('button', { name: 'Remove picture' })).not.toBeInTheDocument();
  });
});
