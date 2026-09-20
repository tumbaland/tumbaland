import { render, screen } from '@testing-library/react';
import { AppLayout } from './AppLayout';

describe('AppLayout', () => {
  it('renders its children', () => {
    render(
      <AppLayout>
        <p>page content</p>
      </AppLayout>
    );

    expect(screen.getByText('page content')).toBeInTheDocument();
  });

  it('renders the header above the content when one is given', () => {
    render(
      <AppLayout header={<header>app header</header>}>
        <p>page content</p>
      </AppLayout>
    );

    const header = screen.getByText('app header');
    const content = screen.getByText('page content');

    expect(header).toBeInTheDocument();
    // Node.DOCUMENT_POSITION_FOLLOWING: the content comes after the header.
    expect(header.compareDocumentPosition(content) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders no header element when none is given', () => {
    render(
      <AppLayout>
        <p>page content</p>
      </AppLayout>
    );

    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });

  it('caps the content column at the requested width', () => {
    const { container } = render(
      <AppLayout maxWidth="sm">
        <p>page content</p>
      </AppLayout>
    );

    expect(container.querySelector('.MuiContainer-maxWidthSm')).toBeInTheDocument();
  });

  it('drops the gutters when the page owns its own padding', () => {
    const { container } = render(
      <AppLayout disableGutters>
        <p>page content</p>
      </AppLayout>
    );

    expect(container.querySelector('.MuiContainer-disableGutters')).toBeInTheDocument();
  });
});
