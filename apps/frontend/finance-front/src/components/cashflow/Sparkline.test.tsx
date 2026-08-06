import { render, screen } from '@testing-library/react';
import Sparkline from './Sparkline';

it('describes itself for anyone who cannot see the shape', () => {
  render(<Sparkline values={[1, 2, 3]} color="#11998e" label="Spending, ending at 300 €" />);

  expect(screen.getByLabelText('Spending, ending at 300 €')).toBeInTheDocument();
});

it('draws a point per value', () => {
  const { container } = render(<Sparkline values={[10, 30, 20]} color="#11998e" label="x" />);

  expect(container.querySelector('path')?.getAttribute('d')?.match(/[ML]/g)).toHaveLength(3);
});

it('marks the most recent point by default', () => {
  const { container } = render(<Sparkline values={[0, 100]} color="#11998e" label="x" />);
  const marker = container.querySelector('circle')!;

  // Last of two points sits at the right edge, and 100 is the high, so the top
  expect(Number(marker.getAttribute('cx'))).toBeGreaterThan(200);
  expect(Number(marker.getAttribute('cy'))).toBe(4);
});

it('does not clip a flat series to a zero-height line', () => {
  const { container } = render(<Sparkline values={[50, 50, 50]} color="#11998e" label="x" />);

  // A zero span would divide by zero and put every point at NaN
  expect(container.querySelector('path')?.getAttribute('d')).not.toContain('NaN');
});

it('draws nothing from a single reading', () => {
  const { container } = render(<Sparkline values={[5]} color="#11998e" label="x" />);

  expect(container.querySelector('svg')).toBeNull();
});
