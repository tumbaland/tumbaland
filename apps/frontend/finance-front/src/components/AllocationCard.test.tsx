import { render, screen } from '@testing-library/react';
import AllocationCard from './AllocationCard';

const allocation = [
  { assetClassId: 'a1', name: 'Stocks', color: '#111111', value: 8000, gain: 500, percentage: 80 },
  { assetClassId: 'a2', name: 'Bonds', color: '#222222', value: 2000, gain: 100, percentage: 20 }
];

it('renders nothing when there is no allocation data', () => {
  const { container } = render(<AllocationCard allocation={[]} />);
  expect(container).toBeEmptyDOMElement();
});

it('renders a row per asset class with its value and percentage', () => {
  render(<AllocationCard allocation={allocation} />);

  expect(screen.getByText('Stocks')).toBeInTheDocument();
  expect(screen.getByText('Bonds')).toBeInTheDocument();
  expect(screen.getByText(/80\.0%/)).toBeInTheDocument();
  expect(screen.getByText(/20\.0%/)).toBeInTheDocument();
});

it('lists liabilities separately from the asset donut', () => {
  render(
    <AllocationCard
      allocation={[
        { assetClassId: 'a1', name: 'Stocks', color: '#111', value: 300, gain: 0, percentage: 100 }
      ]}
      liabilities={[{ assetClassId: 'a3', name: 'Mortgage', color: '#333', value: 100 }]}
    />
  );

  expect(screen.getByText('Liabilities')).toBeInTheDocument();
  expect(screen.getByText('Mortgage')).toBeInTheDocument();
  expect(screen.getByText('−100 €')).toBeInTheDocument();
});

it('omits the liabilities section when there are none', () => {
  render(
    <AllocationCard
      allocation={[
        { assetClassId: 'a1', name: 'Stocks', color: '#111', value: 300, gain: 0, percentage: 100 }
      ]}
    />
  );

  expect(screen.queryByText('Liabilities')).not.toBeInTheDocument();
});

it('formats values in the given base currency', () => {
  render(
    <AllocationCard
      allocation={[
        { assetClassId: 'a1', name: 'Stocks', color: '#111', value: 300, gain: 0, percentage: 100 }
      ]}
      currency="USD"
    />
  );

  expect(screen.getByText(/300 \$/)).toBeInTheDocument();
});
