const mockVerifyIdToken = jest.fn();

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: mockVerifyIdToken
  }))
}));

import { verifyGoogleToken } from './googleAuthService';

describe('verifyGoogleToken', () => {
  beforeEach(() => {
    mockVerifyIdToken.mockReset();
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
});
