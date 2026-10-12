import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vite-plus/test';
import type { ComponentProps } from 'react';
import type LocationPicker from './map/LocationPicker';

let tenant: string | undefined = 'g1';
vi.mock('@tumbaland/frontend-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tumbaland/frontend-core')>();
  return { ...actual, useTenantFilter: () => tenant };
});
vi.mock('../services/plans', () => ({
  createPlan: vi.fn(),
  updatePlan: vi.fn(),
  deletePlan: vi.fn(),
  logPlan: vi.fn()
}));
vi.mock('../services/activityTypes', () => ({ getActivityTypes: vi.fn() }));
vi.mock('../services/places', () => ({ getPlaces: vi.fn() }));
vi.mock('./map/LocationPicker', () => ({
  default: ({ onChange }: ComponentProps<typeof LocationPicker>) => (
    <button onClick={() => onChange({ label: 'Saku Arena', lat: 59.4, lng: 24.7 })}>pick-place</button>
  )
}));

import { createPlan, deletePlan, logPlan, updatePlan } from '../services/plans';
import { getActivityTypes } from '../services/activityTypes';
import { getPlaces } from '../services/places';
import PlanEditorDialog from './PlanEditorDialog';
import { Plan } from '../services/types';

const mocked = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const concerts = {
  _id: 't1',
  id: 't1',
  name: 'Concerts',
  slug: 'concerts',
  color: '#f00',
  isActive: true,
  sortOrder: 0,
  createdAt: '',
  updatedAt: '',
  userId: 'u1'
};

const plan = (over: Partial<Plan> = {}): Plan => ({
  _id: 'p1',
  id: 'p1',
  title: 'Concert',
  date: '2024-05-01',
  endDate: null,
  time: '19:00',
  timeZone: 'Europe/Tallinn',
  startsAt: '2024-05-01T16:00:00.000Z',
  typeId: null,
  location: null,
  remindBefore: 60,
  remindAt: null,
  remindedAt: null,
  loggedActivityId: null,
  userId: 'u1',
  groupId: 'g1',
  ...over
});

const renderEditor = (props: Partial<ComponentProps<typeof PlanEditorDialog>> = {}) => {
  const handlers = { onClose: vi.fn(), onSaved: vi.fn(), onDeleted: vi.fn(), onLogged: vi.fn() };
  render(<PlanEditorDialog open {...handlers} {...props} />);
  return handlers;
};

/** Picks an option of an MUI select by the select's label. */
const choose = async (label: string, option: string) => {
  await userEvent.click(screen.getByLabelText(label));
  await userEvent.click(within(screen.getByRole('listbox')).getByText(option));
};

beforeEach(() => {
  vi.clearAllMocks();
  tenant = 'g1';
  mocked(getActivityTypes).mockResolvedValue({ data: [concerts], pagination: {} });
  mocked(getPlaces).mockResolvedValue([]);
  mocked(createPlan).mockImplementation(async (input) => plan(input));
  mocked(updatePlan).mockImplementation(async (_id, patch) => plan(patch));
});

it('makes a plan at 19:00 with an hour-before reminder in the journal’s group', async () => {
  const { onSaved, onClose } = renderEditor({ date: '2099-05-16' });

  await userEvent.type(screen.getByLabelText('What'), 'Concert');
  await userEvent.click(screen.getByText('pick-place'));
  expect(screen.getByText('Everyone in this journal gets it in your chat')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  expect(createPlan).toHaveBeenCalledWith({
    title: 'Concert',
    date: '2099-05-16',
    endDate: null,
    time: '19:00',
    remindBefore: 60,
    location: { label: 'Saku Arena', lat: 59.4, lng: 24.7 },
    typeId: null,
    notes: '',
    groupId: 'g1'
  });
  expect(onSaved).toHaveBeenCalled();
  expect(onClose).toHaveBeenCalled();
});

it('makes an all-day plan reminded about that morning, or not at all', async () => {
  renderEditor({ date: '2099-05-16' });
  await userEvent.type(screen.getByLabelText('What'), 'Weekend away');
  await choose('Reminder', '3 hours before');
  await userEvent.click(screen.getByLabelText('All day'));

  // "3 hours before" has no meaning all day, so it falls back to that morning
  expect(screen.queryByLabelText('Time')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Reminder')).toHaveTextContent('That morning at 9:00');

  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(createPlan).toHaveBeenCalledWith(expect.objectContaining({ time: null, remindBefore: 0 }));

  await choose('Reminder', 'No reminder');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(createPlan).toHaveBeenLastCalledWith(expect.objectContaining({ remindBefore: null }));
});

it('makes a trip over several days, all day, ending the day after unless changed', async () => {
  renderEditor({ date: '2099-05-16' });
  await userEvent.type(screen.getByLabelText('What'), 'Rome');
  await userEvent.click(screen.getByLabelText('Several days'));

  expect(screen.getByLabelText('All day')).toBeChecked();
  expect(screen.getByLabelText('Until')).toHaveValue('2099-05-17');
  await userEvent.clear(screen.getByLabelText('Until'));
  await userEvent.type(screen.getByLabelText('Until'), '2099-05-20');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  expect(createPlan).toHaveBeenCalledWith(
    expect.objectContaining({ title: 'Rome', date: '2099-05-16', endDate: '2099-05-20', time: null })
  );
});

it('refuses a trip that ends before it starts', async () => {
  renderEditor({ plan: plan({ date: '2099-05-16', endDate: '2099-05-18', time: null }) });
  expect(screen.getByLabelText('Several days')).toBeChecked();
  await userEvent.clear(screen.getByLabelText('Until'));
  await userEvent.type(screen.getByLabelText('Until'), '2099-05-10');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByText('The last day can’t be before the first')).toBeInTheDocument();
  expect(updatePlan).not.toHaveBeenCalled();
});

it('says a personal plan’s reminder comes as a notification', async () => {
  tenant = undefined;
  renderEditor();
  expect(screen.getByText('You get it as a notification')).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('What'), 'Dentist');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(mocked(createPlan).mock.calls[0][0]).not.toHaveProperty('groupId');
});

