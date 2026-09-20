import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';

import ShowcaseSection from './ShowcaseSection';

it('shows three screens of the app, named the way the app nav names them', () => {
  render(<ShowcaseSection />);

  expect(screen.getAllByTestId('phone-screen')).toHaveLength(3);
  ['Journal', 'Album', 'Money'].forEach((module) => {
    expect(screen.getAllByText(module).length).toBeGreaterThan(0);
  });
});

it('gives each screen one line, and no paragraph', () => {
  render(<ShowcaseSection />);

  expect(screen.getByText('Where your time went')).toBeInTheDocument();
  expect(screen.getByText('Photos you can find')).toBeInTheDocument();
  expect(screen.getByText('Every account in one number')).toBeInTheDocument();
});

it('says the data in the screens is made up', () => {
  // They are the app's real layout, but the evenings, the balance and the
  // holiday are invented. A page showing data owes the reader that line.
  render(<ShowcaseSection />);
  expect(screen.getByText(/sample data/i)).toBeInTheDocument();
});

it('keeps the screens out of the accessibility tree', () => {
  // A drawn journal read aloud sounds like somebody's real September. The
  // caption under each phone is what carries the meaning.
  render(<ShowcaseSection />);
  screen.getAllByTestId('phone-screen').forEach((phone) => {
    expect(phone).toHaveAttribute('aria-hidden', 'true');
  });
});

it('renders the screens finished where nothing can animate them', () => {
  // jsdom has no IntersectionObserver, so nothing tells the section it is on
  // screen. The screens must arrive at their end state, not stay blank.
  render(<ShowcaseSection />);
  expect(screen.getByText('18 days logged')).toBeInTheDocument();
  expect(screen.getByText('48,210')).toBeInTheDocument();
});

it('still says the fourth module exists', () => {
  render(<ShowcaseSection />);
  expect(screen.getByText(/up to five people/)).toBeInTheDocument();
});
