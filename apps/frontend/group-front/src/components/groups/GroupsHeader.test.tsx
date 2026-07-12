import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import GroupsHeader from './GroupsHeader';

it('calls onCreateClick when the Create Group button is clicked', async () => {
  const onCreateClick = vi.fn();
  render(<GroupsHeader onCreateClick={onCreateClick} />);

  await userEvent.click(screen.getByRole('button', { name: /create group/i }));

  expect(onCreateClick).toHaveBeenCalled();
});
