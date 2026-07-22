import { vi } from 'vitest';

vi.mock('./photoService', () => ({
  photoService: { getPhotoById: vi.fn() }
}));

vi.mock('../config/ConfigProvider', () => ({
  getGlobalConfig: vi.fn()
}));

import { getGlobalConfig } from '../config/ConfigProvider';
import { photoService } from './photoService';
import { AIServiceError, segmentationService } from './segmentationService';

const mockedGetPhotoById = photoService.getPhotoById as unknown as ReturnType<typeof vi.fn>;
const mockedGetGlobalConfig = getGlobalConfig as unknown as ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const { ok = true, status = 200 } = init;
  return { ok, status, json: async () => body, blob: async () => new Blob(['x']) } as Response;
}

beforeEach(() => {
  global.fetch = vi.fn();
  mockedGetGlobalConfig.mockReturnValue({ SEGMENTATION_API_URL: 'https://seg.example' });
});

describe('checkSegmentationHealth', () => {
  it('returns true only when the response is ok and status is "healthy"', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse({ status: 'healthy' }));

    await expect(segmentationService.checkSegmentationHealth()).resolves.toBe(true);
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/api/v1/segmentation/health');
  });

  it('returns false when ok but status is not "healthy"', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse({ status: 'degraded' }));

    await expect(segmentationService.checkSegmentationHealth()).resolves.toBe(false);
  });

  it('returns false when the response is not ok', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 503 }));

    await expect(segmentationService.checkSegmentationHealth()).resolves.toBe(false);
  });

  it('returns false when the fetch itself rejects', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network down'));

    await expect(segmentationService.checkSegmentationHealth()).resolves.toBe(false);
  });
});

describe('getSegmentationHealthDetails', () => {
  it('returns the parsed health payload on success', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse({ status: 'healthy', model: 'sam' }));

    await expect(segmentationService.getSegmentationHealthDetails()).resolves.toEqual({ status: 'healthy', model: 'sam' });
  });

  it('wraps a non-ok response as an AIServiceError', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }));

    await expect(segmentationService.getSegmentationHealthDetails()).rejects.toBeInstanceOf(AIServiceError);
  });
});

describe('checkAllServicesHealth', () => {
  it('reports segmentation health and a lastChecked timestamp', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse({ status: 'healthy' }));

    const result = await segmentationService.checkAllServicesHealth();

    expect(result.segmentation).toBe(true);
    expect(result.lastChecked).toBeInstanceOf(Date);
  });
});

describe('segmentImage', () => {
  it('throws an AIServiceError when the service is unhealthy', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse({ status: 'degraded' }));

    await expect(segmentationService.segmentImage('photo-1')).rejects.toMatchObject({
      name: 'AIServiceError',
      service: 'segmentation'
    });
  });

  it('fetches the photo file, posts multipart form data, and returns the response', async () => {
    // getPhotoById is called twice: once directly in segmentImage (for
    // originalName) and again inside the internal fetchPhotoFile helper
    // (for signedUrl) — mockResolvedValue (not Once) covers both calls.
    mockedGetPhotoById.mockResolvedValue({ originalName: 'photo.jpg', signedUrl: 'https://cdn.example/photo.jpg' });
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(jsonResponse({ status: 'healthy' })) // health check
      .mockResolvedValueOnce(jsonResponse({}) /* fetchPhotoFile: signed url -> blob */)
      .mockResolvedValueOnce(jsonResponse({ success: true, job_id: 'job-1', total_masks: 3 }));

    const result = await segmentationService.segmentImage('photo-1', { promptPoints: [[1, 2]], promptLabels: [1] });

    expect(result).toMatchObject({ success: true, job_id: 'job-1' });
    const segmentCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[2];
    expect(String(segmentCall[0])).toContain('/api/v1/segmentation/segment');
    expect(segmentCall[1]).toMatchObject({ method: 'POST' });
    expect(segmentCall[1].body).toBeInstanceOf(FormData);
  });

  it('wraps a downstream HTTP failure as an AIServiceError', async () => {
    mockedGetPhotoById.mockResolvedValue({ originalName: 'photo.jpg', signedUrl: 'https://cdn.example/photo.jpg' });
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(jsonResponse({ status: 'healthy' }))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 502 }));

    await expect(segmentationService.segmentImage('photo-1')).rejects.toBeInstanceOf(AIServiceError);
  });

  it('treats a response with success:false as a failure', async () => {
    mockedGetPhotoById.mockResolvedValue({ originalName: 'photo.jpg', signedUrl: 'https://cdn.example/photo.jpg' });
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(jsonResponse({ status: 'healthy' }))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({ success: false, message: 'model failed to load' }));

    await expect(segmentationService.segmentImage('photo-1')).rejects.toMatchObject({
      message: 'model failed to load'
    });
  });

  it('throws an AIServiceError when the photo has no signed URL', async () => {
    mockedGetPhotoById.mockResolvedValue({ originalName: 'photo.jpg' });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse({ status: 'healthy' }));

    await expect(segmentationService.segmentImage('photo-1')).rejects.toBeInstanceOf(AIServiceError);
  });

  it('includes confidenceThreshold and modelName in the form data when given', async () => {
    mockedGetPhotoById.mockResolvedValue({ originalName: 'photo.jpg', signedUrl: 'https://cdn.example/photo.jpg' });
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(jsonResponse({ status: 'healthy' }))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({ success: true, job_id: 'job-1' }));

    await segmentationService.segmentImage('photo-1', { confidenceThreshold: 0.8, modelName: 'sam-large' });

    const segmentCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[2];
    const body = segmentCall[1].body as FormData;
    expect(body.get('confidence_threshold')).toBe('0.8');
    expect(body.get('model_name')).toBe('sam-large');
  });
});

