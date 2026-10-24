import { createTheme } from '@mui/material';
import { barLabelOn, chipColors, monthAxis, monthLabel, readableOn } from './ChartCard';

const light = createTheme().palette;
const dark = createTheme({ palette: { mode: 'dark' } }).palette;

describe('readableOn', () => {
  it('picks white on a dark fill and dark text on a light one', () => {
    expect(readableOn(light, '#1b1b1b')).toBe(light.getContrastText('#1b1b1b'));
    expect(readableOn(light, '#1b1b1b')).not.toBe(readableOn(light, '#f5f5f5'));
  });

  it('falls back to the text colour for a fill that sits on the card', () => {
    expect(readableOn(light, 'transparent')).toBe(light.text.primary);
    expect(readableOn(dark, 'transparent')).toBe(dark.text.primary);
    expect(readableOn(dark, 'transparent')).not.toBe(readableOn(light, 'transparent'));
  });
});

describe('chipColors', () => {
  it('fills with the colour and labels in whichever reads on it', () => {
    expect(chipColors(light, '#ffeb3b')).toEqual({ backgroundColor: '#ffeb3b', color: readableOn(light, '#ffeb3b') });
  });
});

describe('barLabelOn', () => {
  it("draws a label in the bar's readable colour at the given size", () => {
    const { style } = barLabelOn(light, '10px', { transform: 'translateY(-10px)' })({ color: '#1b1b1b' });

    expect(style).toEqual({
      fill: readableOn(light, '#1b1b1b'),
      fontSize: '10px',
      fontWeight: 'bold',
      transform: 'translateY(-10px)'
    });
  });
});

describe('month axis', () => {
  it('labels a month with its year', () => {
    expect(monthLabel({ month: '03', year: 2025 })).toBe('Mar 2025');
  });

  it('ticks the year at the first month and at each January, nothing between', () => {
    const labels = ['Nov 2024', 'Dec 2024', 'Jan 2025', 'Feb 2025'];
    const axis = monthAxis(labels);
    const format = (value: string, location: 'tick' | 'tooltip') =>
      axis.valueFormatter!(value, { location } as never);

    expect(format('Nov 2024', 'tick')).toBe('2024');
    expect(format('Dec 2024', 'tick')).toBe('');
    expect(format('Jan 2025', 'tick')).toBe('2025');
    expect(format('Feb 2025', 'tick')).toBe('');
    expect(format('Feb 2025', 'tooltip')).toBe('Feb 2025');
  });
});
