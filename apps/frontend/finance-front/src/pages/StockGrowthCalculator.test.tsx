import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import StockGrowthCalculator from './StockGrowthCalculator';

function getNumberInput(label: string) {
  return screen.getByLabelText(label) as HTMLInputElement;
}

function hasFormLabel(labelText: string): boolean {
  return Array.from(document.querySelectorAll('label')).some((l) => l.textContent === labelText);
}

async function setNumber(label: string, value: string) {
  const input = getNumberInput(label);
  await userEvent.clear(input);
  if (value !== '') await userEvent.type(input, value);
  return input;
}

// These MUI Selects don't wire aria-labelledby back to the floating InputLabel, so
// getByLabelText can't find them — locate the <label> by its exact text instead, then
// open the combobox inside that label's FormControl.
async function openSelect(labelText: string) {
  const label = Array.from(document.querySelectorAll('label')).find((l) => l.textContent === labelText);
  if (!label) throw new Error(`no label found for ${labelText}`);
  const formControl = label.closest('.MuiFormControl-root') as HTMLElement;
  const combobox = formControl.querySelector('[role="combobox"]') as HTMLElement;
  await userEvent.click(combobox);
}

async function selectOption(labelText: string, optionName: string | RegExp) {
  await openSelect(labelText);
  await userEvent.click(await screen.findByRole('option', { name: optionName }));
}

it('auto-calculates on mount with the default inputs', () => {
  render(<StockGrowthCalculator />);
  expect(screen.getByText('Final Results (Year 30)')).toBeInTheDocument();
  expect(screen.getByText('Detailed Yearly Breakdown')).toBeInTheDocument();
  // 30 yearly rows
  expect(screen.getAllByRole('row').length).toBeGreaterThan(30);
});

it('recalculates when an input changes, e.g. a shorter investment period', async () => {
  render(<StockGrowthCalculator />);
  await setNumber('Investment Period (Years)', '5');
  expect(await screen.findByText('Final Results (Year 5)')).toBeInTheDocument();
});

it('switches to monthly contributions, revealing the Monthly Investment field', async () => {
  render(<StockGrowthCalculator />);
  await selectOption('Contribution Frequency', 'Monthly');

  expect(screen.getByLabelText('Monthly Investment (EUR)')).toBeInTheDocument();
  expect(screen.queryByLabelText('Annual Investment (EUR)')).not.toBeInTheDocument();
});

it('switches compounding to monthly and still produces yearly results', async () => {
  render(<StockGrowthCalculator />);
  await selectOption('Compounding', 'Monthly');

  expect(await screen.findByText('Final Results (Year 30)')).toBeInTheDocument();
});

it('combines monthly compounding with monthly contributions', async () => {
  render(<StockGrowthCalculator />);
  await selectOption('Contribution Frequency', 'Monthly');
  await selectOption('Compounding', 'Monthly');

  expect(await screen.findByText('Final Results (Year 30)')).toBeInTheDocument();
});

it.each([
  ['Conservative', '6'],
  ['Base', '8'],
  ['Aggressive', '12']
])('applies the %s preset, setting expected growth to %s%%', async (presetLabel, expectedGrowth) => {
  render(<StockGrowthCalculator />);
  await selectOption('Scenario Preset', presetLabel);

  expect(getNumberInput('Expected Annual Growth (%)').value).toBe(expectedGrowth);
});

it('returns to the custom preset without changing growth/volatility', async () => {
  render(<StockGrowthCalculator />);
  await selectOption('Scenario Preset', 'Aggressive');
  expect(getNumberInput('Expected Annual Growth (%)').value).toBe('12');

  await selectOption('Scenario Preset', 'Custom');
  expect(getNumberInput('Expected Annual Growth (%)').value).toBe('12');
});

it('shows time-to-goal once a target goal is set and reached', async () => {
  render(<StockGrowthCalculator />);
  await setNumber('Target Goal (EUR)', '5000');

  expect(await screen.findByText('Years to Goal:')).toBeInTheDocument();
  expect(screen.getByText(/^\d+ years$/)).toBeInTheDocument();
});

it('shows "Not reached" when the goal is unreachable in the given period', async () => {
  render(<StockGrowthCalculator />);
  await setNumber('Target Goal (EUR)', '999999999');

  expect(await screen.findByText('Not reached')).toBeInTheDocument();
});

it('enables Monte Carlo, revealing volatility/simulations/distribution controls', async () => {
  render(<StockGrowthCalculator />);
  await setNumber('Investment Period (Years)', '3');
  await selectOption('Monte Carlo', 'On');

  expect(screen.getByLabelText('Annual Volatility (%)')).toBeInTheDocument();
  expect(screen.getByLabelText('# Simulations')).toBeInTheDocument();
  expect(hasFormLabel('Return Distribution')).toBe(true);
});

it("reveals Student's t degrees of freedom for the studentT distribution", async () => {
  render(<StockGrowthCalculator />);
  await setNumber('Investment Period (Years)', '3');
  await selectOption('Monte Carlo', 'On');
  await setNumber('# Simulations', '100'); // keep the Monte Carlo run cheap

  await selectOption('Return Distribution', /Student's t/);

  expect(await screen.findByLabelText("Student t degrees of freedom")).toBeInTheDocument();
});

it('reveals the tail-shock probability field for the mixture distribution', async () => {
  render(<StockGrowthCalculator />);
  await setNumber('Investment Period (Years)', '3');
  await selectOption('Monte Carlo', 'On');
  await setNumber('# Simulations', '100');

  await selectOption('Return Distribution', /Mixture/);

  expect(await screen.findByLabelText('Tail shock probability')).toBeInTheDocument();
});

it('disables Monte Carlo again, hiding its controls', async () => {
  render(<StockGrowthCalculator />);
  await setNumber('Investment Period (Years)', '3');
  await selectOption('Monte Carlo', 'On');
  expect(screen.getByLabelText('Annual Volatility (%)')).toBeInTheDocument();

  await selectOption('Monte Carlo', 'Off');

  expect(screen.queryByLabelText('Annual Volatility (%)')).not.toBeInTheDocument();
});

it('recalculates via the Calculate button and resets via the Reset button', async () => {
  render(<StockGrowthCalculator />);
  await setNumber('Investment Period (Years)', '10');
  await userEvent.click(screen.getByRole('button', { name: 'Calculate' }));
  expect(await screen.findByText('Final Results (Year 10)')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Reset' }));

  expect(await screen.findByText('Final Results (Year 30)')).toBeInTheDocument();
  expect(getNumberInput('Investment Period (Years)').value).toBe('30');
});

it('downloads a CSV of the results', async () => {
  const createObjectURL = vi.fn().mockReturnValue('blob:mock');
  const revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  render(<StockGrowthCalculator />);
  await userEvent.click(screen.getByRole('button', { name: /download csv/i }));

  expect(createObjectURL).toHaveBeenCalled();
  expect(clickSpy).toHaveBeenCalled();
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');

  clickSpy.mockRestore();
  vi.unstubAllGlobals();
});
