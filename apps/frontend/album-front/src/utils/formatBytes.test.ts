import { formatBytes } from './formatBytes';

it('formats zero bytes as "0 B"', () => {
  expect(formatBytes(0)).toBe('0 B');
});

it('formats bytes below 1KB as B', () => {
  expect(formatBytes(512)).toBe('512 B');
});

it('formats kilobytes', () => {
  expect(formatBytes(1024 * 500)).toBe('500 KB');
});

it('formats megabytes', () => {
  expect(formatBytes(1024 * 1024 * 5)).toBe('5 MB');
});

it('formats gigabytes', () => {
  expect(formatBytes(1024 * 1024 * 1024 * 1.5)).toBe('1.5 GB');
});
