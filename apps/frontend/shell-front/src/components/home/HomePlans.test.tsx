import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vite-plus/test';
import { HomePlans, whenLabel } from './HomePlans';
import type { HomePlan } from '../../services/homeApi';

const plan = (over: Partial<HomePlan> = {}): HomePlan => ({
  id: 'p1',
  title: 'Concert',
  date: '2026-10-16',
  endDate: null,
  time: '19:00',
  location: { label: 'Saku Arena' },
  ...over
});

describe('whenLabel', () => {
  it('says today, tomorrow, the weekday within a week, then the date', () => {
    expect(whenLabel(plan(), '2026-10-16')).toBe('Today at 19:00');
    expect(whenLabel(plan({ time: null }), '2026-10-15')).toBe('Tomorrow');
    expect(whenLabel(plan(), '2026-10-13')).toMatch(/^Fri.* at 19:00$/);
    expect(whenLabel(plan(), '2026-10-01')).toMatch(/16/);
  });

  it('says when a trip already under way ends', () => {
    expect(whenLabel(plan({ date: '2026-10-14', endDate: '2026-10-18', time: null }), '2026-10-16')).toMatch(
      /^Until Sun/
    );
  });
});

describe('HomePlans', () => {
  it('lists the plans and opens one on the journal’s calendar', async () => {
    const onOpen = vi.fn();
    render(<HomePlans plans={[plan()]} onOpen={onOpen} />);

    expect(screen.getByText('Plans')).toBeInTheDocument();
    expect(screen.getByText('Saku Arena')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Concert'));

    expect(onOpen).toHaveBeenCalledWith('/relationship/journal?view=calendar&plan=p1');
  });

  it('shows nothing while nothing is planned', () => {
    const { container } = render(<HomePlans plans={[]} onOpen={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
