import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import TagInput, { normalizeTag, normalizeTagList } from './TagInput';

it('lowercases and trims a tag', () => {
  expect(normalizeTag('  Beach ')).toBe('beach');
});

it('drops blanks and case-insensitive duplicates from a list', () => {
  expect(normalizeTagList(['Beach', 'beach ', '  ', 'Sunset'])).toEqual(['beach', 'sunset']);
});

it('renders the current tags as chips', () => {
  render(<TagInput value={['beach', 'sunset']} onChange={vi.fn()} />);

  expect(screen.getByText('beach')).toBeInTheDocument();
  expect(screen.getByText('sunset')).toBeInTheDocument();
});

it('commits a typed tag on Enter, normalized', async () => {
  const onChange = vi.fn();
  render(<TagInput value={[]} onChange={onChange} />);

  await userEvent.type(screen.getByRole('combobox'), '  Beach  {Enter}');

  expect(onChange).toHaveBeenCalledWith(['beach']);
});

it('commits a typed tag on comma', async () => {
  const onChange = vi.fn();
  render(<TagInput value={['sunset']} onChange={onChange} />);

  await userEvent.type(screen.getByRole('combobox'), 'Beach,');

  expect(onChange).toHaveBeenCalledWith(['sunset', 'beach']);
});

it('ignores a comma typed with nothing pending', async () => {
  const onChange = vi.fn();
  render(<TagInput value={[]} onChange={onChange} />);

  await userEvent.type(screen.getByRole('combobox'), ',');

  expect(onChange).not.toHaveBeenCalled();
});

it('offers the album vocabulary as suggestions with counts', async () => {
  render(<TagInput value={[]} onChange={vi.fn()} suggestions={[{ tag: 'beach', count: 4 }]} />);

  await userEvent.click(screen.getByRole('combobox'));

  const option = await screen.findByRole('option');
  expect(option).toHaveTextContent('beach');
  expect(option).toHaveTextContent('4');
});
