import { vi } from 'vitest';

vi.mock('./photoService', () => ({
  photoService: { getPhotoById: vi.fn() }
}));

vi.mock('../config/ConfigProvider', () => ({
  getGlobalConfig: vi.fn()
}));

import { getGlobalConfig } from '../config/ConfigProvider';
import { photoService } from './photoService';
import { AIServiceError, objectDetectionService } from './objectDetectionService';

const mockedGetPhotoById = photoService.getPhotoById as unknown as ReturnType<typeof vi.fn>;
const mockedGetGlobalConfig = getGlobalConfig as unknown as ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const { ok = true, status = 200 } = init;
  return { ok, status, json: async () => body, blob: async () => new Blob(['x']) } as Response;
}

beforeEach(() => {
  global.fetch = vi.fn();
  mockedGetGlobalConfig.mockReturnValue({ OBJECT_DETECTION_API_URL: 'https://od.example' });
});

describe('checkObjectDetectionHealth', () => {
  it('returns true when the health endpoint is ok', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse({}));

    await expect(objectDetectionService.checkObjectDetectionHealth()).resolves.toBe(true);
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/api/v1/object-detection/health');
  });

  it('falls back to the statistics endpoint when health is not ok', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 404 }))
      .mockResolvedValueOnce(jsonResponse({}));

    await expect(objectDetectionService.checkObjectDetectionHealth()).resolves.toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const [secondUrl] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[1];
    expect(String(secondUrl)).toContain('/api/v1/object-detection/statistics');
  });

  it('returns false when both the health and statistics endpoints fail', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }))
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }));

    await expect(objectDetectionService.checkObjectDetectionHealth()).resolves.toBe(false);
  });

  it('returns false when the fetch itself rejects', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network down'));

    await expect(objectDetectionService.checkObjectDetectionHealth()).resolves.toBe(false);
  });
});

describe('checkAllServicesHealth', () => {
  it('reports objectDetection health and a lastChecked timestamp', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse({}));

    const result = await objectDetectionService.checkAllServicesHealth();

    expect(result.objectDetection).toBe(true);
    expect(result.lastChecked).toBeInstanceOf(Date);
  });
});

describe('detectObjects', () => {
  it('throws an AIServiceError when the service is unhealthy', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }))
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }));

    await expect(objectDetectionService.detectObjects('photo-1')).rejects.toMatchObject({
      name: 'AIServiceError',
      service: 'object-detection'
    });
  });

  it('fetches the photo file, posts it, and returns the detection response', async () => {
    // getPhotoById is called twice: once directly in detectObjects (for
    // originalName) and again inside the internal fetchPhotoFile helper
    // (for signedUrl) — mockResolvedValue (not Once) covers both calls.
    mockedGetPhotoById.mockResolvedValue({ originalName: 'photo.jpg', signedUrl: 'https://cdn.example/photo.jpg' });
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(jsonResponse({})) // health check
      .mockResolvedValueOnce(jsonResponse({}) /* fetchPhotoFile: signed url -> blob */)
      .mockResolvedValueOnce(jsonResponse({ success: true, total_detections: 2 }));

    const result = await objectDetectionService.detectObjects('photo-1', { confidenceThreshold: 0.5 });

    expect(result).toMatchObject({ success: true, total_detections: 2 });
    const detectCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[2];
    expect(String(detectCall[0])).toContain('/api/v1/object-detection/detect');
    expect(detectCall[1]).toMatchObject({ method: 'POST' });
    expect(detectCall[1].body).toBeInstanceOf(FormData);
  });

  it('wraps a downstream HTTP failure as an AIServiceError', async () => {
    mockedGetPhotoById.mockResolvedValue({ originalName: 'photo.jpg', signedUrl: 'https://cdn.example/photo.jpg' });
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 502 }));

    await expect(objectDetectionService.detectObjects('photo-1')).rejects.toBeInstanceOf(AIServiceError);
  });

  it('throws an AIServiceError when the photo has no signed URL', async () => {
    mockedGetPhotoById.mockResolvedValue({ originalName: 'photo.jpg' });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse({}));

    await expect(objectDetectionService.detectObjects('photo-1')).rejects.toBeInstanceOf(AIServiceError);
  });
});

describe('getObjectDetectionResult', () => {
  it('returns the parsed result on success', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse({ _id: 'result-1' }));

    await expect(objectDetectionService.getObjectDetectionResult('result-1')).resolves.toMatchObject({ _id: 'result-1' });
  });

  it('wraps a non-ok response as an AIServiceError', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 404 }));

    await expect(objectDetectionService.getObjectDetectionResult('missing')).rejects.toBeInstanceOf(AIServiceError);
  });
});

describe('getObjectDetectionResultsByFileId', () => {
  it('returns results and count', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse({ results: [], count: 0 }));

    await expect(objectDetectionService.getObjectDetectionResultsByFileId('file-1')).resolves.toEqual({ results: [], count: 0 });
  });

  it('wraps a non-ok response as an AIServiceError with the parsed status', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 404 }));

    await expect(objectDetectionService.getObjectDetectionResultsByFileId('missing')).rejects.toMatchObject({
      status: 404
    });
  });
});

describe('getAvailableClasses / getAvailableModels', () => {
  it('returns the class list', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse({ all_classes: ['cat', 'dog'] }));

    await expect(objectDetectionService.getAvailableClasses()).resolves.toEqual(['cat', 'dog']);
  });

  it('wraps a failed class list fetch as an AIServiceError', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }));

    await expect(objectDetectionService.getAvailableClasses()).rejects.toBeInstanceOf(AIServiceError);
  });

  it('returns the model list', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse({ models: ['yolo'] }));

    await expect(objectDetectionService.getAvailableModels()).resolves.toEqual(['yolo']);
  });

  it('wraps a failed model list fetch as an AIServiceError', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }));

    await expect(objectDetectionService.getAvailableModels()).rejects.toBeInstanceOf(AIServiceError);
  });
});

describe('URL builders', () => {
  it('builds the visualization, original, and generic visualization-path URLs', () => {
    expect(objectDetectionService.getObjectDetectionVisualizationUrl('r1')).toBe(
      'https://od.example/api/v1/object-detection/files/result/r1/visualization'
    );
    expect(objectDetectionService.getObjectDetectionOriginalUrl('r1')).toBe(
      'https://od.example/api/v1/object-detection/files/result/r1/original'
    );
    expect(objectDetectionService.getVisualizationImageUrl('some/path.png')).toBe(
      'https://od.example/api/v1/object-detection/files/some/path.png'
    );
  });
});

describe('getErrorStatus branches', () => {
  it('leaves status undefined for a network-level TypeError (no HTTP response at all)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(objectDetectionService.getAvailableClasses()).rejects.toMatchObject({ status: undefined });
  });
});

describe('timeout handling', () => {
  it('aborts and rejects when a request exceeds its timeout', async () => {
    vi.useFakeTimers();
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (_url: string, options: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => reject(new Error('aborted')));
        })
    );

    const resultPromise = objectDetectionService.getAvailableClasses();
    const assertion = expect(resultPromise).rejects.toBeInstanceOf(AIServiceError);
    await vi.advanceTimersByTimeAsync(10000);
    await assertion;

    vi.useRealTimers();
  });
});
