import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const api = vi.hoisted(() => ({ searchPlaces: vi.fn() }));
vi.mock('../../services/chatApi', () => ({ chatApi: api }));

import { PlaceField } from './PlaceField';
import type { SavedPlace } from '../../types';

const HOME: SavedPlace = { id: 'p-home', name: 'Home', lat: 59.5, lng: 24.8, address: 'Viru 4, Tallinn' };

const field = (props: Partial<Parameters<typeof PlaceField>[0]> = {}) =>
  render(
    <PlaceField
      label="To"
      primary="Where to?"
      color="#2e7d32"
      filled={false}
      savedPlaces={[HOME]}
      onPick={() => {}}
      {...props}
    />
  );

beforeEach(() => {
  api.searchPlaces.mockReset().mockResolvedValue([]);
});

describe('PlaceField', () => {
  it('reads as the place, with its address under it', () => {
    field({ primary: 'Home', secondary: 'Viru 4, Tallinn', filled: true });
    expect(screen.getByRole('button', { name: 'To: Home, Viru 4, Tallinn. Change' })).toBeInTheDocument();
  });

  it('offers saved places first when it is opened to search', async () => {
    const onPick = vi.fn();
    field({ onPick });

    await userEvent.click(screen.getByRole('button', { name: /^To: Where to\?/ }));
    await userEvent.click(await screen.findByRole('option', { name: /Home/ }));

    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ name: 'Home', lat: 59.5, lng: 24.8 }));
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('looks up what is typed, near where the person is', async () => {
    api.searchPlaces.mockResolvedValue([{ name: 'Kalev Spa', detail: 'Tallinn', lat: 59.44, lng: 24.76 }]);
    const onPick = vi.fn();
    field({ onPick, near: { lat: 59.4, lng: 24.7 }, startSearching: true });

    await userEvent.type(screen.getByRole('combobox'), 'kalev');
    await userEvent.click(await screen.findByRole('option', { name: /Kalev Spa/ }));

    expect(api.searchPlaces).toHaveBeenCalledWith('kalev', { lat: 59.4, lng: 24.7 });
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ name: 'Kalev Spa', lat: 59.44 }));
  });

  it('says when nothing is found, and filters saved places by what is typed', async () => {
    field({ startSearching: true });

    await userEvent.type(screen.getByRole('combobox'), 'zzz');

    expect(await screen.findByText('Nothing found')).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Home/ })).not.toBeInTheDocument();
  });

  it('clears old search results as soon as the query changes', async () => {
    api.searchPlaces.mockResolvedValue([{ name: 'Kalev Spa', detail: 'Tallinn', lat: 59.44, lng: 24.76 }]);
    field({ startSearching: true });
    await userEvent.type(screen.getByRole('combobox'), 'kalev');
    expect(await screen.findByRole('option', { name: /Kalev Spa/ })).toBeInTheDocument();
    api.searchPlaces.mockReturnValue(new Promise(() => {}));
    await userEvent.type(screen.getByRole('combobox'), 'x');
    expect(screen.queryByRole('option', { name: /Kalev Spa/ })).not.toBeInTheDocument();
  });

  it('offers "Your location" when it was given, and goes back on Escape', async () => {
    field({
      label: 'From',
      startSearching: true,
      extraOptions: [{ key: 'gps', group: 'Here', name: 'Your location', detail: '' }]
    });

    expect(await screen.findByRole('option', { name: /Your location/ })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: /^From: Where to\?/ })).toBeInTheDocument();
  });

  it('can save a place, or clear it', async () => {
    const onSave = vi.fn();
    const onClear = vi.fn();
    field({ primary: 'Viru 4', filled: true, onSave, onClear });

    await userEvent.click(screen.getByRole('button', { name: 'Save this place' }));
    await userEvent.click(screen.getByRole('button', { name: 'Clear to' }));

    expect(onSave).toHaveBeenCalled();
    expect(onClear).toHaveBeenCalled();
  });

  it('shows a saved place as saved', () => {
    field({ primary: 'Home', filled: true, saved: true, onSave: () => {} });
    expect(screen.getByRole('button', { name: 'Saved' })).toBeDisabled();
  });
});
