import { deviceLabel } from './devices';

describe('deviceLabel', () => {
  it.each([
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      'Safari on iOS'
    ],
    [
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
      'Chrome on Android'
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
      'Edge on Windows'
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
      'Safari on macOS'
    ],
    ['Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0', 'Firefox on Linux'],
    ['Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/126.0 Safari/537.36 OPR/110.0', 'Opera on Windows']
  ])('reads %#', (agent, label) => {
    expect(deviceLabel(agent)).toBe(label);
  });

  it('says what it can when only one half is known', () => {
    expect(deviceLabel('curl/8.0')).toBe('Unknown device');
    expect(deviceLabel('SomeApp (Android 14)')).toBe('Android');
    expect(deviceLabel('Safari/605')).toBe('Safari');
    expect(deviceLabel(undefined)).toBe('Unknown device');
  });
});