describe('getAvailableSegmentationModels', () => {
  it('maps the available_models list to names', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse({ available_models: [{ name: 'sam-base' }, { name: 'sam-large' }] })
    );

    await expect(segmentationService.getAvailableSegmentationModels()).resolves.toEqual(['sam-base', 'sam-large']);
  });

  it('returns an empty array when available_models is missing', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse({}));

    await expect(segmentationService.getAvailableSegmentationModels()).resolves.toEqual([]);
  });

  it('wraps a non-ok response as an AIServiceError', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }));

    await expect(segmentationService.getAvailableSegmentationModels()).rejects.toBeInstanceOf(AIServiceError);
  });
});

describe('switchSegmentationModel', () => {
  it('posts to the switch endpoint and returns the response', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse({ success: true, message: 'switched' }));

    const result = await segmentationService.switchSegmentationModel('sam-large');

    expect(result).toEqual({ success: true, message: 'switched' });
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/api/v1/segmentation/models/switch/sam-large');
    expect(init).toMatchObject({ method: 'POST' });
  });

  it('wraps a non-ok response as an AIServiceError', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }));

    await expect(segmentationService.switchSegmentationModel('sam-large')).rejects.toBeInstanceOf(AIServiceError);
  });
});

describe('getSegmentationResult', () => {
  it('returns the job result on success', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse({ job_id: 'job-1' }));

    await expect(segmentationService.getSegmentationResult('job-1')).resolves.toMatchObject({ job_id: 'job-1' });
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/api/v1/segmentation/results/job-1');
    expect(init).toMatchObject({ method: 'GET', headers: { Accept: 'application/json' } });
  });

  it('wraps a non-ok response as an AIServiceError', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 404 }));

    await expect(segmentationService.getSegmentationResult('missing')).rejects.toBeInstanceOf(AIServiceError);
  });
});

describe('URL builders', () => {
  it('builds the legacy image URL, stripping a leading slash', () => {
    expect(segmentationService.getSegmentationImageUrl('/results/foo.png')).toBe('https://seg.example/results/foo.png');
    expect(segmentationService.getSegmentationImageUrl('results/foo.png')).toBe('https://seg.example/results/foo.png');
  });

  it('builds the visualization and mask URLs', () => {
    expect(segmentationService.getSegmentationVisualizationUrl('job-1')).toBe(
      'https://seg.example/api/v1/segmentation/results/job-1/visualization'
    );
    expect(segmentationService.getSegmentationMaskUrl('job-1', 'mask_000.png')).toBe(
      'https://seg.example/api/v1/segmentation/results/job-1/masks/mask_000.png'
    );
  });
});

describe('path helpers', () => {
  it('extracts the mask filename from a mask file path', () => {
    expect(segmentationService.getMaskFilename('/results/masks_abc123/mask_000.png')).toBe('mask_000.png');
  });

  it('returns an empty string when the mask path has no segments', () => {
    expect(segmentationService.getMaskFilename('')).toBe('');
  });

  it('extracts the job id from a directory-style path', () => {
    expect(segmentationService.getJobIdFromPath('/results/masks_abc123-def456/')).toBe('abc123-def456');
  });

  it('extracts the job id from a file-style path', () => {
    expect(segmentationService.getJobIdFromPath('/results/segmented_abc123-def456.png')).toBe('abc123-def456');
  });

  it('returns an empty string when no job id pattern matches', () => {
    expect(segmentationService.getJobIdFromPath('/nothing/here')).toBe('');
  });
});

describe('getErrorStatus branches', () => {
  it('leaves status undefined for a network-level TypeError (no HTTP response at all)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(segmentationService.getAvailableSegmentationModels()).rejects.toMatchObject({ status: undefined });
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

    const resultPromise = segmentationService.getAvailableSegmentationModels();
    const assertion = expect(resultPromise).rejects.toBeInstanceOf(AIServiceError);
    await vi.advanceTimersByTimeAsync(10000);
    await assertion;

    vi.useRealTimers();
  });
});
