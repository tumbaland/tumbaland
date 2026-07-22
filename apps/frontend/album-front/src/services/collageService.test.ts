import { vi } from 'vitest';
import { collageService } from './collageService';

function mockFetchOnce(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const { ok = true, status = 200 } = init;
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok,
    status,
    json: async () => body
  } as Response);
}

const config = {
  version: '2',
  date: '2024-01-01',
  viewport: { width: 1000, height: 1000 },
  theme: 'light',
  photos: []
};

it('creates a collage and unwraps the data envelope', async () => {
  mockFetchOnce({ success: true, data: { _id: 'collage-1', title: 'Trip', config, albumIds: ['album-1'] } });

  const result = await collageService.createCollage({ title: 'Trip', config, albumIds: ['album-1'] });

  expect(result).toMatchObject({ _id: 'collage-1', title: 'Trip' });
  const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
  expect(init).toMatchObject({ method: 'POST', body: JSON.stringify({ title: 'Trip', config, albumIds: ['album-1'] }) });
});

it('lists collages with no filters when none are given', async () => {
  mockFetchOnce({ success: true, data: [] });

  await collageService.getCollages();

  const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
  expect(String(url)).toContain('/collages?');
});

it('lists collages filtered by albumId and groupId', async () => {
  mockFetchOnce({ success: true, data: [] });

  await collageService.getCollages({ albumId: 'album-1', groupId: 'group-1' });

  const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
  expect(String(url)).toContain('albumId=album-1');
  expect(String(url)).toContain('groupId=group-1');
});

it('gets a collage by id, renaming the response photos to albumPhotos', async () => {
  mockFetchOnce({
    success: true,
    data: {
      collage: { _id: 'collage-1', title: 'Trip', config, albumIds: ['album-1'] },
      photos: [{ _id: 'photo-1' }]
    }
  });

  const result = await collageService.getCollageById('collage-1');

  expect(result.collage).toMatchObject({ _id: 'collage-1' });
  expect(result.albumPhotos).toEqual([{ _id: 'photo-1' }]);
});

it('updates a collage and unwraps the data envelope', async () => {
  mockFetchOnce({ success: true, data: { _id: 'collage-1', title: 'Renamed', config, albumIds: ['album-1'] } });

  const result = await collageService.updateCollage('collage-1', { title: 'Renamed', config, albumIds: ['album-1'] });

  expect(result).toMatchObject({ title: 'Renamed' });
  const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
  expect(String(url)).toContain('/collages/collage-1');
  expect(init).toMatchObject({ method: 'PUT' });
});

it('deletes a collage', async () => {
  mockFetchOnce({ success: true });

  await collageService.deleteCollage('collage-1');

  const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
  expect(String(url)).toContain('/collages/collage-1');
  expect(init).toMatchObject({ method: 'DELETE' });
});
