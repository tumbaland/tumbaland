import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vite-plus/test';
import { ColumnChart, niceMax } from './ColumnChart';

const columns = [
  { label: '25 Oct', value: 1 },
  { label: '26 Oct', value: 3 },
  { label: '27 Oct', value: 2 }
];

describe('niceMax', () => {
  it.each([
    [0, 1],
    [1, 1],
    [4, 4],
    [5, 5],
    [7, 8],
    [11, 15],
    [130, 150],
    [9000, 10000]
  ])('rounds the top of the scale for %d to %d', (value, expected) => {
    expect(niceMax(value)).toBe(expected);
  });
});

describe('ColumnChart', () => {
  it('reads every column out, so none of it is only in the colour', () => {
    render(<ColumnChart columns={columns} noun="people" title="People each day" />);

    expect(screen.getByRole('group', { name: 'People each day' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '25 Oct: 1 people' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '26 Oct: 3 people' })).toBeInTheDocument();
  });

  it('labels the scale and the ends of the time axis, and nothing on every bar', () => {
    render(<ColumnChart columns={columns} noun="people" title="People each day" />);

    // The top of the scale is a round number above the largest value.
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
    expect(screen.getByText('25 Oct')).toBeInTheDocument();
    expect(screen.getByText('26 Oct')).toBeInTheDocument();
    expect(screen.getByText('27 Oct')).toBeInTheDocument();
  });

  it('shows the value of a column on hover and hides it on leaving', async () => {
    const user = userEvent.setup();
    render(<ColumnChart columns={columns} noun="people" title="People each day" />);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await user.hover(screen.getByRole('img', { name: '26 Oct: 3 people' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('26 Oct: 3 people');

    await user.unhover(screen.getByRole('img', { name: '26 Oct: 3 people' }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows the same on keyboard focus', async () => {
    const user = userEvent.setup();
    render(<ColumnChart columns={columns} noun="people" title="People each day" />);

    await user.tab();
    await user.tab();
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    await user.tab();
    await user.tab();
    await user.tab();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('can be read as a table instead, and back', async () => {
    const user = userEvent.setup();
    render(<ColumnChart columns={columns} noun="people" title="People each day" />);

    await user.click(screen.getByRole('button', { name: 'Table' }));

    const table = screen.getByRole('table', { name: 'People each day' });
    expect(table).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /26 Oct\s*3/ })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'People each day' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Chart' }));
    expect(screen.getByRole('group', { name: 'People each day' })).toBeInTheDocument();
  });

  it('copes with a period in which nothing happened', () => {
    render(
      <ColumnChart
        columns={[
          { label: 'a', value: 0 },
          { label: 'b', value: 0 }
        ]}
        noun="people"
        title="Quiet"
      />
    );

    expect(screen.getByRole('img', { name: 'a: 0 people' })).toBeInTheDocument();
  });

  it('never labels the scale with half a count', () => {
    render(<ColumnChart columns={[{ label: 'a', value: 5 }]} noun="people" title="Odd" />);

    expect(screen.queryByText('2.5')).not.toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('copes with two columns that share a label', () => {
    render(
      <ColumnChart
        columns={[
          { label: '27 Oct', value: 1 },
          { label: '27 Oct', value: 2 }
        ]}
        noun="people"
        title="Twice"
      />
    );

    expect(screen.getAllByRole('img', { name: /27 Oct/ })).toHaveLength(2);
  });

  it('copes with a single column', () => {
    render(<ColumnChart columns={[{ label: 'only', value: 2 }]} noun="people" title="One" />);

    expect(screen.getByRole('img', { name: 'only: 2 people' })).toBeInTheDocument();
  });
});
