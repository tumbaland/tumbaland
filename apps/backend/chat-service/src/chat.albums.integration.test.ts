process.env.SERVICE_NAME = 'chat-service';
process.env.JWT_SECRET = 'test-secret';
process.env.INTERNAL_SERVICE_TOKEN = 'internal-test-token';

/**
 * Chat and Album: saving photos to an album, moving them, and making a collage together.
 *
 * Through the real middleware, controllers, models and a real database; see
 * test/integration.ts. What it talks to in file-service and album-service is
 * replaced, from test/mocks.ts.
 */
jest.mock('./services/fileServiceClient', () => jest.requireActual('./test/mocks').fileServiceClientMock);
jest.mock('./services/albumClient', () => jest.requireActual('./test/mocks').albumClientMock);
jest.mock('./services/storageUsage', () => jest.requireActual('./test/mocks').storageUsageMock);

import { albumCalls, FakeAlbumGone } from './test/mocks';
import { as, TOM, IRJA, PERSIK, conversationInG1, clientId, setupChatIntegration } from './test/integration';
import { Message } from './models/Message';
import { subscribe } from './services/streamHub';
import { deleteFolder } from './services/fileServiceClient';

setupChatIntegration();

describe('making a collage together', () => {
  async function withAlbum(): Promise<string> {
    const id = await conversationInG1();
    await as(TOM).put(`/api/chat/conversations/${id}/photo-album`).send({ mode: 'album', albumId: 'a-rome' });
    return id;
  }

  it('makes the collage on the chat’s album and posts a card both people see', async () => {
    const id = await withAlbum();

    const res = await as(TOM).post(`/api/chat/conversations/${id}/collages`).send({ clientId: clientId(), title: 'Rome' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ kind: 'collage', collage: { id: 'k-1', title: 'Rome' }, senderName: 'Tom' });
    expect(albumCalls.createCollage).toHaveBeenCalledWith('g1', {
      clientId: res.body.data.clientId,
      userId: 'u-tom',
      albumId: 'a-rome',
      conversationId: id,
      title: 'Rome'
    });
    const page = await as(IRJA).get(`/api/chat/conversations/${id}/messages`);
    expect(page.body.data.messages[0]).toMatchObject({ kind: 'collage', collage: { id: 'k-1', title: 'Rome' } });
    const list = await as(IRJA).get('/api/chat/conversations');
    expect(list.body.data[0]).toMatchObject({ lastMessagePreview: 'Collage: Rome', unreadCount: 1 });
  });

  it('makes one collage for a retried request, not two', async () => {
    const id = await withAlbum();
    const key = clientId();

    const first = await as(TOM).post(`/api/chat/conversations/${id}/collages`).send({ clientId: key, title: 'Rome' });
    const again = await as(TOM).post(`/api/chat/conversations/${id}/collages`).send({ clientId: key, title: 'Rome' });

    expect(first.status).toBe(201);
    expect(again.status).toBe(200);
    expect(again.body.data.id).toBe(first.body.data.id);
    expect(albumCalls.createCollage).toHaveBeenCalledTimes(1);
  });

  it('asks for an album first when the chat has none', async () => {
    const id = await conversationInG1();

    const res = await as(TOM).post(`/api/chat/conversations/${id}/collages`).send({ clientId: clientId(), title: 'Rome' });

    expect(res.status).toBe(400);
    expect(albumCalls.createCollage).not.toHaveBeenCalled();
  });

  it('says so when the chat’s album has been deleted in Album', async () => {
    const id = await withAlbum();
    albumCalls.createCollage.mockRejectedValueOnce(new FakeAlbumGone());

    const res = await as(TOM).post(`/api/chat/conversations/${id}/collages`).send({ clientId: clientId(), title: 'Rome' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('no longer exists');
  });

  it('keeps people outside the group out', async () => {
    const id = await withAlbum();

    const res = await as(PERSIK).post(`/api/chat/conversations/${id}/collages`).send({ clientId: clientId(), title: 'Rome' });

    expect(res.status).toBe(404);
  });
});

describe('saving photos to Album', () => {
  /** Album work runs after the reply, so give it a moment. */
  const settle = () => new Promise((resolve) => setTimeout(resolve, 100));
  const photo = (id: string, name = 'abc') => ({
    fileId: `chat/g1/${id}/${name}/original.jpg`,
    thumbnailFileId: `chat/g1/${id}/${name}/thumb.webp`,
    mimetype: 'image/jpeg',
    sizeBytes: 1000
  });

  it('asks first: a new conversation has no album chosen', async () => {
    const id = await conversationInG1();
    const res = await as(TOM).get(`/api/chat/conversations/${id}`);
    expect(res.body.data.photoAlbum).toEqual({ mode: 'unset', albumId: null, albumName: null });
  });

  it('offers the group’s albums for the picker', async () => {
    const id = await conversationInG1();
    const res = await as(TOM).get(`/api/chat/conversations/${id}/albums`);
    expect(res.body.data).toEqual([{ id: 'a-rome', name: 'Rome', photoCount: 3 }]);
    expect(albumCalls.listAlbums).toHaveBeenCalledWith('g1');
  });

  it('says nothing when someone picks the album already chosen', async () => {
    const id = await conversationInG1();
    await as(IRJA).put(`/api/chat/conversations/${id}/photo-album`).send({ mode: 'album', albumId: 'a-rome' });

    const res = await as(TOM).put(`/api/chat/conversations/${id}/photo-album`).send({ mode: 'album', albumId: 'a-rome' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ mode: 'album', albumId: 'a-rome', albumName: 'Rome' });
    const page = await as(TOM).get(`/api/chat/conversations/${id}/messages`);
    // Only Irja's line, from when it really changed.
    expect(page.body.data.messages.filter((m: { kind: string }) => m.kind === 'system')).toHaveLength(1);
  });

  it('sets the album for both people, and says so in the thread without counting it unread', async () => {
    const id = await conversationInG1();

    const res = await as(IRJA).put(`/api/chat/conversations/${id}/photo-album`).send({ mode: 'album', albumId: 'a-rome' });

    expect(res.body.data).toEqual({ mode: 'album', albumId: 'a-rome', albumName: 'Rome' });
    const seen = await as(TOM).get(`/api/chat/conversations/${id}`);
    expect(seen.body.data.photoAlbum).toMatchObject({ albumName: 'Rome' });
    const page = await as(TOM).get(`/api/chat/conversations/${id}/messages`);
    expect(page.body.data.messages[0]).toMatchObject({ kind: 'system', body: 'Irja set photos to go to Rome' });
    const list = await as(TOM).get('/api/chat/conversations');
    expect(list.body.data[0].unreadCount).toBe(0);
  });

  it('creates a new album from the picker', async () => {
    const id = await conversationInG1();

    const res = await as(TOM).put(`/api/chat/conversations/${id}/photo-album`).send({ mode: 'album', newAlbumName: 'Paris' });

    expect(albumCalls.createAlbum).toHaveBeenCalledWith('g1', TOM.id, 'Paris');
    expect(res.body.data).toEqual({ mode: 'album', albumId: 'a-new', albumName: 'Paris' });
  });

  it('refuses an album that is not in the conversation’s group', async () => {
    const id = await conversationInG1();
    const res = await as(TOM).put(`/api/chat/conversations/${id}/photo-album`).send({ mode: 'album', albumId: 'a-elsewhere' });
    expect(res.status).toBe(400);
  });

  it('saves each file of a sent photo message and marks it with the album', async () => {
    const id = await conversationInG1();
    await as(TOM).put(`/api/chat/conversations/${id}/photo-album`).send({ mode: 'album', albumId: 'a-rome' });

    const sent = await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({ clientId: clientId(), attachments: [photo(id), photo(id, 'def')] });
    await settle();

    expect(albumCalls.addChatPhoto).toHaveBeenCalledTimes(2);
    expect(albumCalls.addChatPhoto).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: 'g1', albumId: 'a-rome', messageId: sent.body.data.id, fileId: photo(id).fileId })
    );
    const stored = await Message.findById(sent.body.data.id);
    expect(stored!.attachments[0]).toMatchObject({ albumId: 'a-rome', albumName: 'Rome' });
  });

  it('tells an open thread when someone changes their name, and keeps the new one', async () => {
    const id = await conversationInG1();
    await as(IRJA).get(`/api/chat/conversations/${id}`);
    const sent: string[] = [];
    subscribe('u-tom', ['g1'], { send: (chunk: string) => sent.push(chunk) > 0 } as unknown as import('@tumbaland/backend-core').SseStream);

    await as({ ...IRJA, name: 'Irja Tamm' }).get(`/api/chat/conversations/${id}`);

    expect(sent.join('')).toContain('"member":{"userId":"u-irja","name":"Irja Tamm"');
    const detail = await as(TOM).get(`/api/chat/conversations/${id}`);
    expect(detail.body.data.members).toEqual(
      expect.arrayContaining([expect.objectContaining({ userId: 'u-irja', name: 'Irja Tamm' })])
    );
  });

  it("hands a video's still to the album along with the video", async () => {
    const id = await conversationInG1();
    await as(TOM).put(`/api/chat/conversations/${id}/photo-album`).send({ mode: 'album', albumId: 'a-rome' });

    await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({
        clientId: clientId(),
        attachments: [
          {
            fileId: `chat/g1/${id}/clip/original.mp4`,
            posterFileId: `chat/g1/${id}/still/original.jpg`,
            mimetype: 'video/mp4',
            sizeBytes: 100
          }
        ]
      });
    await settle();

    expect(albumCalls.addChatPhoto).toHaveBeenCalledWith(
      expect.objectContaining({ fileId: `chat/g1/${id}/clip/original.mp4`, posterFileId: `chat/g1/${id}/still/original.jpg` })
    );
  });

  it('leaves out only the photos the sender unticked', async () => {
    const id = await conversationInG1();
    await as(TOM).put(`/api/chat/conversations/${id}/photo-album`).send({ mode: 'album', albumId: 'a-rome' });
    const kept = photo(id, 'kept');
    const left = photo(id, 'left');

    await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({ clientId: clientId(), attachments: [kept, left], skipAlbumFileIds: [left.fileId] });
    await settle();

    expect(albumCalls.addChatPhoto).toHaveBeenCalledTimes(1);
    expect(albumCalls.addChatPhoto).toHaveBeenCalledWith(expect.objectContaining({ fileId: kept.fileId }));
  });

  it('leaves out a send marked "not this one"', async () => {
    const id = await conversationInG1();
    await as(TOM).put(`/api/chat/conversations/${id}/photo-album`).send({ mode: 'album', albumId: 'a-rome' });

    await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), attachments: [photo(id)], skipAlbum: true });
    await settle();

    expect(albumCalls.addChatPhoto).not.toHaveBeenCalled();
  });

  it('keeps a voice message out of the album', async () => {
    const id = await conversationInG1();
    await as(TOM).put(`/api/chat/conversations/${id}/photo-album`).send({ mode: 'album', albumId: 'a-rome' });

    await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({
        clientId: clientId(),
        attachments: [{ fileId: `chat/g1/${id}/v/original.weba`, mimetype: 'audio/webm', sizeBytes: 100, durationMs: 4200 }]
      });
    await settle();

    expect(albumCalls.addChatPhoto).not.toHaveBeenCalled();
  });

  it.each([['unset', undefined], ['off', { mode: 'off' }]])('saves nothing while %s', async (_label, choice) => {
    const id = await conversationInG1();
    if (choice) await as(TOM).put(`/api/chat/conversations/${id}/photo-album`).send(choice);

    await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), attachments: [photo(id)] });
    await settle();

    expect(albumCalls.addChatPhoto).not.toHaveBeenCalled();
  });

  it('goes back to asking when the album was deleted in Album', async () => {
    const id = await conversationInG1();
    await as(TOM).put(`/api/chat/conversations/${id}/photo-album`).send({ mode: 'album', albumId: 'a-rome' });
    albumCalls.addChatPhoto.mockRejectedValueOnce(new FakeAlbumGone());

    await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), attachments: [photo(id)] });
    await settle();

    const res = await as(TOM).get(`/api/chat/conversations/${id}`);
    expect(res.body.data.photoAlbum.mode).toBe('unset');
  });

  it('still sends when Album is down', async () => {
    const id = await conversationInG1();
    await as(TOM).put(`/api/chat/conversations/${id}/photo-album`).send({ mode: 'album', albumId: 'a-rome' });
    albumCalls.addChatPhoto.mockRejectedValueOnce(new Error('album-service down'));

    const sent = await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), attachments: [photo(id)] });
    await settle();

    expect(sent.status).toBe(201);
  });

  it('takes the photos out of the album on unsend, before the files go', async () => {
    const id = await conversationInG1();
    const sent = await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), attachments: [photo(id)] });

    await as(TOM).delete(`/api/chat/conversations/${id}/messages/${sent.body.data.id}`);

    expect(albumCalls.removeChatPhotos).toHaveBeenCalledWith(sent.body.data.id);
    const removedAt = (albumCalls.removeChatPhotos as jest.Mock).mock.invocationCallOrder[0]!;
    const deletedAt = (deleteFolder as jest.Mock).mock.invocationCallOrder[0]!;
    expect(removedAt).toBeLessThan(deletedAt);
  });

  it('lets either person take a message back out of the album', async () => {
    const id = await conversationInG1();
    await as(TOM).put(`/api/chat/conversations/${id}/photo-album`).send({ mode: 'album', albumId: 'a-rome' });
    const sent = await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), attachments: [photo(id)] });
    await settle();

    const res = await as(IRJA).delete(`/api/chat/conversations/${id}/messages/${sent.body.data.id}/album`);

    expect(res.status).toBe(200);
    expect(res.body.data.attachments[0]).toMatchObject({ albumId: null });
    expect(albumCalls.removeChatPhotos).toHaveBeenCalledWith(sent.body.data.id);
    const stored = await Message.findById(sent.body.data.id);
    expect(stored!.attachments[0]).toMatchObject({ albumId: null, albumName: null });
  });

  it('keeps someone outside the group out of the setting', async () => {
    const id = await conversationInG1();
    const res = await as(PERSIK).put(`/api/chat/conversations/${id}/photo-album`).send({ mode: 'off' });
    expect(res.status).toBe(404);
  });
});

