import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';

import ShowcaseSection from './ShowcaseSection';

it('shows three screens of the app, named the way the app nav names them', () => {
  render(<ShowcaseSection />);

  expect(screen.getAllByTestId('phone-screen')).toHaveLength(3);
  ['Journal', 'Chat', 'Album'].forEach((module) => {
    expect(screen.getAllByText(module).length).toBeGreaterThan(0);
  });
});

it('gives each screen one line, and no paragraph', () => {
  render(<ShowcaseSection />);

  expect(screen.getByText('Where your time went')).toBeInTheDocument();
  expect(screen.getByText('Photos you can find')).toBeInTheDocument();
  expect(screen.getByText('Photos file themselves')).toBeInTheDocument();
});

it('shows no money screen', () => {
  render(<ShowcaseSection />);
  expect(screen.queryByText(/money|net worth/i)).not.toBeInTheDocument();
});

it('says the data in the screens is made up', () => {
  // They are the app's real layout, but the evenings, the messages and the
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
  expect(screen.getByText('In Rome')).toBeInTheDocument();
});

it('says sharing exists, without a member limit nothing enforces', () => {
  render(<ShowcaseSection />);
  expect(screen.getByText(/anyone else you add to your group/)).toBeInTheDocument();
  expect(screen.queryByText(/up to \w+ people/)).not.toBeInTheDocument();
});
