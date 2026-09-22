import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThreadHeader, statusLine } from './ThreadHeader';
import { activeLabel } from './clock';
import type { ConversationMember, Presence } from '../../types';

const now = new Date('2026-09-22T12:00:00');
const member = (userId: string, name: string): ConversationMember => ({ userId, email: `${userId}@x`, name, joinedAt: '' });
const TOM = member('u-tom', 'Tom');
const IRJA = member('u-irja', 'Irja');
const MARI = member('u-mari', 'Mari');
const at = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60_000).toISOString();
const seen = (userId: string, online: boolean, lastActiveAt: string | null): Presence => ({ userId, online, lastActiveAt });

describe('activeLabel', () => {
  it.each([
    [true, at(0), 'Active now'],
    [false, at(0.2), 'Active 1 min ago'],
    [false, at(5), 'Active 5 min ago'],
    [false, at(59), 'Active 59 min ago'],
    [false, at(180), 'Active 3 h ago']
  ])('online %s, last %s reads "%s"', (online, last, label) => {
    expect(activeLabel(online, last, now)).toBe(label);
  });

  it('says yesterday, then the day', () => {
    expect(activeLabel(false, '2026-09-21T09:00:00', now)).toBe('Active yesterday');
    expect(activeLabel(false, '2026-09-19T09:00:00', now)).toMatch(/^Active on \S+/);
  });

  it('says nothing for someone never seen', () => {
    expect(activeLabel(false, null, now)).toBeNull();
  });
});

describe('statusLine', () => {
  it('puts typing ahead of everything else', () => {
    expect(statusLine([IRJA], { 'u-irja': seen('u-irja', true, at(0)) }, ['Irja'], now)).toBe('typing…');
  });

  it('names who is typing in a group', () => {
    expect(statusLine([IRJA, MARI], {}, ['Mari'], now)).toBe('Mari is typing…');
  });

  it('shows when the other person was last around', () => {
    expect(statusLine([IRJA], { 'u-irja': seen('u-irja', false, at(5)) }, [], now)).toBe('Active 5 min ago');
  });

  it('counts who is online in a group', () => {
    const presence = { 'u-irja': seen('u-irja', true, at(0)), 'u-mari': seen('u-mari', false, at(9)) };
    expect(statusLine([IRJA, MARI], presence, [], now)).toBe('1 online');
  });
});

describe('ThreadHeader', () => {
  it('names the other person, never the caller', () => {
    render(<ThreadHeader members={[TOM, IRJA]} currentUserId="u-tom" title="" presence={{}} typingNames={[]} />);
    expect(screen.getByText('Irja')).toBeInTheDocument();
    expect(screen.queryByText('Tom')).not.toBeInTheDocument();
  });

  it('draws the green dot only while they are online', () => {
    const { container, rerender } = render(
      <ThreadHeader
        members={[TOM, IRJA]}
        currentUserId="u-tom"
        title=""
        presence={{ 'u-irja': seen('u-irja', true, new Date().toISOString()) }}
        typingNames={[]}
      />
    );
    expect(container.querySelector('.MuiBadge-dot')).not.toHaveClass('MuiBadge-invisible');
    expect(screen.getByText('Active now')).toBeInTheDocument();

    rerender(
      <ThreadHeader
        members={[TOM, IRJA]}
        currentUserId="u-tom"
        title=""
        presence={{ 'u-irja': seen('u-irja', false, null) }}
        typingNames={[]}
      />
    );
    expect(container.querySelector('.MuiBadge-dot')).toHaveClass('MuiBadge-invisible');
  });

  it('draws nothing before the members have loaded', () => {
    const { container } = render(<ThreadHeader members={[]} currentUserId="u-tom" title="" presence={{}} typingNames={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
