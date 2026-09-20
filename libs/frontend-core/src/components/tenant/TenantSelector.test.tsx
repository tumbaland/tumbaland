import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TenantSelector, { TenantOption } from './TenantSelector';

const personal: TenantOption = { id: 'personal', name: 'Personal', type: 'personal' };
const groupA: TenantOption = { id: 'g1', name: 'Group A', type: 'group', isSelected: true };
const groupB: TenantOption = { id: 'g2', name: 'Group B', type: 'group' };

describe('TenantSelector', () => {
  it('shows "Choose context" and a disabled button when there is no selection and no tenants', () => {
    render(<TenantSelector selectedTenant={null} tenants={[]} onTenantChange={vi.fn()} />);

    expect(screen.getByText('Choose context')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows the selected tenant name (Personal) as the button label', () => {
    render(<TenantSelector selectedTenant={personal} tenants={[personal]} onTenantChange={vi.fn()} />);

    expect(screen.getByText('Personal')).toBeInTheDocument();
  });

  it('shows the selected group tenant name as the button label', () => {
    render(<TenantSelector selectedTenant={groupA} tenants={[personal, groupA]} onTenantChange={vi.fn()} />);

    expect(screen.getByText('Group A')).toBeInTheDocument();
  });

  it('shows "Loading..." and disables the button while loading', () => {
    render(<TenantSelector selectedTenant={null} tenants={[personal]} onTenantChange={vi.fn()} loading />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows an error chip instead of the selector when error is set', () => {
    render(<TenantSelector selectedTenant={null} tenants={[]} onTenantChange={vi.fn()} error="boom" />);

    expect(screen.getByText('Error loading contexts')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('opens the menu, lists tenants, and calls onTenantChange + closes on selection', async () => {
    const onTenantChange = vi.fn();
    const user = userEvent.setup();
    render(
      <TenantSelector selectedTenant={personal} tenants={[personal, groupA, groupB]} onTenantChange={onTenantChange} />
    );

    await user.click(screen.getByRole('button'));

    expect(screen.getByText('Switch to')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /group a/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /group b/i })).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: /group a/i }));

    expect(onTenantChange).toHaveBeenCalledWith(groupA);
    expect(screen.queryByText('Switch to')).not.toBeInTheDocument();
  });

  it('marks the currently selected tenant with the selected menu item state', async () => {
    const user = userEvent.setup();
    render(<TenantSelector selectedTenant={groupA} tenants={[personal, groupA]} onTenantChange={vi.fn()} />);

    await user.click(screen.getByRole('button'));

    expect(screen.getByRole('menuitem', { name: /group a/i })).toHaveClass('Mui-selected');
    expect(screen.getByRole('menuitem', { name: /personal/i })).not.toHaveClass('Mui-selected');
  });

  it('shows "No contexts available" if tenants become empty while the menu is already open', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <TenantSelector selectedTenant={personal} tenants={[personal]} onTenantChange={vi.fn()} />
    );

    await user.click(screen.getByRole('button'));
    expect(screen.getByText('Switch to')).toBeInTheDocument();

    rerender(<TenantSelector selectedTenant={null} tenants={[]} onTenantChange={vi.fn()} />);

    expect(await screen.findByText('No contexts available')).toBeInTheDocument();
  });
});
