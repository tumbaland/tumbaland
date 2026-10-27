/**
 * A short label for a browser's User-Agent: "Safari on iOS".
 *
 * The raw string says more than an administrator needs and is stored for the
 * owner's own devices list, so only this coarse reading leaves the service.
 * iOS is tested before macOS and Android before Linux, because those user
 * agents contain the names of the systems they imitate.
 */
export function deviceLabel(userAgent: string | undefined): string {
  const agent = userAgent ?? '';
  const system = /iPhone|iPad|iPod/.test(agent)
    ? 'iOS'
    : /Android/.test(agent)
      ? 'Android'
      : /Windows/.test(agent)
        ? 'Windows'
        : /Macintosh|Mac OS X/.test(agent)
          ? 'macOS'
          : /Linux|X11/.test(agent)
            ? 'Linux'
            : null;
  const browser = /Edg\//.test(agent)
    ? 'Edge'
    : /OPR\//.test(agent)
      ? 'Opera'
      : /Firefox\/|FxiOS/.test(agent)
        ? 'Firefox'
        : /Chrome\/|CriOS/.test(agent)
          ? 'Chrome'
          : /Safari\//.test(agent)
            ? 'Safari'
            : null;
  if (browser && system) return `${browser} on ${system}`;
  return browser ?? system ?? 'Unknown device';
}
