import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CollageCard } from './CollageCard';
import type { ThreadMessage } from '../../types';

const card: ThreadMessage = {
  id: 'm1',
  conversationId: 'c1',
  senderId: 'u-irja',
  senderEmail: '',
  senderName: 'Irja',
  kind: 'collage',
  body: '',
  attachments: [],
  replyTo: null,
  collage: { id: 'k1', title: 'Rome' },
  reactions: [],
  clientId: 'client-1',
  editedAt: null,
  deletedAt: null,
  createdAt: new Date(Date.UTC(2026, 8, 24, 10, 0)).toISOString()
};

describe('CollageCard', () => {
  it('invites the others to join, and opens the collage', async () => {
    const onJoin = vi.fn();
    render(<CollageCard message={card} mine={false} onJoin={onJoin} />);

    expect(screen.getByText('Rome')).toBeInTheDocument();
    expect(screen.getByText(/Irja started a collage/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Join' }));

    expect(onJoin).toHaveBeenCalledWith('k1');
  });

  it('offers the one who made it to open it again', () => {
    render(<CollageCard message={card} mine onJoin={() => {}} />);

    expect(screen.getByText(/You started a collage/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument();
  });
});
