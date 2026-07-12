import { render, screen } from '@testing-library/react';
import { TenantProvider, useTenantListener, useTenantContext } from './TenantProvider';

/**
 * NOTE: TenantContext (the actual React context object) is not exported from
 * this module — only TenantProvider, useTenantListener, and useTenantContext
 * are. Grepping the app tree confirms no real consumer ever calls
 * onTenantChange/registerTenantChangeListener through it either: every
 * AuthHeader wrapper (relationship-front, finance-front, album-front) wires
 * onTenantChange straight to its own useTenant() hook's setSelectedTenant,
 * bypassing this context completely. That dispatch path is unreachable from
 * outside the module as currently designed, so this suite only covers the
 * public surface that's actually reachable.
 */

function ContextReader() {
  const tenant = useTenantContext();
  return <div data-testid="context-value">{tenant?.name ?? 'none'}</div>;
}

describe('useTenantContext', () => {
  it('returns null when used outside a TenantProvider', () => {
    render(<ContextReader />);
    expect(screen.getByTestId('context-value')).toHaveTextContent('none');
  });

  it('returns null inside a TenantProvider (nothing can set a tenant through this context)', () => {
    render(
      <TenantProvider>
        <ContextReader />
      </TenantProvider>
    );
    expect(screen.getByTestId('context-value')).toHaveTextContent('none');
  });
});

describe('useTenantListener', () => {
  it('does not throw when used outside a TenantProvider', () => {
    function Listener() {
      useTenantListener(() => {});
      return null;
    }

    expect(() => render(<Listener />)).not.toThrow();
  });

  it('registers without throwing inside a TenantProvider and cleans up on unmount', () => {
    function Listener() {
      useTenantListener(() => {});
      return null;
    }

    const { unmount } = render(
      <TenantProvider>
        <Listener />
      </TenantProvider>
    );

    expect(() => unmount()).not.toThrow();
  });
});

describe('TenantProvider', () => {
  it('renders its children', () => {
    render(
      <TenantProvider>
        <div data-testid="child">hello</div>
      </TenantProvider>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});