describe('changing a sent photo’s album', () => {
  const settle = () => new Promise((resolve) => setTimeout(resolve, 100));
  const file = (id: string, name: string) => ({
    fileId: `chat/g1/${id}/${name}/original.jpg`,
    mimetype: 'image/jpeg',
    sizeBytes: 1000
  });

  async function twoPhotosInRome() {
    const id = await conversationInG1();
    await as(TOM).put(`/api/chat/conversations/${id}/photo-album`).send({ mode: 'album', albumId: 'a-rome' });
    const sent = await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({ clientId: clientId(), attachments: [file(id, 'abc'), file(id, 'def')] });
    expect(sent.status).toBe(201);
    await settle();
    jest.clearAllMocks();
    return { id, messageId: sent.body.data.id as string };
  }

  it('moves one photo, and leaves the other and the conversation’s setting alone', async () => {
    const { id, messageId } = await twoPhotosInRome();

    const res = await as(IRJA)
      .put(`/api/chat/conversations/${id}/messages/${messageId}/album`)
      .send({ albumId: 'a-home', fileId: file(id, 'abc').fileId });

    expect(res.status).toBe(200);
    expect(res.body.data.attachments[0]).toMatchObject({ albumId: 'a-home', albumName: 'Home' });
    expect(albumCalls.moveChatPhotos).toHaveBeenCalledWith(messageId, {
      groupId: 'g1',
      albumId: 'a-home',
      fileIds: [file(id, 'abc').fileId]
    });
    const stored = await Message.findById(messageId);
    expect(stored!.attachments.map((attachment) => attachment.albumName)).toEqual(['Home', 'Rome']);
    const detail = await as(TOM).get(`/api/chat/conversations/${id}`);
    expect(detail.body.data.photoAlbum.albumName).toBe('Rome');
  });

  it('adds a photo that was left out, rather than trying to move it', async () => {
    const id = await conversationInG1();
    const sent = await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({ clientId: clientId(), attachments: [file(id, 'abc')], skipAlbum: true });

    await as(TOM).put(`/api/chat/conversations/${id}/messages/${sent.body.data.id}/album`).send({ albumId: 'a-rome' });

    expect(albumCalls.moveChatPhotos).not.toHaveBeenCalled();
    expect(albumCalls.addChatPhoto).toHaveBeenCalledWith(expect.objectContaining({ albumId: 'a-rome', fileId: file(id, 'abc').fileId }));
  });

  it('can put a photo in a new album', async () => {
    const { id, messageId } = await twoPhotosInRome();

    await as(TOM).put(`/api/chat/conversations/${id}/messages/${messageId}/album`).send({ newAlbumName: 'Best of Rome' });

    expect(albumCalls.createAlbum).toHaveBeenCalledWith('g1', TOM.id, 'Best of Rome');
  });

  it('takes out just one photo', async () => {
    const { id, messageId } = await twoPhotosInRome();

    await as(TOM).delete(`/api/chat/conversations/${id}/messages/${messageId}/album?fileId=${file(id, 'def').fileId}`);

    expect(albumCalls.removeChatPhotos).toHaveBeenCalledWith(messageId, file(id, 'def').fileId);
    const stored = await Message.findById(messageId);
    expect(stored!.attachments.map((attachment) => attachment.albumName)).toEqual(['Rome', null]);
  });

  it('moves some of a message\u2019s photos in one go, creating a new album once', async () => {
    const { id, messageId } = await twoPhotosInRome();

    const res = await as(TOM)
      .put(`/api/chat/conversations/${id}/messages/${messageId}/album`)
      .send({ newAlbumName: 'Best of Rome', fileIds: [file(id, 'def').fileId] });

    expect(res.status).toBe(200);
    expect(albumCalls.createAlbum).toHaveBeenCalledTimes(1);
    expect(albumCalls.moveChatPhotos).toHaveBeenCalledWith(messageId, expect.objectContaining({ fileIds: [file(id, 'def').fileId] }));
    const stored = await Message.findById(messageId);
    expect(stored!.attachments[0]!.albumName).toBe('Rome');
  });

  it('takes out several photos, and leaves the rest', async () => {
    const id = await conversationInG1();
    await as(TOM).put(`/api/chat/conversations/${id}/photo-album`).send({ mode: 'album', albumId: 'a-rome' });
    const sent = await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({ clientId: clientId(), attachments: [file(id, 'a'), file(id, 'b'), file(id, 'c')] });
    await settle();
    jest.clearAllMocks();

    await as(TOM).delete(
      `/api/chat/conversations/${id}/messages/${sent.body.data.id}/album?fileId=${file(id, 'a').fileId}&fileId=${file(id, 'c').fileId}`
    );

    expect(albumCalls.removeChatPhotos).toHaveBeenCalledTimes(2);
    const stored = await Message.findById(sent.body.data.id);
    expect(stored!.attachments.map((attachment) => attachment.albumName)).toEqual([null, 'Rome', null]);
  });

  it('refuses a file that is not on the message', async () => {
    const { id, messageId } = await twoPhotosInRome();

    const res = await as(TOM)
      .put(`/api/chat/conversations/${id}/messages/${messageId}/album`)
      .send({ albumId: 'a-home', fileId: 'chat/g9/elsewhere/original.jpg' });

    expect(res.status).toBe(404);
  });

  it('refuses an album from another group', async () => {
    const { id, messageId } = await twoPhotosInRome();

    const res = await as(TOM).put(`/api/chat/conversations/${id}/messages/${messageId}/album`).send({ albumId: 'a-elsewhere' });

    expect(res.status).toBe(400);
  });
});
