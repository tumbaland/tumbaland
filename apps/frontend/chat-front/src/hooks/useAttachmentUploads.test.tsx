import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useAttachmentUploads } from './useAttachmentUploads';

const attachmentUploadUrl = vi.fn();
const requestThumbnail = vi.fn();

vi.mock('../services/chatApi', () => ({
  chatApi: {
    attachmentUploadUrl: (...args: unknown[]) => attachmentUploadUrl(...args),
    requestThumbnail: (...args: unknown[]) => requestThumbnail(...args)
  },
  newClientId: () => `id-${Math.random().toString(36).slice(2)}`
}));

const downscaleImage = vi.fn();
const captureVideoPoster = vi.fn();
vi.mock('../services/mediaPrep', () => ({
  downscaleImage: (...args: unknown[]) => downscaleImage(...args),
  captureVideoPoster: (...args: unknown[]) => captureVideoPoster(...args)
}));

/** A stand-in XMLHttpRequest that reports progress then succeeds or fails. */
class FakeXhr {
  static instances: FakeXhr[] = [];
  static failWith: number | null = null;

  status = 200;
  upload = { onprogress: null as ((event: ProgressEvent) => void) | null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  sent: Blob | null = null;
  url = '';

  constructor() {
    FakeXhr.instances.push(this);
  }

  open(_method: string, url: string) {
    this.url = url;
  }
  setRequestHeader() {}
  send(blob: Blob) {
    this.sent = blob;
    setTimeout(() => {
      this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 } as ProgressEvent);
      if (FakeXhr.failWith !== null) {
        this.status = FakeXhr.failWith;
      }
      this.onload?.();
    }, 0);
  }
}

const imageFile = () => new File(['x'], 'holiday.jpg', { type: 'image/jpeg' });
const videoFile = () => new File(['x'], 'clip.mp4', { type: 'video/mp4' });

beforeEach(() => {
  FakeXhr.instances = [];
  FakeXhr.failWith = null;
  vi.stubGlobal('XMLHttpRequest', FakeXhr);
  vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() });

  downscaleImage.mockImplementation(async (file: File) => ({
    blob: file,
    filename: file.name,
    mimetype: file.type,
    width: 1024,
    height: 768
  }));
  captureVideoPoster.mockResolvedValue(null);
  attachmentUploadUrl.mockResolvedValue({
    uploadUrl: 'https://files.test/upload/abc',
    fileId: 'chat/g1/c1/abc/original.jpg',
    posterUploadFileId: null,
    expiresInMinutes: 15
  });
  requestThumbnail.mockResolvedValue('chat/g1/c1/abc/thumb.webp');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const setup = () => renderHook(() => useAttachmentUploads('c1'));

describe('documents', () => {
  it('uploads a document as it is, with no resizing, poster or thumbnail', async () => {
    attachmentUploadUrl.mockResolvedValue({
      uploadUrl: 'https://files.test/upload/doc',
      fileId: 'chat/g1/c1/doc/original.pdf',
      posterUploadFileId: null,
      expiresInMinutes: 15
    });
    const { result } = setup();

    await act(async () => {
      await result.current.add([new File(['x'], 'report.pdf', { type: 'application/pdf' })]);
    });

    await waitFor(() => expect(result.current.uploads[0]!.status).toBe('done'));
    expect(downscaleImage).not.toHaveBeenCalled();
    expect(captureVideoPoster).not.toHaveBeenCalled();
    expect(requestThumbnail).not.toHaveBeenCalled();
    expect(result.current.uploads[0]!.attachment).toMatchObject({
      fileId: 'chat/g1/c1/doc/original.pdf',
      mimetype: 'application/pdf',
      name: 'report.pdf'
    });
  });

  it('works out the type from the extension when the browser gave none', async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.add([new File(['x'], 'notes.odt', { type: '' })]);
    });

    await waitFor(() => expect(result.current.uploads[0]!.status).toBe('done'));
    expect(attachmentUploadUrl).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ mimetype: 'application/vnd.oasis.opendocument.text' })
    );
  });

  it('fails a file that is not a photo, a video or a known document', async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.add([new File(['x'], 'tool.exe', { type: 'application/x-msdownload' })]);
    });

    await waitFor(() => expect(result.current.uploads[0]!.status).toBe('failed'));
    expect(attachmentUploadUrl).not.toHaveBeenCalled();
  });
});

