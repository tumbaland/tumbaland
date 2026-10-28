process.env.SERVICE_NAME = 'chat-service';
process.env.JWT_SECRET = 'test-secret';
process.env.INTERNAL_SERVICE_TOKEN = 'internal-test-token';

/**
 * Attachments: upload links, what is stored, and what the meter is charged.
 *
 * Through the real middleware, controllers, models and a real database; see
 * test/integration.ts. What it talks to in file-service and album-service is
 * replaced, from test/mocks.ts.
 */
jest.mock('./services/fileServiceClient', () => jest.requireActual('./test/mocks').fileServiceClientMock);
jest.mock('./services/albumClient', () => jest.requireActual('./test/mocks').albumClientMock);
jest.mock('./services/storageUsage', () => jest.requireActual('./test/mocks').storageUsageMock);

import { assertHeadroom, recordStoredBytes, releaseStoredBytes } from './test/mocks';
import { as, TOM, IRJA, PERSIK, conversationInG1, clientId, setupChatIntegration } from './test/integration';
import { Message } from './models/Message';
import { deleteFolder, getUploadUrl, storedSize } from './services/fileServiceClient';

setupChatIntegration();

describe('attachments', () => {
  it('keeps media metadata and URLs across sending, retrying, reading, editing and reacting', async () => {
    const id = await conversationInG1();
    const attachment = {
      fileId: `chat/g1/${id}/abc/original.jpg`,
      thumbnailFileId: `chat/g1/${id}/abc/thumb.webp`,
      mimetype: 'image/jpeg',
      sizeBytes: 1234,
      width: 640,
      height: 480
    };
    const payload = { clientId: clientId(), attachments: [attachment] };
    const sent = await as(TOM).post(`/api/chat/conversations/${id}/messages`).send(payload);
    expect(sent.status).toBe(201);
    const messageId = sent.body.data.id;
    const retry = await as(TOM).post(`/api/chat/conversations/${id}/messages`).send(payload);
    const page = await as(IRJA).get(`/api/chat/conversations/${id}/messages`);
    const edited = await as(TOM).patch(`/api/chat/conversations/${id}/messages/${messageId}`).send({ body: 'Photo' });
    const reacted = await as(IRJA).put(`/api/chat/conversations/${id}/messages/${messageId}/reactions`).send({ emoji: '❤️' });

    for (const message of [sent.body.data, retry.body.data, page.body.data.messages[0], edited.body.data, reacted.body.data]) {
      expect(message.attachments[0]).toMatchObject({
        ...attachment,
        url: `https://files.test/d/${attachment.fileId}`,
        thumbnailUrl: `https://files.test/d/${attachment.thumbnailFileId}`
      });
      expect(message.attachments[0]).not.toHaveProperty('_doc');
    }
  });

  const image = { filename: 'holiday.jpg', mimetype: 'image/jpeg', sizeBytes: 500_000 };

  it('mints a signed upload URL inside the conversation\u2019s own folder', async () => {
    const id = await conversationInG1();

    const res = await as(TOM).post(`/api/chat/conversations/${id}/attachments/upload-url`).send(image);

    expect(res.status).toBe(201);
    expect(res.body.data.uploadUrl).toContain('https://files.test/upload/');
    expect(res.body.data.fileId).toMatch(new RegExp(`^chat/g1/${id}/[0-9a-f-]{36}/original\\.jpg$`));
  });

  it('checks the storage quota before a byte is written', async () => {
    const id = await conversationInG1();

    await as(TOM).post(`/api/chat/conversations/${id}/attachments/upload-url`).send(image);

    // The signed URL is the only point where the size is known before the
    // upload happens.
    expect(assertHeadroom).toHaveBeenCalledWith(expect.anything(), 'g1', 500_000);
  });

  it('tells a video uploader where to put its poster frame', async () => {
    const id = await conversationInG1();

    const res = await as(TOM)
      .post(`/api/chat/conversations/${id}/attachments/upload-url`)
      .send({ filename: 'clip.mp4', mimetype: 'video/mp4', sizeBytes: 5_000_000 });

    expect(res.body.data.posterUploadFileId).toMatch(/\/poster\.jpg$/);
  });

  it('offers no poster path for an image', async () => {
    const id = await conversationInG1();

    const res = await as(TOM).post(`/api/chat/conversations/${id}/attachments/upload-url`).send(image);

    expect(res.body.data.posterUploadFileId).toBeNull();
  });

  it.each([
    ['text/html'],
    ['application/octet-stream'],
    ['application/zip'],
    ['application/x-msdownload']
  ])('refuses %s, so only images, video, voice and documents can reach storage', async (mimetype) => {
    const id = await conversationInG1();

    const res = await as(TOM)
      .post(`/api/chat/conversations/${id}/attachments/upload-url`)
      .send({ filename: 'x', mimetype, sizeBytes: 100 });

    expect(res.status).toBe(400);
  });

  it.each([
    ['report.pdf', 'application/pdf'],
    ['letter.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['budget.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ['notes.odt', 'application/vnd.oasis.opendocument.text']
  ])('allows the document %s, with no poster path', async (filename, mimetype) => {
    const id = await conversationInG1();

    const res = await as(TOM)
      .post(`/api/chat/conversations/${id}/attachments/upload-url`)
      .send({ filename, mimetype, sizeBytes: 5_000_000 });

    expect(res.status).toBe(201);
    expect(res.body.data.posterUploadFileId).toBeNull();
  });

  it.each([
    ['voice.weba', 'audio/webm'],
    ['voice.m4a', 'audio/mp4'],
    ['voice.ogg', 'audio/ogg']
  ])('allows the voice message %s, with no poster path', async (filename, mimetype) => {
    const id = await conversationInG1();

    const res = await as(TOM)
      .post(`/api/chat/conversations/${id}/attachments/upload-url`)
      .send({ filename, mimetype, sizeBytes: 400_000 });

    expect(res.status).toBe(201);
    expect(res.body.data.posterUploadFileId).toBeNull();
  });

  it('refuses a voice message over its ceiling', async () => {
    const id = await conversationInG1();

    const res = await as(TOM)
      .post(`/api/chat/conversations/${id}/attachments/upload-url`)
      .send({ filename: 'voice.weba', mimetype: 'audio/webm', sizeBytes: 20 * 1024 * 1024 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/too large/);
  });

  it('refuses a document over its ceiling', async () => {
    const id = await conversationInG1();

    const res = await as(TOM)
      .post(`/api/chat/conversations/${id}/attachments/upload-url`)
      .send({ filename: 'big.pdf', mimetype: 'application/pdf', sizeBytes: 30 * 1024 * 1024 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/too large/);
  });

  it('refuses an image over the per-file ceiling', async () => {
    const id = await conversationInG1();

    const res = await as(TOM)
      .post(`/api/chat/conversations/${id}/attachments/upload-url`)
      .send({ ...image, sizeBytes: 30 * 1024 * 1024 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/too large/);
  });

  it('allows a video the image ceiling would have refused', async () => {
    const id = await conversationInG1();

    const res = await as(TOM)
      .post(`/api/chat/conversations/${id}/attachments/upload-url`)
      .send({ filename: 'clip.mp4', mimetype: 'video/mp4', sizeBytes: 30 * 1024 * 1024 });

    expect(res.status).toBe(201);
  });

  it('refuses an upload URL to someone outside the group', async () => {
    const id = await conversationInG1();

    const res = await as(PERSIK).post(`/api/chat/conversations/${id}/attachments/upload-url`).send(image);

    expect(res.status).toBe(404);
  });

  it('meters the bytes once the message carrying them exists, by what is really stored', async () => {
    const id = await conversationInG1();
    (storedSize as jest.Mock).mockResolvedValueOnce(500_000);

    const sent = await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({
        clientId: clientId(),
        // Says one byte; file-service holds half a megabyte.
        attachments: [{ fileId: `chat/g1/${id}/abc/original.jpg`, mimetype: 'image/jpeg', sizeBytes: 1 }]
      });

    expect(recordStoredBytes).toHaveBeenCalledWith('g1', 500_000);
    expect(sent.body.data.attachments[0].sizeBytes).toBe(500_000);
  });

  it('refuses a message whose upload never finished', async () => {
    const id = await conversationInG1();
    (storedSize as jest.Mock).mockResolvedValueOnce(null);

    const res = await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({
        clientId: clientId(),
        attachments: [{ fileId: `chat/g1/${id}/abc/original.jpg`, mimetype: 'image/jpeg', sizeBytes: 100 }]
      });

    expect(res.status).toBe(400);
    expect(recordStoredBytes).not.toHaveBeenCalled();
  });

  it('asks for an upload URL good for no more than the size the quota was checked against', async () => {
    const id = await conversationInG1();

    await as(TOM).post(`/api/chat/conversations/${id}/attachments/upload-url`).send(image);

    expect(getUploadUrl).toHaveBeenCalledWith(expect.any(String), 'image/jpeg', 15, image.sizeBytes);
  });

  it('hands back signed URLs with the thread, one batch for the page', async () => {
    const id = await conversationInG1();
    await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({
        clientId: clientId(),
        attachments: [{ fileId: `chat/g1/${id}/abc/original.jpg`, mimetype: 'image/jpeg', sizeBytes: 100 }]
      });

    const res = await as(IRJA).get(`/api/chat/conversations/${id}/messages`);

    expect(res.body.data.messages[0].attachments[0].url).toContain('https://files.test/d/');
  });

  it('deletes the files and releases the bytes when a message is deleted', async () => {
    const id = await conversationInG1();
    (storedSize as jest.Mock).mockResolvedValueOnce(500_000);
    const sent = await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({
        clientId: clientId(),
        attachments: [{ fileId: `chat/g1/${id}/abc/original.jpg`, mimetype: 'image/jpeg', sizeBytes: 500_000 }]
      });

    await as(TOM).delete(`/api/chat/conversations/${id}/messages/${sent.body.data.id}`);

    // Keeping files nobody can see would charge the owner for storage they
    // cannot reach or free.
    expect(deleteFolder).toHaveBeenCalledWith(`chat/g1/${id}/abc`);
    expect(releaseStoredBytes).toHaveBeenCalledWith('g1', 500_000);
  });

  it('deletes a video poster that was uploaded into a folder of its own', async () => {
    const id = await conversationInG1();
    const sent = await as(TOM)
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

    await as(TOM).delete(`/api/chat/conversations/${id}/messages/${sent.body.data.id}`);

    expect(deleteFolder).toHaveBeenCalledWith(`chat/g1/${id}/clip`);
    expect(deleteFolder).toHaveBeenCalledWith(`chat/g1/${id}/still`);
  });

  it.each([
    ['another group', (id: string) => ({ fileId: `chat/g9/${id}/abc/original.jpg` })],
    ['another module', () => ({ fileId: 'album/g1/secret/original.jpg' })],
    ['a climb out with ..', (id: string) => ({ fileId: `chat/g1/${id}/../../g9/x/original.jpg` })],
    ['a foreign thumbnail', (id: string) => ({ fileId: `chat/g1/${id}/abc/original.jpg`, thumbnailFileId: 'album/g1/x.webp' })]
  ])('refuses a message carrying a file from %s', async (_label, file) => {
    const id = await conversationInG1();

    const res = await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({ clientId: clientId(), attachments: [{ ...file(id), mimetype: 'image/jpeg', sizeBytes: 100 }] });

    // Otherwise the service would sign a download URL for it, and delete its
    // folder when the message was unsent.
    expect(res.status).toBe(400);
    expect(await Message.countDocuments()).toBe(0);
  });

  it('still deletes the message when the file delete fails', async () => {
    const id = await conversationInG1();
    (deleteFolder as jest.Mock).mockRejectedValueOnce(new Error('file-service down'));
    const sent = await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({
        clientId: clientId(),
        attachments: [{ fileId: `chat/g1/${id}/abc/original.jpg`, mimetype: 'image/jpeg', sizeBytes: 100 }]
      });

    const res = await as(TOM).delete(`/api/chat/conversations/${id}/messages/${sent.body.data.id}`);

    // An orphaned file is a job for reconciliation, not a reason to leave the
    // message visible.
    expect(res.status).toBe(204);
  });

  it('refuses a thumbnail request for a file outside this conversation', async () => {
    const id = await conversationInG1();

    const res = await as(TOM)
      .post(`/api/chat/conversations/${id}/attachments/thumbnail`)
      .send({ fileId: 'chat/g9/other/abc/original.jpg', mimetype: 'image/jpeg' });

    // Without this the route would read and rewrite any path in storage.
    expect(res.status).toBe(400);
  });

  it('refuses a thumbnail request that tries to climb out with ..', async () => {
    const id = await conversationInG1();

    const res = await as(TOM)
      .post(`/api/chat/conversations/${id}/attachments/thumbnail`)
      .send({ fileId: `chat/g1/${id}/../../../etc/passwd`, mimetype: 'image/jpeg' });

    expect(res.status).toBe(400);
  });

  it('refuses more than ten attachments on one message', async () => {
    const id = await conversationInG1();
    const many = Array.from({ length: 11 }, (_, i) => ({
      fileId: `chat/g1/${id}/a${i}/original.jpg`,
      mimetype: 'image/jpeg',
      sizeBytes: 100
    }));

    const res = await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({ clientId: clientId(), attachments: many });

    expect(res.status).toBe(400);
  });
});
