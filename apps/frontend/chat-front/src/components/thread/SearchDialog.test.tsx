import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Message } from '../../types';

const search = vi.fn();
vi.mock('../../services/chatApi', () => ({
  chatApi: { search: (...args: unknown[]) => search(...args) }
}));

import { SearchDialog } from './SearchDialog';

const result = (id: string, body: string, senderId = 'u-irja'): Message => ({
  id,
  conversationId: 'c1',
  senderId,
  senderEmail: '',
  senderName: 'Irja (old name)',
  kind: 'text',
  body,
  attachments: [],
  replyTo: null,
  reactions: [],
  clientId: id,
  editedAt: null,
  deletedAt: null,
  createdAt: new Date().toISOString()
});

const members = [
  { userId: 'u-irja', name: 'Irja', email: 'irja@example.com', joinedAt: '' },
  { userId: 'u-tom', name: 'Tom', email: 'tom@example.com', joinedAt: '' }
];

function renderDialog(onPick = vi.fn()) {
  render(
    <SearchDialog open onClose={() => {}} conversationId="c1" members={members} currentUserId="u-tom" onPick={onPick} />
  );
  return { onPick, input: screen.getByLabelText('Search messages') };
}

beforeEach(() => {
  search.mockReset();
});

describe('SearchDialog', () => {
  it('searches this conversation and shows who wrote each match', async () => {
    search.mockResolvedValue([result('m2', 'the restaurant again?'), result('m1', 'That Restaurant', 'u-tom')]);
    const { input } = renderDialog();

    await userEvent.type(input, 'rest');

    const list = await screen.findByRole('list', { name: 'Search results' });
    expect(search).toHaveBeenLastCalledWith('rest', 'c1');
    const rows = within(list).getAllByRole('button');
    expect(rows[0]).toHaveTextContent('Irja');
    expect(rows[1]).toHaveTextContent('You');
  });

  it('marks the part of the message that matched', async () => {
    search.mockResolvedValue([result('m1', 'the restaurant again?')]);
    const { input } = renderDialog();

    await userEvent.type(input, 'REST');

    const mark = await screen.findByText('rest', { selector: 'mark' });
    expect(mark).toBeInTheDocument();
  });

  it('marks a Russian match in any case, and ё found by е', async () => {
    search.mockResolvedValue([result('m1', 'Встречаемся в Кафе? Ещё не знаю')]);
    const { input } = renderDialog();

    await userEvent.type(input, 'кафе');
    expect(await screen.findByText('Кафе', { selector: 'mark' })).toBeInTheDocument();

    await userEvent.clear(input);
    await userEvent.type(input, 'еще');
    expect(await screen.findByText('Ещё', { selector: 'mark' })).toBeInTheDocument();
    expect(search).toHaveBeenLastCalledWith('еще', 'c1');
  });

  it('asks nothing for a single letter', async () => {
    const { input } = renderDialog();

    await userEvent.type(input, 'r');
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(search).not.toHaveBeenCalled();
  });

  it('says when nothing matches', async () => {
    search.mockResolvedValue([]);
    const { input } = renderDialog();

    await userEvent.type(input, 'zebra');

    expect(await screen.findByText('No messages with “zebra”.')).toBeInTheDocument();
  });

  it('does not claim the new word found nothing before its search has answered', async () => {
    search.mockResolvedValueOnce([]).mockReturnValueOnce(new Promise(() => {}));
    const { input } = renderDialog();

    await userEvent.type(input, 'zebra');
    await screen.findByText('No messages with “zebra”.');
    await userEvent.type(input, 's');
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(search).toHaveBeenLastCalledWith('zebras', 'c1');
    expect(screen.queryByText('No messages with “zebras”.')).not.toBeInTheDocument();
  });

  it('says so when search fails', async () => {
    search.mockRejectedValue(new Error('offline'));
    const { input } = renderDialog();

    await userEvent.type(input, 'zebra');

    expect(await screen.findByText(/Search is not working right now/)).toBeInTheDocument();
  });

  it('hands the tapped result to the thread', async () => {
    const found = result('m2', 'the restaurant again?');
    search.mockResolvedValue([found]);
    const { input, onPick } = renderDialog();

    await userEvent.type(input, 'rest');
    await userEvent.click(await screen.findByText(/again\?/));

    expect(onPick).toHaveBeenCalledWith(found);
  });
});
