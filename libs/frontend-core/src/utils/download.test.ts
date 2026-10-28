import { downloadBlob } from './download';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('clicks a link to the blob under the given name', () => {
  const create = vi.fn(() => 'blob:abc');
  const revoke = vi.fn();
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    expect(this.download).toBe('notes.txt');
    expect(this.href).toBe('blob:abc');
  });

  downloadBlob(new Blob(['hi']), 'notes.txt');

  expect(click).toHaveBeenCalledTimes(1);
  expect(document.querySelector('a[download]')).toBeNull();
});

it('revokes the URL later, not as soon as the click returns', () => {
  vi.useFakeTimers();
  const revoke = vi.fn();
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:abc', revokeObjectURL: revoke });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  downloadBlob(new Blob(['hi']), 'notes.txt');
  expect(revoke).not.toHaveBeenCalled();

  vi.advanceTimersByTime(60_000);
  expect(revoke).toHaveBeenCalledWith('blob:abc');
});