describe('uploading', () => {
  it('uploads the bytes straight to file-service, not through chat-service', async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.add([imageFile()]);
    });

    expect(FakeXhr.instances[0]!.url).toBe('https://files.test/upload/abc');
  });

  it('ends with a ready attachment carrying its ids', async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.add([imageFile()]);
    });

    await waitFor(() => expect(result.current.uploads[0]!.status).toBe('done'));
    expect(result.current.uploads[0]!.attachment).toMatchObject({
      fileId: 'chat/g1/c1/abc/original.jpg',
      thumbnailFileId: 'chat/g1/c1/abc/thumb.webp',
      width: 1024,
      height: 768
    });
  });

  it('downscales a photo before asking where to put it', async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.add([imageFile()]);
    });

    // The size sent to the quota gate has to be the size actually uploaded.
    expect(downscaleImage).toHaveBeenCalled();
    expect(attachmentUploadUrl.mock.invocationCallOrder[0]).toBeGreaterThan(
      downscaleImage.mock.invocationCallOrder[0]!
    );
  });

  it('reports progress while uploading', async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.add([imageFile()]);
    });

    await waitFor(() => expect(result.current.uploads[0]!.progress).toBeGreaterThan(0));
  });

  it('asks for no thumbnail for a video', async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.add([videoFile()]);
    });

    expect(requestThumbnail).not.toHaveBeenCalled();
  });

  it('captures and uploads a poster for a video', async () => {
    captureVideoPoster.mockResolvedValue({ blob: new Blob(['p']), width: 1280, height: 720, durationMs: 5000 });
    attachmentUploadUrl
      .mockResolvedValueOnce({
        uploadUrl: 'https://files.test/upload/v',
        fileId: 'chat/g1/c1/v/original.mp4',
        posterUploadFileId: 'chat/g1/c1/v/poster.jpg',
        expiresInMinutes: 15
      })
      .mockResolvedValueOnce({
        uploadUrl: 'https://files.test/upload/p',
        fileId: 'chat/g1/c1/p/poster.jpg',
        posterUploadFileId: null,
        expiresInMinutes: 15
      });
    const { result } = setup();

    await act(async () => {
      await result.current.add([videoFile()]);
    });

    await waitFor(() => expect(result.current.uploads[0]!.status).toBe('done'));
    expect(result.current.uploads[0]!.attachment).toMatchObject({ durationMs: 5000, width: 1280, height: 720 });
  });

  it('still finishes a video whose poster could not be captured', async () => {
    captureVideoPoster.mockResolvedValue(null);
    const { result } = setup();

    await act(async () => {
      await result.current.add([videoFile()]);
    });

    // A clip without a poster still plays.
    await waitFor(() => expect(result.current.uploads[0]!.status).toBe('done'));
  });

  it('marks an upload failed rather than throwing', async () => {
    FakeXhr.failWith = 500;
    const { result } = setup();

    await act(async () => {
      await result.current.add([imageFile()]);
    });

    await waitFor(() => expect(result.current.uploads[0]!.status).toBe('failed'));
  });

  it('marks it failed when the service refuses the upload, such as over quota', async () => {
    attachmentUploadUrl.mockRejectedValue(new Error('Storage limit reached'));
    const { result } = setup();

    await act(async () => {
      await result.current.add([imageFile()]);
    });

    await waitFor(() => expect(result.current.uploads[0]!.status).toBe('failed'));
    expect(result.current.uploads[0]!.error).toMatch(/Storage limit/);
  });

  it('still shows a thumbnail when the service could not make one', async () => {
    requestThumbnail.mockResolvedValue(null);
    const { result } = setup();

    await act(async () => {
      await result.current.add([imageFile()]);
    });

    await waitFor(() => expect(result.current.uploads[0]!.status).toBe('done'));
    expect(result.current.uploads[0]!.attachment!.thumbnailFileId).toBeNull();
  });
});

describe('the queue', () => {
  it('reports busy while work is outstanding and settles afterwards', async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.add([imageFile()]);
    });

    await waitFor(() => expect(result.current.busy).toBe(false));
  });

  it('removes one upload and revokes its preview', async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.add([imageFile()]);
    });

    act(() => result.current.remove(result.current.uploads[0]!.id));

    expect(result.current.uploads).toHaveLength(0);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });

  it('hands over the finished attachments and empties the queue', async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.add([imageFile()]);
    });
    await waitFor(() => expect(result.current.uploads[0]!.status).toBe('done'));

    let taken: unknown[] = [];
    act(() => {
      taken = result.current.take();
    });

    expect(taken).toHaveLength(1);
    expect(result.current.uploads).toHaveLength(0);
  });

  it('never hands over a failed upload', async () => {
    FakeXhr.failWith = 500;
    const { result } = setup();
    await act(async () => {
      await result.current.add([imageFile()]);
    });
    await waitFor(() => expect(result.current.uploads[0]!.status).toBe('failed'));

    let taken: unknown[] = [];
    act(() => {
      taken = result.current.take();
    });

    // A message carrying a fileId whose bytes never arrived would render as a
    // permanently broken image.
    expect(taken).toHaveLength(0);
  });

  it('does nothing without a conversation', async () => {
    const { result } = renderHook(() => useAttachmentUploads(undefined));

    await act(async () => {
      await result.current.add([imageFile()]);
    });

    expect(result.current.uploads).toHaveLength(0);
    expect(attachmentUploadUrl).not.toHaveBeenCalled();
  });

  it('revokes every preview on unmount, so a file is not held in memory', async () => {
    const { result, unmount } = setup();
    await act(async () => {
      await result.current.add([imageFile()]);
    });

    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
});
