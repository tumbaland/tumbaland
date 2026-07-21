import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PhotoPaginationControls from './PhotoPaginationControls';

const basePagination = { total: 100, pages: 5 };

it('shows the total photo count and per-page select at the top position', () => {
  render(
    <PhotoPaginationControls
      pagination={basePagination}
      currentPage={1}
      pageSize={24}
      onPageChange={vi.fn()}
      onPageSizeChange={vi.fn()}
      position="top"
    />
  );
  expect(screen.getByText('100 photos total')).toBeInTheDocument();
  expect(screen.getAllByText('Per page').length).toBeGreaterThan(0);
});

it('uses singular "photo" when there is exactly one', () => {
  render(
    <PhotoPaginationControls
      pagination={{ total: 1, pages: 1 }}
      currentPage={1}
      pageSize={24}
      onPageChange={vi.fn()}
      onPageSizeChange={vi.fn()}
    />
  );
  expect(screen.getByText('1 photo total')).toBeInTheDocument();
});

it('renders nothing when there is only one page', () => {
  render(
    <PhotoPaginationControls
      pagination={{ total: 10, pages: 1 }}
      currentPage={1}
      pageSize={24}
      onPageChange={vi.fn()}
      onPageSizeChange={vi.fn()}
    />
  );
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(screen.queryByRole('slider')).not.toBeInTheDocument();
});

it('renders nothing when the page size is "All" (0), even with multiple pages worth of data', () => {
  render(
    <PhotoPaginationControls
      pagination={basePagination}
      currentPage={1}
      pageSize={0}
      onPageChange={vi.fn()}
      onPageSizeChange={vi.fn()}
    />
  );
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});

it('shows every page number with no ellipsis when there are few pages', () => {
  render(
    <PhotoPaginationControls
      pagination={{ total: 100, pages: 5 }}
      currentPage={3}
      pageSize={24}
      onPageChange={vi.fn()}
      onPageSizeChange={vi.fn()}
    />
  );
  for (const page of [1, 2, 4, 5]) {
    expect(screen.getByRole('button', { name: `Go to page ${page}` })).toBeInTheDocument();
  }
  // The current page (3) is rendered with a different aria-label ("page 3", not "Go to page 3").
  expect(screen.getByRole('button', { name: 'page 3', current: 'page' })).toBeInTheDocument();
  expect(screen.queryByText('…')).not.toBeInTheDocument();
});

it('calls onPageChange with the clicked page number', async () => {
  const onPageChange = vi.fn();
  render(
    <PhotoPaginationControls
      pagination={{ total: 100, pages: 5 }}
      currentPage={1}
      pageSize={24}
      onPageChange={onPageChange}
      onPageSizeChange={vi.fn()}
    />
  );

  await userEvent.click(screen.getByRole('button', { name: 'Go to page 4' }));
  expect(onPageChange).toHaveBeenCalledWith(expect.anything(), 4);
});

it('switches to a slider with prev/next steppers above the full-list threshold', () => {
  render(
    <PhotoPaginationControls
      pagination={{ total: 2000, pages: 87 }}
      currentPage={12}
      pageSize={24}
      onPageChange={vi.fn()}
      onPageSizeChange={vi.fn()}
    />
  );

  const slider = screen.getByRole('slider');
  expect(slider).toHaveAttribute('aria-valuemin', '1');
  expect(slider).toHaveAttribute('aria-valuemax', '87');
  expect(slider).toHaveAttribute('aria-valuenow', '12');
  expect(screen.getByText('12 / 87')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Go to page 1' })).not.toBeInTheDocument();
});

it('steps the page via the slider\'s prev/next buttons, clamped to the valid range', async () => {
  const onPageChange = vi.fn();
  render(
    <PhotoPaginationControls
      pagination={{ total: 2000, pages: 87 }}
      currentPage={12}
      pageSize={24}
      onPageChange={onPageChange}
      onPageSizeChange={vi.fn()}
    />
  );

  await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
  expect(onPageChange).toHaveBeenLastCalledWith(expect.anything(), 13);

  await userEvent.click(screen.getByRole('button', { name: 'Previous page' }));
  expect(onPageChange).toHaveBeenLastCalledWith(expect.anything(), 11);
});

it('disables the previous stepper on the first page and the next stepper on the last', () => {
  const { rerender } = render(
    <PhotoPaginationControls
      pagination={{ total: 2000, pages: 87 }}
      currentPage={1}
      pageSize={24}
      onPageChange={vi.fn()}
      onPageSizeChange={vi.fn()}
    />
  );
  expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Next page' })).not.toBeDisabled();

  rerender(
    <PhotoPaginationControls
      pagination={{ total: 2000, pages: 87 }}
      currentPage={87}
      pageSize={24}
      onPageChange={vi.fn()}
      onPageSizeChange={vi.fn()}
    />
  );
  expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Previous page' })).not.toBeDisabled();
});

it('renders the pagination control centered at the bottom position', () => {
  render(
    <PhotoPaginationControls
      pagination={{ total: 100, pages: 5 }}
      currentPage={1}
      pageSize={24}
      onPageChange={vi.fn()}
      onPageSizeChange={vi.fn()}
      position="bottom"
    />
  );
  expect(screen.getByRole('navigation')).toBeInTheDocument();
  expect(screen.queryByText(/photos total/)).not.toBeInTheDocument();
});
