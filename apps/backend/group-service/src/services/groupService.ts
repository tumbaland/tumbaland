import { Group, IGroup, GroupRole } from '../models/Group';

export async function createGroup(creatorEmail: string, name: string): Promise<IGroup> {
  const group = await Group.create({
    name: String(name).trim(),
    createdBy: creatorEmail.toLowerCase(),
    members: [{ email: creatorEmail.toLowerCase(), role: 'owner', joinedAt: new Date() }]
  });
  return group;
}

export async function listMyGroups(email: string): Promise<IGroup[]> {
  return Group.find({ 'members.email': email.toLowerCase() }).sort({ updatedAt: -1 });
}

export async function getGroupIfMember(groupId: string, email: string): Promise<IGroup> {
  const group = await Group.findById(groupId);
  if (!group) throw new Error('NOT_FOUND');
  if (!group.members.some((m) => m.email === email.toLowerCase())) throw new Error('FORBIDDEN');
  return group;
}

export function memberRole(group: IGroup, email: string): GroupRole | undefined {
  return group.members.find((m) => m.email === email.toLowerCase())?.role as GroupRole | undefined;
}

export async function inviteMember(
  groupId: string,
  actingEmail: string,
  inviteEmail: string,
  role: GroupRole = 'member'
) {
  const crypto = await import('crypto');
  const group = await Group.findById(groupId);
  if (!group) throw new Error('NOT_FOUND');
  const myRole = memberRole(group, actingEmail);
  if (!myRole || (myRole !== 'owner' && myRole !== 'admin')) throw new Error('FORBIDDEN');
  const token = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  group.invites = group.invites || [];
  group.invites.push({ email: inviteEmail.toLowerCase(), role, token, expiresAt, createdAt: new Date() } as any);
  await group.save();
  return { token, expiresAt };
}

export async function acceptInvite(groupId: string, email: string, token: string): Promise<IGroup> {
  const group = await Group.findById(groupId);
  if (!group) throw new Error('NOT_FOUND');
  const invite = (group.invites || []).find(
    (i) => i.token === token && i.email === email.toLowerCase() && i.expiresAt > new Date()
  );
  if (!invite) throw new Error('BAD_REQUEST');
  if (!group.members.some((m) => m.email === email.toLowerCase())) {
    group.members.push({ email: email.toLowerCase(), role: invite.role, joinedAt: new Date() } as any);
  }
  group.invites = (group.invites || []).filter((i) => i.token !== token);
  await group.save();
  return group;
}

export async function updateMemberRole(
  groupId: string,
  actingEmail: string,
  memberEmail: string,
  role: GroupRole
): Promise<IGroup> {
  const group = await Group.findById(groupId);
  if (!group) throw new Error('NOT_FOUND');
  const myRole = memberRole(group, actingEmail);
  if (!myRole || (myRole !== 'owner' && myRole !== 'admin')) throw new Error('FORBIDDEN');
  const m = group.members.find((x) => x.email === memberEmail.toLowerCase());
  if (!m) throw new Error('MEMBER_NOT_FOUND');
  m.role = role;
  await group.save();
  return group;
}

export async function removeMember(groupId: string, actingEmail: string, targetEmail: string): Promise<IGroup> {
  const group = await Group.findById(groupId);
  if (!group) throw new Error('NOT_FOUND');
  const myRole = memberRole(group, actingEmail);
  if (!myRole) throw new Error('FORBIDDEN');
  if (actingEmail.toLowerCase() !== targetEmail.toLowerCase() && myRole === 'member') throw new Error('FORBIDDEN');
  group.members = group.members.filter((m) => m.email !== targetEmail.toLowerCase());
  await group.save();
  return group;
}

export async function checkMembership(
  groupId: string,
  email: string
): Promise<{ member: boolean; role: GroupRole | null }> {
  const group = await Group.findById(groupId);
  if (!group) throw new Error('NOT_FOUND');
  const m = group.members.find((x) => x.email === email.toLowerCase());
  return { member: !!m, role: (m?.role as GroupRole) || null };
}
