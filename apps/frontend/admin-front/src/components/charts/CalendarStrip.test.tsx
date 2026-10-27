import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vite-plus/test';
import { CalendarStrip } from './CalendarStrip';

describe('CalendarStrip', () => {
  it('draws one square for every day in the period', () => {
    render(<CalendarStrip from="2026-10-19" to="2026-10-27" days={[]} />);

    expect(screen.getAllByRole('img')).toHaveLength(9);
    expect(screen.getByRole('group', { name: /Days active/ })).toBeInTheDocument();
  });

  it('says for each square whether the person was there, and how often', () => {
    render(
      <CalendarStrip
        from="2026-10-25"
        to="2026-10-27"
        days={[
          { day: '2026-10-26', visits: 1, backfilled: false },
          { day: '2026-10-27', visits: 3, backfilled: false }
        ]}
      />
    );

    expect(screen.getByRole('img', { name: /25.*: not here$/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /26.*: 1 visit$/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /27.*: 3 visits$/ })).toBeInTheDocument();
  });

  it('marks a day that was filled in from what the person wrote', () => {
    render(
      <CalendarStrip from="2026-10-27" to="2026-10-27" days={[{ day: '2026-10-27', visits: 1, backfilled: true }]} />
    );

    expect(screen.getByRole('img', { name: /counted from what they wrote/ })).toBeInTheDocument();
    expect(screen.getByText(/Striped days were filled in/)).toBeInTheDocument();
  });

  it('starts the first week on the right weekday, with Monday on top', () => {
    // Wed 21 Oct: two empty cells for Monday and Tuesday come first.
    const { container } = render(<CalendarStrip from="2026-10-21" to="2026-10-22" days={[]} />);

    const group = screen.getByRole('group', { name: /Days active/ });
    expect(group.children).toHaveLength(2 + 2);
    expect(container.querySelectorAll('[aria-hidden]').length).toBeGreaterThanOrEqual(2);
  });
});
