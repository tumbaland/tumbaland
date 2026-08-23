import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import PhotoTagFilter from './PhotoTagFilter';

const tags = [
  { tag: 'beach', count: 5 },
  { tag: 'sunset', count: 2 }
];

it('renders nothing when the album has no tags', () => {
  const { container } = render(
    <PhotoTagFilter tags={[]} selected={[]} match="all" onChange={vi.fn()} onMatchChange={vi.fn()} />
  );

  expect(container).toBeEmptyDOMElement();
});

it('shows each tag with its photo count', () => {
  render(<PhotoTagFilter tags={tags} selected={[]} match="all" onChange={vi.fn()} onMatchChange={vi.fn()} />);

  expect(screen.getByText('beach (5)')).toBeInTheDocument();
  expect(screen.getByText('sunset (2)')).toBeInTheDocument();
});

it('adds a tag to the selection when clicked', async () => {
  const onChange = vi.fn();
  render(<PhotoTagFilter tags={tags} selected={[]} match="all" onChange={onChange} onMatchChange={vi.fn()} />);

  await userEvent.click(screen.getByText('beach (5)'));

  expect(onChange).toHaveBeenCalledWith(['beach']);
});

it('removes an already-selected tag when clicked again', async () => {
  const onChange = vi.fn();
  render(
    <PhotoTagFilter tags={tags} selected={['beach']} match="all" onChange={onChange} onMatchChange={vi.fn()} />
  );

  await userEvent.click(screen.getByText('beach (5)'));

  expect(onChange).toHaveBeenCalledWith([]);
});

it('clears the whole selection', async () => {
  const onChange = vi.fn();
  render(
    <PhotoTagFilter tags={tags} selected={['beach']} match="all" onChange={onChange} onMatchChange={vi.fn()} />
  );

  await userEvent.click(screen.getByRole('button', { name: /clear/i }));

  expect(onChange).toHaveBeenCalledWith([]);
});

it('offers the match toggle only once more than one tag is selected', async () => {
  const onMatchChange = vi.fn();
  const { rerender } = render(
    <PhotoTagFilter tags={tags} selected={['beach']} match="all" onChange={vi.fn()} onMatchChange={onMatchChange} />
  );
  expect(screen.queryByRole('button', { name: /match all/i })).not.toBeInTheDocument();

  rerender(
    <PhotoTagFilter
      tags={tags}
      selected={['beach', 'sunset']}
      match="all"
      onChange={vi.fn()}
      onMatchChange={onMatchChange}
    />
  );
  await userEvent.click(screen.getByRole('button', { name: /match all/i }));

  expect(onMatchChange).toHaveBeenCalledWith('any');
});

it('collapses a long tag list behind a "more" chip', async () => {
  const many = Array.from({ length: 15 }, (_, i) => ({ tag: `tag${i}`, count: 1 }));
  render(<PhotoTagFilter tags={many} selected={[]} match="all" onChange={vi.fn()} onMatchChange={vi.fn()} />);

  expect(screen.queryByText('tag14 (1)')).not.toBeInTheDocument();

  await userEvent.click(screen.getByText('+3 more'));

  expect(screen.getByText('tag14 (1)')).toBeInTheDocument();
});
