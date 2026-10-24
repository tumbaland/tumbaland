const getDownloadUrls = jest.fn();
const downloadBuffer = jest.fn();
const uploadBuffer = jest.fn();

jest.mock('./fileServiceClient', () => ({
  getDownloadUrls: (...args: unknown[]) => getDownloadUrls(...args),
  downloadBuffer: (...args: unknown[]) => downloadBuffer(...args),
  uploadBuffer: (...args: unknown[]) => uploadBuffer(...args),
  getUploadUrl: jest.fn()
}));

const sharpInstance = {
  rotate: jest.fn().mockReturnThis(),
  resize: jest.fn().mockReturnThis(),
  webp: jest.fn().mockReturnThis(),
  toBuffer: jest.fn()
};
jest.mock('sharp', () => ({ __esModule: true, default: jest.fn(() => sharpInstance) }));

import {
  bytesOf,
  buildFileId,
  folderFor,
  generateThumbnail,
  posterFileIdFor,
  thumbnailFileIdFor,
  withDownloadUrls
} from './attachmentService';
import { toView, type MessageView } from './messageView';
import { Message } from '../models/Message';

beforeEach(() => {
  getDownloadUrls.mockResolvedValue(new Map());
  downloadBuffer.mockResolvedValue(Buffer.from('original'));
  uploadBuffer.mockResolvedValue(undefined);
  sharpInstance.toBuffer.mockResolvedValue(Buffer.from('thumb'));
});

afterEach(() => jest.clearAllMocks());

describe('buildFileId', () => {
  it('nests the upload under its group and conversation', () => {
    const fileId = buildFileId('g1', 'c1', 'holiday.jpg');

    expect(fileId).toMatch(/^chat\/g1\/c1\/[0-9a-f-]{36}\/original\.jpg$/);
  });

  it('gives every upload its own folder, so one name cannot overwrite another', () => {
    expect(buildFileId('g1', 'c1', 'a.jpg')).not.toBe(buildFileId('g1', 'c1', 'a.jpg'));
  });

  it('takes only the extension from the client, never the name', () => {
    // The filename is attacker-controlled and ends up as a path.
    const fileId = buildFileId('g1', 'c1', 'secret-document-name.png');

    expect(fileId).not.toContain('secret-document-name');
    expect(fileId.endsWith('/original.png')).toBe(true);
  });

  it.each([
    ['../../../etc/passwd'],
    ['a/../../b.jpg'],
    ['photo'],
    ['odd.name.with.dots.']
  ])('cannot be made to escape its folder with %s', (filename) => {
    const fileId = buildFileId('g1', 'c1', filename);

    expect(fileId).not.toContain('..');
    expect(fileId.startsWith('chat/g1/c1/')).toBe(true);
    expect(fileId.split('/')).toHaveLength(5);
  });

  it('drops an extension that is not a plain suffix', () => {
    expect(buildFileId('g1', 'c1', 'file.this-is-far-too-long')).toMatch(/\/original$/);
  });
});

describe('derived paths', () => {
  const fileId = 'chat/g1/c1/abc/original.jpg';

  it('puts the thumbnail beside the original', () => {
    expect(thumbnailFileIdFor(fileId)).toBe('chat/g1/c1/abc/thumb.webp');
  });

  it('puts the video poster beside the original', () => {
    expect(posterFileIdFor(fileId)).toBe('chat/g1/c1/abc/poster.jpg');
  });

  it('reports the folder, so one prefix delete removes the whole set', () => {
    expect(folderFor(fileId)).toBe('chat/g1/c1/abc');
  });
});

