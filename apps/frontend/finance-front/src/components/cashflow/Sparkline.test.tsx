import { render, screen, fireEvent } from '@testing-library/react';
import Sparkline from './Sparkline';

const money = (v: number) => `${v} €`;

const points = (...values: number[]) =>
  values.map((value, i) => ({ label: `M${i + 1}`, value }));

const draw = (values: number[], label = 'Spending') =>
  render(<Sparkline points={points(...values)} color="#11998e" format={money} label={label} />);

/** jsdom gives every element a zero-size rect, so hovering needs a real one. */
const sizeIt = (el: Element, width = 240) =>
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    left: 0, width, top: 0, height: 40, right: width, bottom: 40, x: 0, y: 0, toJSON: () => ({})
  } as DOMRect);

it('describes itself for anyone who cannot see the shape', () => {
  draw([1, 2, 3], 'Spending, ending at 300 €');

  expect(screen.getByLabelText('Spending, ending at 300 €')).toBeInTheDocument();
});

it('draws a point per value', () => {
  const { container } = draw([10, 30, 20]);

  expect(container.querySelector('path')?.getAttribute('d')?.match(/[ML]/g)).toHaveLength(3);
});

it('reads out the newest period before anything is hovered', () => {
  // A plot that will not say what any of it was invites guesswork
  draw([10, 20, 30]);

  expect(screen.getByText('M3: 30 €')).toBeInTheDocument();
});

it('reads out whatever the pointer is over', () => {
  const { container } = draw([10, 20, 30]);
  const surface = container.querySelector('svg')!.parentElement!;
  sizeIt(surface);

  fireEvent.mouseMove(surface, { clientX: 0 });

  expect(screen.getByText('M1: 10 €')).toBeInTheDocument();
});

it('snaps to the nearest point rather than interpolating', () => {
  const { container } = draw([10, 20, 30]);
  const surface = container.querySelector('svg')!.parentElement!;
  sizeIt(surface);

  fireEvent.mouseMove(surface, { clientX: 130 });

  expect(screen.getByText('M2: 20 €')).toBeInTheDocument();
});

it('shows a crosshair only while hovering', () => {
  const { container } = draw([10, 20, 30]);
  const surface = container.querySelector('svg')!.parentElement!;
  sizeIt(surface);

  expect(screen.queryByTestId('sparkline-crosshair')).toBeNull();

  fireEvent.mouseMove(surface, { clientX: 120 });
  expect(screen.getByTestId('sparkline-crosshair')).toBeInTheDocument();

  fireEvent.mouseLeave(surface);
  expect(screen.queryByTestId('sparkline-crosshair')).toBeNull();
});

it('keeps the marker round however wide the plot is drawn', () => {
  // The line stretches to fit; an SVG circle would stretch with it into an oval
  draw([10, 20, 30]);

  const marker = screen.getByTestId('sparkline-marker');
  expect(marker).toHaveStyle({ width: '8px', height: '8px', borderRadius: '50%' });
});

it('goes back to the newest period when the pointer leaves', () => {
  const { container } = draw([10, 20, 30]);
  const surface = container.querySelector('svg')!.parentElement!;
  sizeIt(surface);

  fireEvent.mouseMove(surface, { clientX: 0 });
  fireEvent.mouseLeave(surface);

  expect(screen.getByText('M3: 30 €')).toBeInTheDocument();
});

it('stays on the plot when the pointer runs past either end', () => {
  const { container } = draw([10, 20, 30]);
  const surface = container.querySelector('svg')!.parentElement!;
  sizeIt(surface);

  fireEvent.mouseMove(surface, { clientX: -500 });
  expect(screen.getByText('M1: 10 €')).toBeInTheDocument();

  fireEvent.mouseMove(surface, { clientX: 5000 });
  expect(screen.getByText('M3: 30 €')).toBeInTheDocument();
});

it('does not divide by zero on a flat series', () => {
  const { container } = draw([50, 50, 50]);

  expect(container.querySelector('path')?.getAttribute('d')).not.toContain('NaN');
});

it('survives a zero-width container rather than reading NaN', () => {
  // Happens on first paint, before layout
  const { container } = draw([10, 20, 30]);
  const surface = container.querySelector('svg')!.parentElement!;
  sizeIt(surface, 0);

  fireEvent.mouseMove(surface, { clientX: 10 });

  expect(screen.getByText('M3: 30 €')).toBeInTheDocument();
});

it('draws nothing from a single reading', () => {
  const { container } = draw([5]);

  expect(container.querySelector('svg')).toBeNull();
});
