import { render, screen } from '@testing-library/react';
import Footer from './Footer';

it('renders nothing when not visible', () => {
  const { container } = render(<Footer isVisible={false} />);
  expect(container).toBeEmptyDOMElement();
});

it('renders the GitHub link and status when visible', () => {
  render(<Footer isVisible />);
  expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/toomastahves/tumbaland'
  );
  expect(screen.getByText('Status')).toBeInTheDocument();
});