describe('generateThumbnail', () => {
  it('resizes an image to webp and stores it beside the original', async () => {
    const result = await generateThumbnail('chat/g1/c1/abc/original.jpg', 'image/jpeg');

    expect(result).toBe('chat/g1/c1/abc/thumb.webp');
    expect(uploadBuffer).toHaveBeenCalledWith('chat/g1/c1/abc/thumb.webp', expect.any(Buffer), 'image/webp');
  });

  it('honours the EXIF orientation, so phone photos are not sideways', async () => {
    await generateThumbnail('chat/g1/c1/abc/original.jpg', 'image/jpeg');

    expect(sharpInstance.rotate).toHaveBeenCalled();
  });

  it('never enlarges a small image', async () => {
    await generateThumbnail('chat/g1/c1/abc/original.jpg', 'image/jpeg');

    expect(sharpInstance.resize).toHaveBeenCalledWith(640, 640, { fit: 'inside', withoutEnlargement: true });
  });

  it('converts HEIC, which Chrome on Android cannot display at all', async () => {
    const result = await generateThumbnail('chat/g1/c1/abc/original.heic', 'image/heic');

    expect(result).toBe('chat/g1/c1/abc/thumb.webp');
  });

  it('does nothing for a video', async () => {
    expect(await generateThumbnail('chat/g1/c1/abc/original.mp4', 'video/mp4')).toBeNull();
    expect(downloadBuffer).not.toHaveBeenCalled();
  });

  it('returns null rather than throwing when the image cannot be read', async () => {
    // A send must never fail because an image could not be resized.
    downloadBuffer.mockRejectedValue(new Error('file-service down'));

    expect(await generateThumbnail('chat/g1/c1/abc/original.jpg', 'image/jpeg')).toBeNull();
  });

  it('returns null when sharp cannot decode the file', async () => {
    sharpInstance.toBuffer.mockRejectedValue(new Error('unsupported image format'));

    expect(await generateThumbnail('chat/g1/c1/abc/original.jpg', 'image/jpeg')).toBeNull();
  });
});

const view = (attachments: MessageView['attachments']): MessageView =>
  ({ id: 'm1', attachments }) as MessageView;

describe('withDownloadUrls', () => {
  it('preserves attachment fields from real Mongoose documents without leaking internals', async () => {
    const attachment = {
      fileId: 'chat/g1/c1/abc/original.jpg',
      thumbnailFileId: 'chat/g1/c1/abc/thumb.webp',
      mimetype: 'image/jpeg',
      sizeBytes: 1234,
      width: 640,
      height: 480
    };
    const stored = new Message({ attachments: [attachment] });
    getDownloadUrls.mockResolvedValue(new Map([[attachment.fileId, 'https://files/original']]));

    const [result] = await withDownloadUrls([toView(stored)]);
    const wire = JSON.parse(JSON.stringify(result));

    expect(wire.attachments[0]).toMatchObject({ ...attachment, url: 'https://files/original' });
    expect(wire.attachments[0]).not.toHaveProperty('_doc');
    expect(wire.attachments[0]).not.toHaveProperty('__parentArray');
    expect(stored.attachments[0]).not.toHaveProperty('url');
  });

  it('asks for nothing when no message has an attachment', async () => {
    await withDownloadUrls([view([])]);

    expect(getDownloadUrls).not.toHaveBeenCalled();
  });

  it('mints one batch for the whole page, not one call per attachment', async () => {
    await withDownloadUrls([
      view([{ fileId: 'f1', mimetype: 'image/jpeg', sizeBytes: 1 }]),
      view([{ fileId: 'f2', mimetype: 'image/jpeg', sizeBytes: 1 }])
    ]);

    expect(getDownloadUrls).toHaveBeenCalledTimes(1);
    expect(getDownloadUrls).toHaveBeenCalledWith(['f1', 'f2']);
  });

  it('attaches the signed URL to each attachment', async () => {
    getDownloadUrls.mockResolvedValue(new Map([['f1', 'https://files/f1?token=x']]));

    const [message] = await withDownloadUrls([view([{ fileId: 'f1', mimetype: 'image/jpeg', sizeBytes: 1 }])]);

    expect(message!.attachments[0]!.url).toBe('https://files/f1?token=x');
  });

  it('asks for the thumbnail and poster too', async () => {
    await withDownloadUrls([
      view([
        {
          fileId: 'f1',
          thumbnailFileId: 't1',
          posterFileId: 'p1',
          mimetype: 'video/mp4',
          sizeBytes: 1
        }
      ])
    ]);

    expect(getDownloadUrls).toHaveBeenCalledWith(['f1', 't1', 'p1']);
  });

  it('leaves a URL null when file-service did not return one', async () => {
    // The thread renders without its images rather than failing to load.
    const [message] = await withDownloadUrls([view([{ fileId: 'f1', mimetype: 'image/jpeg', sizeBytes: 1 }])]);

    expect(message!.attachments[0]!.url).toBeNull();
  });
});

describe('bytesOf', () => {
  it('totals a message’s attachments', () => {
    expect(
      bytesOf({
        attachments: [
          { fileId: 'a', mimetype: 'image/jpeg', sizeBytes: 100 },
          { fileId: 'b', mimetype: 'image/jpeg', sizeBytes: 250 }
        ]
      })
    ).toBe(350);
  });

  it('is zero for a message with none', () => {
    expect(bytesOf({ attachments: [] })).toBe(0);
  });
});
