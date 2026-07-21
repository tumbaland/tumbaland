import { Album, Photo } from '../types';

export function makePhoto(overrides: Partial<Photo> = {}): Photo {
  return {
    _id: 'photo-1',
    filename: 'photo-1.jpg',
    originalName: 'photo-1.jpg',
    albumId: 'album-1',
    mimetype: 'image/jpeg',
    size: 123456,
    tags: [],
    metadata: {},
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides
  };
}

export function makeAlbum(overrides: Partial<Album> = {}): Album {
  return {
    _id: 'album-1',
    name: 'My Album',
    isPublic: false,
    tags: [],
    photoCount: 0,
    userId: 'user-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides
  };
}
