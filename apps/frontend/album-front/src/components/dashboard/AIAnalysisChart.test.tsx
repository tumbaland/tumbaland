import { render, screen } from '@testing-library/react';
import AIAnalysisChart from './AIAnalysisChart';

it('renders the analysis rate, photo counts, detections, and masks', () => {
  render(
    <AIAnalysisChart
      data={{ totalPhotos: 200, analyzedPhotos: 150, analysisRate: 75.456, totalDetections: 42, totalMasks: 8 }}
    />
  );

  expect(screen.getByText('75.5%')).toBeInTheDocument();
  expect(screen.getByText('150')).toBeInTheDocument();
  expect(screen.getByText('of 200 total')).toBeInTheDocument();
  expect(screen.getByText('42')).toBeInTheDocument();
  expect(screen.getByText('8')).toBeInTheDocument();
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '75.456');
});
