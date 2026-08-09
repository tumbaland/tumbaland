import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UsageMeter, formatBytes } from './UsageMeter';

const GB = 1024 * 1024 * 1024;

describe('formatBytes', () => {
  it('uses binary units so a 1 GB plan reads as 1 GB', () => {
    // DEFAULT_PLAN_LIMITS sets free storage to 1 * 1024^3. Decimal formatting
    // would render that as "1.07 GB" against a plan that says 1 GB.
    expect(formatBytes(GB)).toBe('1 GB');
    expect(formatBytes(50 * GB)).toBe('50 GB');
  });

  it('keeps fractions readable and drops noise from whole units', () => {
    expect(formatBytes(1536)).toBe('1.50 KB');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(500)).toBe('500 B');
  });

  it('treats zero and nonsense as zero rather than NaN or -Infinity', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(-5)).toBe('0 B');
    expect(formatBytes(Number.NaN)).toBe('0 B');
  });
});

describe('UsageMeter', () => {
  it('states usage against the limit in the plan"s own units', () => {
    render(<UsageMeter label="Storage" used={340 * 1024 * 1024} limit={GB} unit="bytes" />);

    expect(screen.getByText('340 MB of 1 GB')).toBeInTheDocument();
    expect(screen.getByText('Storage')).toBeInTheDocument();
  });

  it('renders counts without byte formatting', () => {
    render(<UsageMeter label="Tracked tickers" used={3} limit={25} />);

    expect(screen.getByText('3 of 25')).toBeInTheDocument();
  });

  it('fills the bar in proportion to usage', () => {
    render(<UsageMeter label="Seats" used={1} limit={4} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  });

  it('shows no bar for an unlimited meter, since there is no ceiling to fill', () => {
    render(<UsageMeter label="Storage" used={9 * GB} limit={-1} unit="bytes" />);

    // Staff and comped accounts land here. A full bar would read as "at your
    // limit"; an empty one implies a ceiling that does not exist.
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByText('Unlimited on your plan')).toBeInTheDocument();
    expect(screen.getByText('9 GB used')).toBeInTheDocument();
  });

  it('offers the upgrade only once the ceiling is actually in sight', async () => {
    const onUpgrade = vi.fn();
    const { rerender } = render(<UsageMeter label="Storage" used={10} limit={100} onUpgrade={onUpgrade} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerender(<UsageMeter label="Storage" used={80} limit={100} onUpgrade={onUpgrade} />);
    expect(screen.getByText(/close to your storage limit/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /upgrade/i }));
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });

  it('says the limit is reached, not merely near, once it is', () => {
    render(<UsageMeter label="Seats" used={5} limit={5} onUpgrade={vi.fn()} />);

    expect(screen.getByText(/reached your seats limit/i)).toBeInTheDocument();
  });

  it('never renders a bar past full, however far over the limit usage has drifted', () => {
    // Reachable: the storage gate is a read-only check, so two concurrent
    // uploads can both pass it and land the account over its ceiling.
    render(<UsageMeter label="Storage" used={3 * GB} limit={GB} unit="bytes" />);

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', String(3 * GB));
    expect(screen.getByText('3 GB of 1 GB')).toBeInTheDocument();
  });

  it('does not divide by zero on a zero limit', () => {
    render(<UsageMeter label="Seats" used={2} limit={0} />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText('2 of 0')).toBeInTheDocument();
  });

  it('stays silent about upgrading when no handler is given', () => {
    render(<UsageMeter label="Storage" used={100} limit={100} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
