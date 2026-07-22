import { render, screen } from '@testing-library/react';
import TabPanel from './TabPanel';

it('renders its children when value matches index', () => {
  render(
    <TabPanel value={0} index={0}>
      <div>panel content</div>
    </TabPanel>
  );

  const panel = screen.getByRole('tabpanel', { hidden: true });
  expect(panel).not.toHaveAttribute('hidden');
  expect(screen.getByText('panel content')).toBeInTheDocument();
});

it('hides its children when value does not match index', () => {
  render(
    <TabPanel value={1} index={0}>
      <div>panel content</div>
    </TabPanel>
  );

  const panel = screen.getByRole('tabpanel', { hidden: true });
  expect(panel).toHaveAttribute('hidden');
  expect(screen.queryByText('panel content')).not.toBeInTheDocument();
});

it('sets id/aria-labelledby from the index', () => {
  render(
    <TabPanel value={2} index={2}>
      <div>content</div>
    </TabPanel>
  );

  const panel = screen.getByRole('tabpanel', { hidden: true });
  expect(panel).toHaveAttribute('id', 'photo-tabpanel-2');
  expect(panel).toHaveAttribute('aria-labelledby', 'photo-tab-2');
});
