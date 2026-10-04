import { render, screen } from '@testing-library/react';
import { vi } from 'vite-plus/test';

vi.mock('./AuthHeader', () => ({ default: () => <div>auth header</div> }));

import AppLayout from './AppLayout';

it('renders the header and its children', () => {
  render(
    <AppLayout>
      <div>child content</div>
    </AppLayout>
  );
  expect(screen.getByText('auth header')).toBeInTheDocument();
  expect(screen.getByText('child content')).toBeInTheDocument();
});
