import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import CollageCard from './CollageCard';
import { Collage } from '../../types/collage';

const collage: Collage = {
  _id: 'collage-1',
  title: 'Summer trip',
  config: {
    version: '2',
    date: '2024-01-01',
    viewport: { width: 1600, height: 900 },
    theme: 'default',
    photos: [{ photoId: 'p1', id: 'i1', x: 100, y: 100, width: 200, height: 200, rotation: 0 }],
    texts: [{ id: 't1', text: 'Hi', x: 50, y: 50, width: 100, height: 20, fontSize: 16, color: '#fff' }],
    title: { text: 'Summer trip', subtitle: 'Best weekend ever' }
  },
  albumIds: ['album-1'],
  ownerId: 'user-1',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-06-15T00:00:00.000Z'
};

it('renders the title, subtitle, photo count, and formatted date', () => {
  render(<CollageCard collage={collage} onView={vi.fn()} onEdit={vi.fn()} onEditDetails={vi.fn()} onDelete={vi.fn()} />);

  expect(screen.getByText('Summer trip')).toBeInTheDocument();
  expect(screen.getByText('Best weekend ever')).toBeInTheDocument();
  expect(screen.getByText('1 photos')).toBeInTheDocument();
  expect(screen.getByText('Jun 15, 2024')).toBeInTheDocument();
});

it('omits the subtitle line when there is none', () => {
  const noSubtitle = { ...collage, config: { ...collage.config, title: { text: 'Summer trip' } } };
  render(<CollageCard collage={noSubtitle} onView={vi.fn()} onEdit={vi.fn()} onEditDetails={vi.fn()} onDelete={vi.fn()} />);

  expect(screen.queryByText('Best weekend ever')).not.toBeInTheDocument();
});

it('shows "0 photos" when the collage has no photos', () => {
  const empty = { ...collage, config: { ...collage.config, photos: [] } };
  render(<CollageCard collage={empty} onView={vi.fn()} onEdit={vi.fn()} onEditDetails={vi.fn()} onDelete={vi.fn()} />);

  expect(screen.getByText('0 photos')).toBeInTheDocument();
});

it('shows the empty-collage placeholder when there are no photos or texts', () => {
  const empty = { ...collage, config: { ...collage.config, photos: [], texts: [] } };
  render(<CollageCard collage={empty} onView={vi.fn()} onEdit={vi.fn()} onEditDetails={vi.fn()} onDelete={vi.fn()} />);

  expect(screen.getByText('Empty collage')).toBeInTheDocument();
});

it('calls onView when the card is clicked', async () => {
  const onView = vi.fn();
  render(<CollageCard collage={collage} onView={onView} onEdit={vi.fn()} onEditDetails={vi.fn()} onDelete={vi.fn()} />);

  await userEvent.click(screen.getByText('Summer trip'));

  expect(onView).toHaveBeenCalledWith(collage);
});

describe('menu', () => {
  it('opens the menu without triggering onView, and wires Open editor / Edit details / Delete', async () => {
    const onView = vi.fn();
    const onEdit = vi.fn();
    const onEditDetails = vi.fn();
    const onDelete = vi.fn();
    render(<CollageCard collage={collage} onView={onView} onEdit={onEdit} onEditDetails={onEditDetails} onDelete={onDelete} />);

    const menuButtons = screen.getAllByRole('button');
    const menuTrigger = menuButtons.find((b) => b.querySelector('[data-testid="MoreVertIcon"]'))!;
    await userEvent.click(menuTrigger);
    expect(onView).not.toHaveBeenCalled();

    await userEvent.click(screen.getByText('Open editor'));
    expect(onEdit).toHaveBeenCalledWith(collage);

    await userEvent.click(menuTrigger);
    await userEvent.click(screen.getByText('Edit details'));
    expect(onEditDetails).toHaveBeenCalledWith(collage);

    await userEvent.click(menuTrigger);
    await userEvent.click(screen.getByText('Delete'));
    expect(onDelete).toHaveBeenCalledWith(collage);
  });
});
