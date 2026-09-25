import { mediaPreview } from './mediaPreview';

it('draws a video from its still when it has one', () => {
  expect(
    mediaPreview({
      mimetype: 'video/mp4',
      signedUrl: '/clip.mp4',
      thumbnailSignedUrl: '/clip.mp4',
      posterSignedUrl: '/still.jpg'
    })
  ).toEqual({ src: '/still.jpg', mimetype: 'image/jpeg' });
});

it('draws a video without a still from the file, and a photo from its thumbnail', () => {
  expect(mediaPreview({ mimetype: 'video/mp4', signedUrl: '/clip.mp4' })).toEqual({
    src: '/clip.mp4',
    mimetype: 'video/mp4'
  });
  expect(
    mediaPreview({ mimetype: 'image/jpeg', signedUrl: '/a.jpg', thumbnailSignedUrl: '/a-t.jpg', posterSignedUrl: '/x' })
  ).toEqual({
    src: '/a-t.jpg',
    mimetype: 'image/jpeg'
  });
});
