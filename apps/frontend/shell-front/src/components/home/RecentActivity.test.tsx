import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecentActivity, entryTitle, whenLabel, windowEntries } from './RecentActivity';
import type { RecentActivity as Entry } from '../../services/homeApi';

const entry = (over: Partial<Entry> = {}): Entry => ({
  _id: 'e1',
  date: '2026-09-20T18:00:00Z',
  typeId: { _id: 't1', name: 'Dining', color: '#e11d48' },
  ...over
});

describe('whenLabel', () => {
  const now = new Date('2026-09-20T12:00:00Z');

  it('says Today and Yesterday rather than a date', () => {
    expect(whenLabel('2026-09-20T18:00:00Z', now)).toBe('Today');
    expect(whenLabel('2026-09-19T08:00:00Z', now)).toBe('Yesterday');
  });

  it('counts days inside the week', () => {
    expect(whenLabel('2026-09-17T08:00:00Z', now)).toBe('3 days ago');
  });

  it('falls back to a date once counting days stops helping', () => {
    expect(whenLabel('2026-08-30T08:00:00Z', now)).toBe('30 Aug');
  });

  it('says nothing for a date it cannot read', () => {
    expect(whenLabel('not a date', now)).toBe('');
  });
});

describe('entryTitle', () => {
  it('uses what was written', () => {
    expect(entryTitle(entry({ description: 'Sushi House' }))).toBe('Sushi House');
  });

  it('falls back to the hours and the kind for an entry that counts them', () => {
    expect(entryTitle(entry({ hours: 2, typeId: { _id: 't2', name: 'Together' } }))).toBe('2h Together');
  });

  it('falls back to the kind alone for a presence marker', () => {
    expect(entryTitle(entry())).toBe('Dining');
  });

  it('does not show whitespace as a description', () => {
    expect(entryTitle(entry({ description: '   ' }))).toBe('Dining');
  });
});

const NOW = new Date('2026-09-20T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

describe('windowEntries', () => {
  it('keeps the last week', () => {
    const week = windowEntries([entry({ _id: 'a', date: daysAgo(1) }), entry({ _id: 'b', date: daysAgo(6) })], NOW);

    expect(week.withinWeek).toBe(true);
    expect(week.entries).toHaveLength(2);
  });

  it('drops anything older than the week', () => {
    const week = windowEntries([entry({ _id: 'a', date: daysAgo(2) }), entry({ _id: 'b', date: daysAgo(9) })], NOW);

    expect(week.entries.map((e) => e._id)).toEqual(['a']);
  });

  it('treats a future-dated entry as a plan, not as this week', () => {
    const week = windowEntries(
      [entry({ _id: 'plan', date: daysAgo(-3) }), entry({ _id: 'a', date: daysAgo(30) })],
      NOW
    );

    expect(week.withinWeek).toBe(false);
    expect(week.entries.map((e) => e._id)).toEqual(['plan', 'a']);
  });

  it('falls back to the latest few on a quiet week, and stops claiming the week', () => {
    // An empty section on the home page reads as a broken one.
    const week = windowEntries([entry({ _id: 'a', date: daysAgo(20) }), entry({ _id: 'b', date: daysAgo(40) })], NOW);

    expect(week.withinWeek).toBe(false);
    expect(week.entries).toHaveLength(2);
  });

  it('caps how much of a busy week it shows', () => {
    const busy = Array.from({ length: 12 }, (_, i) => entry({ _id: `e${i}`, date: daysAgo(1) }));

    expect(windowEntries(busy, NOW).entries).toHaveLength(6);
  });

  it('ignores an entry whose date cannot be read', () => {
    expect(windowEntries([entry({ _id: 'bad', date: 'not a date' })], NOW).entries).toEqual([]);
  });
});

it('heads the section with the window it is actually showing', () => {
  // Seven days back from now, not the calendar week: the two mean different
  // things, and on a Monday morning the calendar one is empty.
  render(<RecentActivity activities={[entry({ date: daysAgo(2) })]} onOpen={vi.fn()} now={NOW} />);

  expect(screen.getByText('Last 7 days')).toBeInTheDocument();
});

it('says what it is showing when the week was empty', () => {
  render(<RecentActivity activities={[entry({ date: daysAgo(25) })]} onOpen={vi.fn()} now={NOW} />);

  expect(screen.getByText('Last logged')).toBeInTheDocument();
});

it('lists the entries and opens the journal', async () => {
  const onOpen = vi.fn();
  render(
    <RecentActivity
      activities={[
        entry({ _id: 'a', description: 'Sushi House', location: { name: 'Tallinn' } }),
        entry({ _id: 'b', description: 'Futurama' })
      ]}
      onOpen={onOpen}
    />
  );

  expect(screen.getByText('Sushi House')).toBeInTheDocument();
  expect(screen.getByText('Tallinn')).toBeInTheDocument();
  expect(screen.getByText('Futurama')).toBeInTheDocument();

  await userEvent.click(screen.getByText('Sushi House'));

  expect(onOpen).toHaveBeenCalledWith('/relationship/journal');
});

it('renders nothing when nothing has been logged', () => {
  const { container } = render(<RecentActivity activities={[]} onOpen={vi.fn()} />);

  expect(container).toBeEmptyDOMElement();
});
