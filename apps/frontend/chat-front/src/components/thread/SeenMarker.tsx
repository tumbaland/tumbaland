import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { ink } from '@tumbaland/frontend-core';
import type { ConversationMember, ReadReceipt, ThreadMessage } from '../../types';
import { MemberAvatar } from './MemberAvatar';
import { whenLabel } from './clock';

export interface Seer {
  userId: string;
  name: string;
  picture?: string | null;
  at: string;
}

/**
 * Where each of the others' "seen" marker goes: message id to who has seen it.
 *
 * A marker sits under the newest message the person has read that someone
 * else wrote. Under their own message it would say nothing, so it walks back
 * to the last one of yours they have seen. When their cursor points at a
 * message not on screen (further back than what is loaded, or deleted), the
 * read time places it instead.
 */
export function placeSeenMarkers(
  messages: ThreadMessage[],
  reads: Record<string, ReadReceipt>,
  members: ConversationMember[]
): Map<string, Seer[]> {
  const placed = new Map<string, Seer[]>();
  // System lines are notes about the conversation; "Seen" under one says nothing.
  const stored = messages.filter(
    (message) => message.delivery !== 'pending' && message.delivery !== 'failed' && message.kind !== 'system'
  );

  for (const read of Object.values(reads)) {
    let index = read.lastReadMessageId ? stored.findIndex((message) => message.id === read.lastReadMessageId) : -1;
    if (index === -1) {
      const readAt = new Date(read.lastReadAt).getTime();
      for (let i = stored.length - 1; i >= 0; i--) {
        if (new Date(stored[i]!.createdAt).getTime() <= readAt) {
          index = i;
          break;
        }
      }
    }
    while (index >= 0 && stored[index]!.senderId === read.userId) index--;
    if (index < 0) continue;

    const member = members.find((candidate) => candidate.userId === read.userId);
    const target = stored[index]!.id;
    placed.set(target, [
      ...(placed.get(target) ?? []),
      { userId: read.userId, name: member?.name || member?.email || 'Someone', picture: member?.picture, at: read.lastReadAt }
    ]);
  }
  return placed;
}

/** The small pictures and "Seen 14:05" under the last message someone has read. */
export function SeenMarker({ seers }: { seers: Seer[] }) {
  const latest = seers.reduce((newest, seer) => (seer.at > newest ? seer.at : newest), seers[0]!.at);
  const names = seers.map((seer) => seer.name).join(', ');

  return (
    <Box
      role="status"
      aria-label={`Seen by ${names}, ${whenLabel(latest)}`}
      sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5, px: 1, mt: 0.25 }}
    >
      {seers.map((seer) => (
        <MemberAvatar key={seer.userId} name={seer.name} picture={seer.picture} size={16} />
      ))}
      <Typography variant="caption" sx={{ color: ink.muted, fontSize: 11 }} aria-hidden>
        Seen {whenLabel(latest)}
      </Typography>
    </Box>
  );
}
