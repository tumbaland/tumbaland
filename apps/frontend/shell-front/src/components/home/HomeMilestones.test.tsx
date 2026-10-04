import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vite-plus/test';
import { HomeMilestones, agoLabel, inLabel } from './HomeMilestones';
import type { Milestone, Milestones } from '../../services/homeApi';

const upcoming = (over: Partial<Milestone> = {}): Milestone => ({
  key: 'u1',
  label: '700 days together',
  target: 700,
  expectedOn: '2026-10-10',
  daysAway: 5,
  ...over
});

const reached = (over: Partial<Milestone> = {}): Milestone => ({
  key: 'r1',
  label: '100 dinners',
  target: 100,
  achievedOn: '2026-10-01',
  daysAgo: 2,
  ...over
});

const feed = (over: Partial<Milestones> = {}): Milestones => ({
  since: '2024-01-01',
  daysTogether: 1234,
  recent: [],
  upcoming: [],
  ...over
});

describe('labels', () => {
  it('words how far off a milestone is', () => {
    expect(inLabel(0)).toBe('Today');
    expect(inLabel(1)).toBe('Tomorrow');
    expect(inLabel(5)).toBe('In 5 days');
    expect(inLabel(21)).toBe('In 3 weeks');
    expect(inLabel(120)).toBe('In 4 months');
  });

  it('words how long ago one was reached', () => {
    expect(agoLabel(1)).toBe('Yesterday');
    expect(agoLabel(4)).toBe('4 days ago');
    expect(agoLabel(21)).toBe('3 weeks ago');
  });
});

describe('HomeMilestones', () => {
  it('leads with the days together, and both groups say they are empty', () => {
    render(<HomeMilestones milestones={feed()} onOpen={() => {}} />);
    expect(screen.getByText('1,234 days together')).toBeInTheDocument();
    expect(screen.getByText('Nothing on the horizon just yet.')).toBeInTheDocument();
    expect(screen.getByText('No milestones passed recently.')).toBeInTheDocument();
  });

  it('lists what is coming and what was just reached', () => {
    render(<HomeMilestones milestones={feed({ upcoming: [upcoming()], recent: [reached()] })} onOpen={() => {}} />);
    expect(screen.getByText('700 days together')).toBeInTheDocument();
    expect(screen.getByText('In 5 days')).toBeInTheDocument();
    expect(screen.getByText('100 dinners')).toBeInTheDocument();
    expect(screen.getByText('2 days ago')).toBeInTheDocument();
  });

  it('hedges a date that is projected from the current pace', () => {
    render(
      <HomeMilestones
        milestones={feed({ upcoming: [upcoming({ projected: true, daysAway: 21 })] })}
        onOpen={() => {}}
      />
    );
    expect(screen.getByText('In about 3 weeks')).toBeInTheDocument();
  });

  it('says how many are left on a count milestone, with a bar and the projected date', () => {
    const dinners = upcoming({
      key: 'u2',
      label: '50 dinners',
      target: 50,
      remaining: 8,
      projected: true,
      daysAway: 21
    });
    render(<HomeMilestones milestones={feed({ upcoming: [dinners] })} onOpen={() => {}} />);

    expect(screen.getByText('8 to go')).toBeInTheDocument();
    expect(screen.getByText('In about 3 weeks')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: '50 dinners progress' })).toHaveAttribute('aria-valuenow', '84');
  });

  it('gives a date milestone no bar, since its distance is already in words', () => {
    render(<HomeMilestones milestones={feed({ upcoming: [upcoming()] })} onOpen={() => {}} />);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('shows a few of each, not the whole list', () => {
    const many = Array.from({ length: 6 }, (_, i) => upcoming({ key: `u${i}`, label: `Upcoming ${i}` }));
    render(<HomeMilestones milestones={feed({ upcoming: many })} onOpen={() => {}} />);
    expect(screen.getAllByText(/^Upcoming/)).toHaveLength(3);
  });

  it('opens the dashboard from a row', async () => {
    const onOpen = vi.fn();
    render(<HomeMilestones milestones={feed({ upcoming: [upcoming()] })} onOpen={onOpen} />);
    await userEvent.click(screen.getByText('700 days together'));
    expect(onOpen).toHaveBeenCalledWith('/relationship/dashboard');
  });

  it('says so when a group is empty, as the dashboard does', () => {
    render(<HomeMilestones milestones={feed({ upcoming: [upcoming()] })} onOpen={() => {}} />);
    expect(screen.getByText('Just reached')).toBeInTheDocument();
    expect(screen.getByText('No milestones passed recently.')).toBeInTheDocument();
    expect(screen.queryByText('Nothing on the horizon just yet.')).not.toBeInTheDocument();
  });

  it('says so when nothing is coming up', () => {
    render(<HomeMilestones milestones={feed({ recent: [reached()] })} onOpen={() => {}} />);
    expect(screen.getByText('Coming up')).toBeInTheDocument();
    expect(screen.getByText('Nothing on the horizon just yet.')).toBeInTheDocument();
  });

  it('renders nothing when there is nothing to count from', () => {
    const { container } = render(<HomeMilestones milestones={feed({ daysTogether: null })} onOpen={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
