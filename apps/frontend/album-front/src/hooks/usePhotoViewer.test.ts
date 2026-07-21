import { renderHook, act } from '@testing-library/react';
import { usePhotoViewer } from './usePhotoViewer';
import { Photo } from '../types';

function makePhoto(id: string): Photo {
  return {
    _id: id,
    filename: `${id}.jpg`,
    originalName: `${id}.jpg`,
    albumId: 'album-1',
    mimetype: 'image/jpeg',
    size: 1000,
    tags: [],
    metadata: {},
    createdAt: '',
    updatedAt: ''
  };
}

const photos = [makePhoto('p1'), makePhoto('p2'), makePhoto('p3')];

it('starts closed with no selected photo', () => {
  const { result } = renderHook(() => usePhotoViewer(photos));
  expect(result.current.showPhotoViewer).toBe(false);
  expect(result.current.selectedPhoto).toBeNull();
});

it('opens the viewer on the clicked photo, tracking its index', () => {
  const { result } = renderHook(() => usePhotoViewer(photos));

  act(() => result.current.handleViewPhoto(photos[1]));

  expect(result.current.showPhotoViewer).toBe(true);
  expect(result.current.selectedPhoto).toBe(photos[1]);
  expect(result.current.selectedPhotoIndex).toBe(1);
});

it('steps to the previous and next photo', () => {
  const { result } = renderHook(() => usePhotoViewer(photos));
  act(() => result.current.handleViewPhoto(photos[1]));

  act(() => result.current.handleNextPhoto());
  expect(result.current.selectedPhotoIndex).toBe(2);
  expect(result.current.selectedPhoto).toBe(photos[2]);

  act(() => result.current.handlePreviousPhoto());
  act(() => result.current.handlePreviousPhoto());
  expect(result.current.selectedPhotoIndex).toBe(0);
  expect(result.current.selectedPhoto).toBe(photos[0]);
});

it('does not step past the first or last photo', () => {
  const { result } = renderHook(() => usePhotoViewer(photos));
  act(() => result.current.handleViewPhoto(photos[0]));

  act(() => result.current.handlePreviousPhoto());
  expect(result.current.selectedPhotoIndex).toBe(0);

  act(() => result.current.handleViewPhoto(photos[2]));
  act(() => result.current.handleNextPhoto());
  expect(result.current.selectedPhotoIndex).toBe(2);
});

it('resets state on close', () => {
  const { result } = renderHook(() => usePhotoViewer(photos));
  act(() => result.current.handleViewPhoto(photos[2]));

  act(() => result.current.handleClosePhotoViewer());

  expect(result.current.showPhotoViewer).toBe(false);
  expect(result.current.selectedPhoto).toBeNull();
  expect(result.current.selectedPhotoIndex).toBe(0);
});
