import { describe, expect, it } from 'vite-plus/test';
import { render, screen } from '@testing-library/react';
import { SeenMarker, placeSeenMarkers } from './SeenMarker';
import type { ConversationMember, ThreadMessage } from '../../types';

const message = (
  id: string,
  senderId: string,
  createdAt: string,
  extra: Partial<ThreadMessage> = {}
): ThreadMessage => ({
  id,
  conversationId: 'c1',
  senderId,
  senderEmail: '',
  senderName: '',
  kind: 'text',
  body: id,
  attachments: [],
  replyTo: null,
  reactions: [],
  clientId: id,
  editedAt: null,
  deletedAt: null,
  createdAt,
  delivery: 'sent',
  ...extra
});

const members: ConversationMember[] = [
  { userId: 'u-tom', email: 'tom@example.com', name: 'Tom', joinedAt: '' },
  { userId: 'u-irja', email: 'irja@example.com', name: 'Irja', picture: 'irja.jpg', joinedAt: '' }
];

const thread = [
  message('m1', 'u-tom', '2026-09-21T10:00:00Z'),
  message('m2', 'u-tom', '2026-09-21T10:01:00Z'),
  message('m3', 'u-tom', '2026-09-21T10:02:00Z')
];

const readTo = (id: string | null, at = '2026-09-21T10:05:00Z') => ({
  'u-irja': { userId: 'u-irja', lastReadMessageId: id, lastReadAt: at }
});

describe('placeSeenMarkers', () => {
  it('puts the marker under the message they read up to, and nowhere else', () => {
    const placed = placeSeenMarkers(thread, readTo('m2'), members);

    expect([...placed.keys()]).toEqual(['m2']);
    expect(placed.get('m2')).toEqual([
      { userId: 'u-irja', name: 'Irja', picture: 'irja.jpg', at: '2026-09-21T10:05:00Z' }
    ]);
  });

  it('moves it back past their own messages to the last one of yours they saw', () => {
    const withReply = [...thread, message('m4', 'u-irja', '2026-09-21T10:03:00Z')];

    expect([...placeSeenMarkers(withReply, readTo('m4'), members).keys()]).toEqual(['m3']);
  });

  it('places it by time when the message it names is not loaded', () => {
    // Their cursor points at something deleted or further back than the page.
    const placed = placeSeenMarkers(thread, readTo('gone', '2026-09-21T10:01:30Z'), members);

    expect([...placed.keys()]).toEqual(['m2']);
  });

  it('never marks a message still on its way', () => {
    const pending = [...thread, message('pending-x', 'u-tom', '2026-09-21T10:04:00Z', { delivery: 'pending' })];

    expect([...placeSeenMarkers(pending, readTo(null), members).keys()]).toEqual(['m3']);
  });

  it('shows nothing for someone who has read nothing on screen', () => {
    expect(placeSeenMarkers(thread, readTo(null, '2026-09-20T00:00:00Z'), members).size).toBe(0);
  });
});

describe('SeenMarker', () => {
  it('says who saw it and when, on a 24-hour clock', () => {
    const today = new Date();
    today.setHours(14, 5, 0, 0);
    render(<SeenMarker seers={[{ userId: 'u-irja', name: 'Irja', picture: 'irja.jpg', at: today.toISOString() }]} />);

    expect(screen.getByRole('status', { name: 'Seen by Irja, 14:05' })).toBeInTheDocument();
    expect(screen.getByText('Seen 14:05')).toBeInTheDocument();
  });
});
