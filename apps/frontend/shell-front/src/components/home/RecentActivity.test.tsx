import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecentActivity, entryTitle, whenLabel } from './RecentActivity';
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
