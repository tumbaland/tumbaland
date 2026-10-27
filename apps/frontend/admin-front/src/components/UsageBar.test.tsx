import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vite-plus/test';
import { UsageBar } from './UsageBar';

describe('UsageBar', () => {
  it('says what is used of what is allowed, in words and in a bar', () => {
    render(<UsageBar label="Storage" used={512 * 1024 ** 2} limit={1024 ** 3} unit="bytes" />);

    expect(screen.getByText('512 MB of 1 GB')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar', { name: 'Storage' });
    expect(bar).toHaveAttribute('aria-valuenow', String(512 * 1024 ** 2));
    expect(bar).toHaveAttribute('aria-valuemax', String(1024 ** 3));
  });

  it('draws no bar when there is no ceiling', () => {
    render(<UsageBar label="Seats" used={3} limit={-1} unit="count" />);

    expect(screen.getByText('3 of No limit')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('does not claim a number nobody counts', () => {
    render(<UsageBar label="AI analyses" used={0} limit={25} unit="count" metered={false} />);

    expect(screen.getByText('Not counted yet (limit 25)')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('says so when the allowance is exceeded', () => {
    render(<UsageBar label="Storage" used={2 * 1024 ** 3} limit={1024 ** 3} unit="bytes" />);

    expect(screen.getByText('Over the allowance')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', String(1024 ** 3));
  });

  it('copes with a limit of zero', () => {
    render(<UsageBar label="Seats" used={0} limit={0} unit="count" />);

    expect(screen.getByText('0 of 0')).toBeInTheDocument();
  });
});
