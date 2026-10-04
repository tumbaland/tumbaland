import { vi } from 'vite-plus/test';
import { AVATAR_SIZE, squareAvatar } from './avatarImage';

const photo = new File(['x'], 'me.jpg', { type: 'image/jpeg' });

const stubBitmap = (width: number, height: number) => {
  const bitmap = { width, height, close: vi.fn() };
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));
  return bitmap;
};

const stubCanvas = (blob: Blob | null) => {
  const context = { imageSmoothingQuality: '', drawImage: vi.fn() };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(blob));
  return context;
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('refuses a file that is not an image', async () => {
  await expect(squareAvatar(new File(['x'], 'notes.txt', { type: 'text/plain' }))).rejects.toThrow('Choose a photo');
});

it('says so when the photo cannot be decoded', async () => {
  vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('bad data')));

  await expect(squareAvatar(photo)).rejects.toThrow('That photo could not be read. Try a JPEG or PNG.');
});

it('cuts a landscape photo to its centred square at the avatar size', async () => {
  const bitmap = stubBitmap(400, 200);
  const context = stubCanvas(new Blob(['jpeg'], { type: 'image/jpeg' }));

  const result = await squareAvatar(photo);

  expect(result.type).toBe('image/jpeg');
  expect(context.drawImage).toHaveBeenCalledWith(bitmap, 100, 0, 200, 200, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  expect(context.imageSmoothingQuality).toBe('high');
  expect(bitmap.close).toHaveBeenCalled();
});

it('cuts a portrait photo to its centred square', async () => {
  const bitmap = stubBitmap(200, 400);
  const context = stubCanvas(new Blob(['jpeg']));

  await squareAvatar(photo, 64);

  expect(context.drawImage).toHaveBeenCalledWith(bitmap, 0, 100, 200, 200, 0, 0, 64, 64);
});

it('says so when the browser has no canvas to resize with', async () => {
  stubBitmap(100, 100);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

  await expect(squareAvatar(photo)).rejects.toThrow('This browser cannot resize photos');
});

it('says so when the canvas produces no picture', async () => {
  stubBitmap(100, 100);
  stubCanvas(null);

  await expect(squareAvatar(photo)).rejects.toThrow('Could not prepare the photo');
});
