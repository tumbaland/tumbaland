/** The side of the square the picture is cut to. Sharp at 2-3x in a 100px avatar, tiny on the wire. */
export const AVATAR_SIZE = 256;

/**
 * Cuts a picked photo to a centred square and shrinks it.
 *
 * Done in the browser so a 12-megapixel phone photo never leaves the device:
 * what is sent is a JPEG of a few tens of kilobytes, which is also the only
 * copy stored. `createImageBitmap` applies the photo's EXIF rotation, so a
 * portrait taken on a phone does not arrive on its side.
 */
export async function squareAvatar(file: File, size = AVATAR_SIZE): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose a photo');
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('That photo could not be read. Try a JPEG or PNG.');
  }

  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot resize photos');

  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not prepare the photo'))), 'image/jpeg', 0.85)
  );
}
