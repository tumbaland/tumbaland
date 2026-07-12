import { render, screen } from '@testing-library/react';
import Layout from './Layout';

it('renders its children', () => {
  render(<Layout><div>child content</div></Layout>);
  expect(screen.getByText('child content')).toBeInTheDocument();
});
