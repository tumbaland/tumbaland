import { describe, expect, it, vi } from 'vite-plus/test';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReminderCard, planWhen } from './ReminderCard';
import type { ThreadMessage } from '../../types';

const card: ThreadMessage = {
  id: 'm1',
  conversationId: 'c1',
  senderId: 'tumbaland-reminders',
  senderEmail: 'reminders@tumbaland.eu',
  senderName: 'Reminder',
  kind: 'reminder',
  body: 'Concert on Friday 16 October at 19:00 · Saku Arena',
  attachments: [],
  replyTo: null,
  plan: {
    id: 'p1',
    title: 'Concert',
    date: '2026-10-16',
    time: '19:00',
    timeZone: 'Europe/Tallinn',
    place: 'Saku Arena'
  },
  reactions: [],
  clientId: 'plan-p1',
  editedAt: null,
  deletedAt: null,
  createdAt: new Date(Date.UTC(2026, 9, 16, 15, 0)).toISOString()
};

describe('ReminderCard', () => {
  it('says what is coming up, when and where, and opens it in the calendar', async () => {
    const onOpen = vi.fn();
    render(<ReminderCard message={card} onOpen={onOpen} />);

    expect(screen.getByText('Concert')).toBeInTheDocument();
    expect(screen.getByText(/at 19:00 · Saku Arena/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));

    expect(onOpen).toHaveBeenCalledWith('p1');
  });

  it('draws nothing without a plan', () => {
    const { container } = render(<ReminderCard message={{ ...card, plan: null }} onOpen={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('planWhen', () => {
  it('keeps the plan’s own calendar day, and leaves the time off an all-day plan', () => {
    expect(planWhen('2026-10-16', '19:00')).toMatch(/16.*at 19:00$/);
    expect(planWhen('2026-10-16', null)).not.toMatch(/at/);
  });
});
