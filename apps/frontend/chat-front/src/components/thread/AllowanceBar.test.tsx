import { describe, expect, it, vi } from 'vite-plus/test';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AllowanceBar } from './AllowanceBar';
import { assistantsView } from './assistantsFixtures';

const allowance = (overrides = {}) => ({ ...assistantsView().allowance, ...overrides });

describe('AllowanceBar', () => {
  it('says how much of the month is used, as a share, and when it starts again', () => {
    render(<AllowanceBar allowance={allowance()} onCap={vi.fn()} />);
    expect(screen.getByText("You've used 40% of this month's assistant allowance. It starts again on 1 November.")).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Assistant allowance used' })).toHaveAttribute('aria-valuenow', '40');
  });

  it('says so, and where to get more, when it is all used', () => {
    render(<AllowanceBar allowance={allowance({ used: 5000, percent: 100, exhausted: true })} onCap={vi.fn()} />);
    expect(screen.getByText("You've used this month's assistant allowance. It starts again on 1 November.")).toBeInTheDocument();
    expect(screen.getByText(/Upgrade your plan, or ask whoever runs Tumbaland/)).toBeInTheDocument();
  });

  it('never draws more than a full bar', () => {
    render(<AllowanceBar allowance={allowance({ percent: 130, exhausted: true })} onCap={vi.fn()} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('has nothing to measure on a plan with no limit', () => {
    render(<AllowanceBar allowance={allowance({ limit: null, percent: null })} onCap={vi.fn()} />);
    expect(screen.getByText('Your plan has no limit on assistants.')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('sets a lower cap of your own, and clears it', async () => {
    const onCap = vi.fn(async () => {});
    const { rerender } = render(<AllowanceBar allowance={allowance()} onCap={onCap} />);

    await userEvent.click(screen.getByRole('combobox', { name: 'Stop at' }));
    await userEvent.click(await screen.findByRole('option', { name: '50% of it' }));
    expect(onCap).toHaveBeenCalledWith(50);

    rerender(<AllowanceBar allowance={allowance({ capPercent: 50 })} onCap={onCap} />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Stop at' }));
    await userEvent.click(await screen.findByRole('option', { name: 'All of it' }));
    expect(onCap).toHaveBeenLastCalledWith(null);
  });

  it('keeps a cap set some other way in the list instead of losing it', async () => {
    render(<AllowanceBar allowance={allowance({ capPercent: 60 })} onCap={vi.fn()} />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Stop at' }));
    expect(await screen.findByRole('option', { name: '60% of it' })).toBeInTheDocument();
  });

  it('says so when the cap could not be saved', async () => {
    render(<AllowanceBar allowance={allowance()} onCap={vi.fn().mockRejectedValue(new Error('x'))} />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Stop at' }));
    await userEvent.click(await screen.findByRole('option', { name: '25% of it' }));
    await waitFor(() => expect(screen.getByText('Could not save that. Try again.')).toBeInTheDocument());
  });
});
