import { Request, Response } from 'express';
import { BadRequestError, sendSuccess } from '@tumbaland/backend-core';
import * as svc from '../services/groupService';
import { GroupRole } from '../models/Group';

const userEmail = (req: Request) => {
  // For internal service requests, extract email from request body or params
  if (req.isInternalService) {
    return req.body?.userEmail || req.query?.userEmail || req.params?.userEmail;
  }
  // For user requests, extract from authenticated user
  return (req.user?.email || '').toLowerCase();
};

export const createGroup = async (req: Request, res: Response): Promise<void> => {
  const email = userEmail(req);
  if (!email) {
    throw new BadRequestError('User email required');
  }
  const { name } = req.body as { name: string };
  const group = await svc.createGroup(email, name);
  sendSuccess(res, group, undefined, 201);
};

export const listMine = async (req: Request, res: Response): Promise<void> => {
  const email = userEmail(req);
  if (!email) {
    throw new BadRequestError('User email required');
  }
  const groups = await svc.listMyGroups(email);
  sendSuccess(res, await svc.withMemberActivity(groups));
};

export const listMyDeleted = async (req: Request, res: Response): Promise<void> => {
  const email = userEmail(req);
  if (!email) {
    throw new BadRequestError('User email required');
  }
  const groups = await svc.listMyDeletedGroups(email);
  sendSuccess(res, groups);
};

export const getUserGroupIds = async (req: Request, res: Response): Promise<void> => {
  const email = userEmail(req);
  if (!email) {
    throw new BadRequestError('User email required');
  }
  const groups = await svc.listMyGroups(email);
  const groupIds = groups.map(group => group._id.toString());
  sendSuccess(res, groupIds);
};

export const getOne = async (req: Request, res: Response): Promise<void> => {
  const group = await svc.getGroupIfMember(req.params.id as string, userEmail(req));
  const [withActivity] = await svc.withMemberActivity([group]);
  sendSuccess(res, withActivity);
};

export const updateGroup = async (req: Request, res: Response): Promise<void> => {
  const { name } = req.body as { name: string };
  const group = await svc.updateGroup(req.params.id as string, userEmail(req), { name });
  sendSuccess(res, group);
};

export const deleteGroup = async (req: Request, res: Response): Promise<void> => {
  await svc.deleteGroup(req.params.id as string, userEmail(req));
  res.status(204).send();
};

export const restoreGroup = async (req: Request, res: Response): Promise<void> => {
  const group = await svc.restoreGroup(req.params.id as string, userEmail(req));
  sendSuccess(res, group);
};

export const permanentlyDeleteGroup = async (req: Request, res: Response): Promise<void> => {
  await svc.permanentlyDeleteGroup(req.params.id as string, userEmail(req));
  res.status(204).send();
};

// Membership changes need nothing from auth-service: every service asks
// group-service who belongs where (backend-core's currentGroupsOf, cached for
// seconds), so a change applies without re-signing anyone's token. They used
// to invalidate the member's tokens, which signed them out everywhere.
export const addMember = async (req: Request, res: Response): Promise<void> => {
  const { email, role } = req.body as { email: string; role?: GroupRole };
  const group = await svc.addMember(req.params.id as string, userEmail(req), email, role);

  sendSuccess(res, group, undefined, 201);
};

export const updateRole = async (req: Request, res: Response): Promise<void> => {
  const { role } = req.body as { role: GroupRole };
  const group = await svc.updateMemberRole(
    req.params.id as string,
    userEmail(req),
    req.params.memberEmail as string,
    role
  );

  sendSuccess(res, group);
};

export const removeMember = async (req: Request, res: Response): Promise<void> => {
  const group = await svc.removeMember(req.params.id as string, userEmail(req), req.params.memberEmail as string);

  sendSuccess(res, group);
};

/**
 * `GET /internal/groups/:id/owner` — service-to-service only.
 *
 * The quota subject for anything held in a group. Kept off `/api/groups` and
 * out of `getOne`'s shape on purpose: this answers without the caller having to
 * be a member (album-service asks on behalf of an uploader it is about to gate,
 * and a member's own email is not part of the question), and it returns three
 * scalars instead of the whole group document, which carries invite tokens.
 */
export const getOwner = async (req: Request, res: Response): Promise<void> => {
  const owner = await svc.getGroupOwner(req.params.id as string);
  res.json({ success: true, ...owner });
};

export const membership = async (req: Request, res: Response): Promise<void> => {
  const email = userEmail(req);
  const result = await svc.checkMembership(req.params.id as string, email);
  res.json({ success: true, ...result });
};
