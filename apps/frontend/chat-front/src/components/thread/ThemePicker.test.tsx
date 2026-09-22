import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemePicker } from './ThemePicker';
import { CHAT_THEMES, themeById } from './themes';
import type { Appearance } from '../../types';

const classic: Appearance = { theme: 'classic', backgroundFileId: null, backgroundUrl: null };

const renderPicker = (appearance: Appearance = classic, onChange = vi.fn(async () => undefined)) => {
  render(<ThemePicker open onClose={() => {}} appearance={appearance} onChange={onChange} />);
  return onChange;
};

describe('ThemePicker', () => {
  it('offers every theme and marks the current one', () => {
    renderPicker({ ...classic, theme: 'ocean' });

    expect(screen.getAllByRole('radio')).toHaveLength(CHAT_THEMES.length);
    expect(screen.getByRole('radio', { name: 'Ocean' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Classic' })).toHaveAttribute('aria-checked', 'false');
  });

  it('changes the theme', async () => {
    const onChange = renderPicker();

    await userEvent.click(screen.getByRole('radio', { name: 'Forest' }));

    expect(onChange).toHaveBeenCalledWith({ theme: 'forest' });
  });

  it('says where a background photo comes from when there is none', () => {
    renderPicker();
    expect(screen.getByText(/choose Use as background/)).toBeInTheDocument();
  });

  it('removes the background photo', async () => {
    const onChange = renderPicker({ theme: 'classic', backgroundFileId: 'f1', backgroundUrl: 'https://files.test/f1' });

    await userEvent.click(screen.getByRole('button', { name: 'Remove background' }));

    expect(onChange).toHaveBeenCalledWith({ backgroundFileId: null });
  });

  it('says so when a change fails', async () => {
    renderPicker(classic, vi.fn(async () => Promise.reject(new Error('down'))));

    await userEvent.click(screen.getByRole('radio', { name: 'Sunset' }));

    expect(await screen.findByText('Could not change that. Try again.')).toBeInTheDocument();
  });
});

describe('themeById', () => {
  it('falls back to Classic for a theme this version does not know', () => {
    expect(themeById('neon').id).toBe('classic');
    expect(themeById(undefined).id).toBe('classic');
  });
});
