/**
 * The name to show: the one set on the account page wins over Google's.
 *
 * Google's is whatever the Google account happens to say ("Tom T"), and it
 * arrives again at every sign-in, so it cannot be the stored name or it would
 * undo the person's own choice each time. Undefined when there is neither,
 * so a caller can fall back to the name the token already carries.
 */
export const effectiveName = (user: {
  firstName?: string | null;
  lastName?: string | null;
  googleName?: string | null;
}): string | undefined => {
  const own = [user.firstName, user.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
  return own || user.googleName || undefined;
};
