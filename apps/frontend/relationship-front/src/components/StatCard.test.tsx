import { render, screen } from '@testing-library/react';
import StatCard from './StatCard';

it('renders the title, value, and subtitle', () => {
  render(<StatCard icon={<span>icon</span>} title="Total Hours" value={42} subtitle="this month" color="#111111" />);

  expect(screen.getByText('icon')).toBeInTheDocument();
  expect(screen.getByText('Total Hours')).toBeInTheDocument();
  expect(screen.getByText('42')).toBeInTheDocument();
  expect(screen.getByText('this month')).toBeInTheDocument();
});
