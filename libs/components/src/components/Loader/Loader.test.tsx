import { render, screen } from '@testing-library/react';
import { Loader } from './Loader';

describe('Loader', () => {
  it('renders a spinner with no message by default', () => {
    render(<Loader />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders the provided message', () => {
    render(<Loader message="Loading data..." />);

    expect(screen.getByText('Loading data...')).toBeInTheDocument();
  });

  it('applies the given spinner size', () => {
    render(<Loader size={24} />);

    expect(screen.getByRole('progressbar')).toHaveStyle({ width: '24px', height: '24px' });
  });

  it('takes full viewport height by default', () => {
    const { container } = render(<Loader />);

    expect(container.firstChild).toHaveStyle({ height: '100vh' });
  });

  it('uses auto height layout when fullHeight is false', () => {
    const { container } = render(<Loader fullHeight={false} />);

    expect(container.firstChild).toHaveStyle({ height: 'auto' });
  });
});