it('needs a name, and a time unless it is all day', async () => {
  renderEditor();
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByText('Give the plan a name')).toBeInTheDocument();

  await userEvent.type(screen.getByLabelText('What'), 'Concert');
  await userEvent.clear(screen.getByLabelText('Time'));
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByText('Choose a time, or make it all day')).toBeInTheDocument();
  expect(createPlan).not.toHaveBeenCalled();
});

it('changes an existing plan', async () => {
  const { onSaved } = renderEditor({ plan: plan({ date: '2099-05-16', notes: 'Tickets in email' }) });
  expect(screen.getByLabelText('What')).toHaveValue('Concert');
  expect(screen.getByLabelText('Notes')).toHaveValue('Tickets in email');
  expect(screen.queryByRole('button', { name: 'Log it' })).not.toBeInTheDocument();

  await choose('Activity', 'Concerts');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  expect(updatePlan).toHaveBeenCalledWith('p1', expect.objectContaining({ title: 'Concert', typeId: 't1' }));
  expect(onSaved).toHaveBeenCalled();
});

it('shows why a save failed', async () => {
  mocked(updatePlan).mockRejectedValue(new Error('Unknown time zone'));
  renderEditor({ plan: plan() });
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Unknown time zone')).toBeInTheDocument();
});

it('deletes a plan once that is confirmed', async () => {
  mocked(deletePlan).mockResolvedValue(undefined);
  const { onDeleted } = renderEditor({ plan: plan() });

  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(screen.getByText('Delete this plan?')).toBeInTheDocument();
  await userEvent.click(within(screen.getAllByRole('dialog').at(-1)!).getByRole('button', { name: 'Delete' }));

  await waitFor(() => expect(deletePlan).toHaveBeenCalledWith('p1'));
  expect(onDeleted).toHaveBeenCalledWith('p1');
});

it('logs a plan whose day has come as the chosen activity, then opens that day', async () => {
  mocked(logPlan).mockResolvedValue({ plan: plan({ loggedActivityId: 'a1' }), activityId: 'a1' });
  const { onLogged } = renderEditor({ plan: plan() });

  await userEvent.click(screen.getByRole('button', { name: 'Log it' }));
  expect(screen.getByText('Choose the activity to log it as')).toBeInTheDocument();

  await choose('Activity', 'Concerts');
  await userEvent.click(screen.getByRole('button', { name: 'Log it' }));

  await waitFor(() => expect(logPlan).toHaveBeenCalledWith('p1', 't1'));
  // what is on screen is saved before it is logged
  expect(mocked(updatePlan).mock.invocationCallOrder[0]).toBeLessThan(mocked(logPlan).mock.invocationCallOrder[0]!);
  expect(onLogged).toHaveBeenCalledWith('2024-05-01');
});

it('says when a plan is in the journal already, and does not offer to log it again', () => {
  renderEditor({ plan: plan({ loggedActivityId: 'a1' }) });
  expect(screen.getByText('This one is in the journal now.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Log it' })).not.toBeInTheDocument();
});

it('opens an all-day plan without a reminder as it was saved', () => {
  renderEditor({ plan: plan({ time: null, remindBefore: null }) });
  expect(screen.getByLabelText('All day')).toBeChecked();
  expect(screen.getByLabelText('Reminder')).toHaveTextContent('No reminder');
});
