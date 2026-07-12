import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../../pages/PlansPage', () => ({ default: () => <div>plans page</div> }));

import PlansTab from './PlansTab';

it('renders PlansPage', () => {
  render(<PlansTab />);
  expect(screen.getByText('plans page')).toBeInTheDocument();
});
