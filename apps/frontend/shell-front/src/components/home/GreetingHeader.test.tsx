import { render, screen } from '@testing-library/react';
import { expect, it } from 'vite-plus/test';
import { GreetingHeader, firstNameOf, timeOfDayGreeting } from './GreetingHeader';

it('picks the greeting from the hour of day', () => {
  expect(timeOfDayGreeting(new Date('2026-08-08T08:00:00'))).toBe('Good morning');
  expect(timeOfDayGreeting(new Date('2026-08-08T13:00:00'))).toBe('Good afternoon');
  expect(timeOfDayGreeting(new Date('2026-08-08T20:00:00'))).toBe('Good evening');
});

it('takes only the first name, and treats blank names as absent', () => {
  expect(firstNameOf('Toomas Tahves')).toBe('Toomas');
  expect(firstNameOf('  ')).toBeNull();
  expect(firstNameOf(undefined)).toBeNull();
});

it('renders a time-appropriate personal greeting', () => {
  render(<GreetingHeader name="Toomas Tahves" now={new Date('2026-08-08T20:00:00')} />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Good evening, Toomas');
});
