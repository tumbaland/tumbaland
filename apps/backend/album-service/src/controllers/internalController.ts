import { Request, Response } from 'express';
import { NotFoundError, sendSuccess } from '@tumbaland/backend-core';
import * as chatAlbums from '../services/chatAlbumService';
import { createChatCollage as createCollageFromChat, type ChatCollageInput } from '../collage/chatCollage';

/** `GET /internal/groups/:groupId/albums` */
export const listGroupAlbums = async (req: Request, res: Response): Promise<void> => {
  sendSuccess(res, await chatAlbums.listGroupAlbums(req.params.groupId as string));
};

/** `GET /internal/groups/:groupId/albums/:albumId` */
export const getGroupAlbum = async (req: Request, res: Response): Promise<void> => {
  const album = await chatAlbums.getGroupAlbum(req.params.groupId as string, req.params.albumId as string);
  if (!album) throw new NotFoundError('Album not found');
  sendSuccess(res, album);
};

/** `POST /internal/groups/:groupId/albums` */
export const createGroupAlbum = async (req: Request, res: Response): Promise<void> => {
  const { name, userId } = req.body as { name: string; userId: string };
  sendSuccess(res, await chatAlbums.createGroupAlbum(req.params.groupId as string, userId, name), undefined, 201);
};

/** `POST /internal/groups/:groupId/collages`: "Make a collage together" from a chat. */
export const createChatCollage = async (req: Request, res: Response): Promise<void> => {
  const input = { ...(req.body as Omit<ChatCollageInput, 'groupId'>), groupId: req.params.groupId as string };
  sendSuccess(res, await createCollageFromChat(input), undefined, 201);
};

/** `POST /internal/chat-photos` */
export const addChatPhoto = async (req: Request, res: Response): Promise<void> => {
  sendSuccess(res, await chatAlbums.addChatPhoto(req.body as chatAlbums.ChatPhotoInput), undefined, 201);
};

/** `POST /internal/chat-photos/:messageId/move` */
export const moveChatPhotos = async (req: Request, res: Response): Promise<void> => {
  const { groupId, albumId, fileIds } = req.body as { groupId: string; albumId: string; fileIds?: string[] };
  sendSuccess(res, await chatAlbums.moveChatPhotos({ groupId, albumId, fileIds, messageId: req.params.messageId as string }));
};

/** `DELETE /internal/chat-photos/:messageId` (optionally `?fileId=` for one file) */
export const removeChatPhotos = async (req: Request, res: Response): Promise<void> => {
  const removed = await chatAlbums.removeChatPhotos(
    req.params.messageId as string,
    (req.query.fileId as string | undefined) || undefined
  );
  sendSuccess(res, { removed });
};
