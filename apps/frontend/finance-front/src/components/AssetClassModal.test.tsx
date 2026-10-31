import type { SetStateAction } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vite-plus/test';

vi.mock('@tumbaland/frontend-core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tumbaland/frontend-core')>()),
  GroupSelector: () => <div>group selector</div>
}));

import AssetClassModal, { AssetClassFormValues } from './AssetClassModal';

function renderModal(overrides: Partial<{ title: string; form: Partial<AssetClassFormValues> }> = {}) {
  const form: AssetClassFormValues = {
    name: '',
    description: '',
    color: '',
    kind: 'asset',
    groupId: undefined,
    ...overrides.form
  };
  // setForm's updater closes over the SyntheticEvent, whose `target` is the live DOM node — if we
  // deferred calling it until after the test's `await` settles, the controlled input would already
  // have snapped its value back to the (unchanged) `form` prop. Apply the updater immediately, the
  // same tick React invokes setForm, to capture the real typed value.
  const results: AssetClassFormValues[] = [];
  const setForm = vi.fn((updater: SetStateAction<AssetClassFormValues>) => {
    const next =
      typeof updater === 'function' ? (updater as (f: AssetClassFormValues) => AssetClassFormValues)(form) : updater;
    results.push(next);
  });
  const onSubmit = vi.fn();
  const onClose = vi.fn();

  render(
    <AssetClassModal
      open
      onClose={onClose}
      onSubmit={onSubmit}
      form={form}
      setForm={setForm}
      title={overrides.title ?? 'Add Asset Class'}
    />
  );

  return { setForm, onSubmit, onClose, form, results };
}

it('shows "Add" on the submit button for a new asset class', () => {
  renderModal({ title: 'Add Asset Class' });
  expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
});

it('shows "Update" on the submit button when editing', () => {
  renderModal({ title: 'Edit Asset Class' });
  expect(screen.getByRole('button', { name: 'Update' })).toBeInTheDocument();
});

it('updates the name field via setForm', async () => {
  const { setForm, results } = renderModal();
  await userEvent.type(screen.getByLabelText(/^Name/), 'X');

  expect(setForm).toHaveBeenCalled();
  expect(results[0]).toMatchObject({ name: 'X' });
});

it('updates the description field via setForm', async () => {
  const { results } = renderModal();
  await userEvent.type(screen.getByLabelText('Description'), 'Y');

  expect(results[0]).toMatchObject({ description: 'Y' });
});

// The color swatches are Boxes styled entirely via `sx` (an emotion class, not an
// inline style), so they must be located by their computed background color.
function findSwatch(rgb: string): HTMLElement {
  const match = Array.from(document.body.querySelectorAll('div')).find(
    (d) => getComputedStyle(d).backgroundColor === rgb
  );
  if (!match) throw new Error(`no swatch found for ${rgb}`);
  return match as HTMLElement;
}

it('selects a predefined color swatch', async () => {
  const { setForm, results } = renderModal();
  const swatch = findSwatch('rgb(59, 130, 246)'); // #3b82f6

  await userEvent.click(swatch);

  expect(setForm).toHaveBeenCalled();
  expect(results[0]).toMatchObject({ color: '#3b82f6' });
});

it('marks the currently selected color swatch with an inner white dot', () => {
  renderModal({ form: { color: '#3b82f6' } });
  const swatch = findSwatch('rgb(59, 130, 246)');
  expect(swatch.children.length).toBe(1);

  const unselected = findSwatch('rgb(239, 68, 68)'); // #ef4444
  expect(unselected.children.length).toBe(0);
});

it('updates the custom hex color field via setForm', async () => {
  const { results } = renderModal();
  await userEvent.type(screen.getByLabelText('Custom Color (hex)'), '#');

  expect(results[0]).toMatchObject({ color: '#' });
});

it('calls onClose and onSubmit', async () => {
  const { onClose, onSubmit, form } = renderModal();

  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onClose).toHaveBeenCalled();

  await userEvent.click(screen.getByRole('button', { name: 'Add' }));
  expect(onSubmit).toHaveBeenCalledWith(form);
});

it('switches the class between asset and liability', async () => {
  const { setForm, results } = renderModal();

  await userEvent.click(screen.getByRole('button', { name: /liability/i }));

  expect(setForm).toHaveBeenCalled();
  expect(results.at(-1)?.kind).toBe('liability');
});

it('lets an asset class be marked as cash, sellable or locked', async () => {
  const { results } = renderModal();

  await userEvent.click(screen.getByRole('button', { name: 'Locked' }));

  expect(results.at(-1)?.liquidity).toBe('locked');
});

it('says what the chosen reachability means, and what an unset one is for', () => {
  renderModal({ form: { liquidity: 'cash' } });
  expect(screen.getByText(/spendable now/i)).toBeInTheDocument();
});

it('explains why to set it when it has not been', () => {
  renderModal();
  expect(screen.getByText(/how long your money would last/i)).toBeInTheDocument();
});

it('does not ask how reachable a debt is', () => {
  renderModal({ form: { kind: 'liability' } });
  expect(screen.queryByText('How easily can you reach it?')).not.toBeInTheDocument();
});

it('explains what a liability does to net worth', () => {
  renderModal({ form: { kind: 'liability' } });

  expect(screen.getByText(/subtracted from net worth/i)).toBeInTheDocument();
});

it('describes an asset class as adding to net worth', () => {
  renderModal();

  expect(screen.getByText(/adds to net worth/i)).toBeInTheDocument();
});
