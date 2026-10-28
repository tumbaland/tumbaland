/** Hands the browser a file to save. */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Later rather than now: some mobile browsers read the blob after click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
