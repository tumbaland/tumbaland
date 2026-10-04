import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vite-plus/test';
import GroupsHeader from './GroupsHeader';

it('calls onCreateClick when the New group button is clicked', async () => {
  const onCreateClick = vi.fn();
  render(<GroupsHeader onCreateClick={onCreateClick} />);

  await userEvent.click(screen.getByRole('button', { name: /new group/i }));

  expect(onCreateClick).toHaveBeenCalled();
});
