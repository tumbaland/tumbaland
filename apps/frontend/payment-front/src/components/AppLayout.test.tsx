import { render, screen } from '@testing-library/react';
import AppLayout from './AppLayout';

it('renders its children', () => {
  render(
    <AppLayout>
      <div>child content</div>
    </AppLayout>
  );
  expect(screen.getByText('child content')).toBeInTheDocument();
});
