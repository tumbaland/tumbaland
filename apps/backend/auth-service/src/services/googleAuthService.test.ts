const mockVerifyIdToken = jest.fn();

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: mockVerifyIdToken
  }))
}));

import { allowedGoogleClientIds, verifyGoogleToken } from './googleAuthService';

describe('allowedGoogleClientIds', () => {
  it('is just the web client when no native app is configured', () => {
    expect(allowedGoogleClientIds({ GOOGLE_CLIENT_ID: 'web-id' })).toEqual(['web-id']);
  });

  it('adds each native client, ignoring spaces and empty entries', () => {
    expect(
      allowedGoogleClientIds({ GOOGLE_CLIENT_ID: 'web-id', GOOGLE_NATIVE_CLIENT_IDS: ' ios-id, android-id ,' })
    ).toEqual(['web-id', 'ios-id', 'android-id']);
  });

  it('is empty when nothing is configured', () => {
    expect(allowedGoogleClientIds({ GOOGLE_NATIVE_CLIENT_IDS: '' })).toEqual([]);
  });
});

describe('verifyGoogleToken', () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    mockVerifyIdToken.mockReset();
    process.env.GOOGLE_CLIENT_ID = 'web-id';
    delete process.env.GOOGLE_NATIVE_CLIENT_IDS;
  });

  afterAll(() => {
    process.env = savedEnv;
  });

  it('returns the ticket payload for a valid idToken', async () => {
    const payload = { email: 'ada@example.com', name: 'Ada Lovelace' };
    mockVerifyIdToken.mockResolvedValue({ getPayload: () => payload });

    const result = await verifyGoogleToken('valid-id-token');

    expect(result).toEqual(payload);
    expect(mockVerifyIdToken).toHaveBeenCalledWith(
      expect.objectContaining({ idToken: 'valid-id-token' })
    );
  });

  it('throws "Invalid token" when Google rejects the idToken', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Token used too early'));

    await expect(verifyGoogleToken('bad-id-token')).rejects.toThrow('Invalid token');
  });

  it('accepts tokens issued to the web client and to every native app client', async () => {
    process.env.GOOGLE_NATIVE_CLIENT_IDS = 'ios-id,android-id';
    mockVerifyIdToken.mockResolvedValue({ getPayload: () => ({ email: 'ada@example.com' }) });

    await verifyGoogleToken('app-id-token');

    expect(mockVerifyIdToken).toHaveBeenCalledWith({
      idToken: 'app-id-token',
      audience: ['web-id', 'ios-id', 'android-id']
    });
  });

  // An empty audience makes the library skip the check entirely, which would
  // accept a token minted for any Google client at all.
  it('rejects every token without asking Google when no client ID is configured', async () => {
    delete process.env.GOOGLE_CLIENT_ID;

    await expect(verifyGoogleToken('any-id-token')).rejects.toThrow('Invalid token');
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });
});
