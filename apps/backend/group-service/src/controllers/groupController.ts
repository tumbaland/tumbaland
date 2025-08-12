import { Request, Response } from 'express';
import * as svc from '../services/groupService';
import { GroupRole } from '../models/Group';

const userEmail = (req: Request) => ((req as any).user?.email || '').toLowerCase();

export const createGroup = async (req: Request, res: Response) => {
  try {
    const email = userEmail(req);
    const { name } = req.body as { name: string };
    if (!name) return res.status(400).json({ success: false, message: 'name required' });
    const group = await svc.createGroup(email, name);
    res.status(201).json({ success: true, data: group });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const listMine = async (req: Request, res: Response) => {
  try {
    const groups = await svc.listMyGroups(userEmail(req));
    res.json({ success: true, data: groups });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const getOne = async (req: Request, res: Response) => {
  try {
    const group = await svc.getGroupIfMember(req.params.id, userEmail(req));
    res.json({ success: true, data: group });
  } catch (e: any) {
    if (e.message === 'NOT_FOUND') return res.status(404).json({ success: false, message: 'not found' });
    if (e.message === 'FORBIDDEN') return res.status(403).json({ success: false, message: 'forbidden' });
    res.status(500).json({ success: false, message: e.message });
  }
};

export const invite = async (req: Request, res: Response) => {
  try {
    const { inviteEmail, role } = req.body as { inviteEmail: string; role?: GroupRole };
    const data = await svc.inviteMember(req.params.id, userEmail(req), inviteEmail, role);
    res.status(201).json({ success: true, data });
  } catch (e: any) {
    if (e.message === 'NOT_FOUND') return res.status(404).json({ success: false, message: 'not found' });
    if (e.message === 'FORBIDDEN') return res.status(403).json({ success: false, message: 'forbidden' });
    res.status(500).json({ success: false, message: e.message });
  }
};

export const accept = async (req: Request, res: Response) => {
  try {
    const group = await svc.acceptInvite(req.params.id, userEmail(req), (req.body as any).token);
    res.json({ success: true, data: group });
  } catch (e: any) {
    if (e.message === 'BAD_REQUEST') return res.status(400).json({ success: false, message: 'invalid invite' });
    if (e.message === 'NOT_FOUND') return res.status(404).json({ success: false, message: 'not found' });
    res.status(500).json({ success: false, message: e.message });
  }
};

export const updateRole = async (req: Request, res: Response) => {
  try {
    const group = await svc.updateMemberRole(
      req.params.id,
      userEmail(req),
      req.params.memberEmail,
      (req.body as any).role
    );
    res.json({ success: true, data: group });
  } catch (e: any) {
    if (e.message === 'NOT_FOUND') return res.status(404).json({ success: false, message: 'not found' });
    if (e.message === 'FORBIDDEN') return res.status(403).json({ success: false, message: 'forbidden' });
    if (e.message === 'MEMBER_NOT_FOUND') return res.status(404).json({ success: false, message: 'member not found' });
    res.status(500).json({ success: false, message: e.message });
  }
};

export const removeMember = async (req: Request, res: Response) => {
  try {
    const group = await svc.removeMember(req.params.id, userEmail(req), req.params.memberEmail);
    res.json({ success: true, data: group });
  } catch (e: any) {
    if (e.message === 'NOT_FOUND') return res.status(404).json({ success: false, message: 'not found' });
    if (e.message === 'FORBIDDEN') return res.status(403).json({ success: false, message: 'forbidden' });
    res.status(500).json({ success: false, message: e.message });
  }
};

export const membership = async (req: Request, res: Response) => {
  try {
    const result = await svc.checkMembership(req.params.id, userEmail(req));
    res.json({ success: true, ...result });
  } catch (e: any) {
    if (e.message === 'NOT_FOUND') return res.status(404).json({ success: false, message: 'not found' });
    res.status(500).json({ success: false, message: e.message });
  }
};
