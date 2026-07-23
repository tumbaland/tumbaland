import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('../services/segmentationService', () => ({
  segmentationService: {
    checkAllServicesHealth: vi.fn(),
    segmentImage: vi.fn(),
    getSegmentationResult: vi.fn(),
    getSegmentationVisualizationUrl: vi.fn((jobId: string) => `https://seg.example/${jobId}`),
    getSegmentationMaskUrl: vi.fn((jobId: string, filename: string) => `https://seg.example/${jobId}/${filename}`)
  }
}));
vi.mock('../services/albumService', () => ({
  albumService: { updatePhotoAIAnalysis: vi.fn() }
}));

import { segmentationService } from '../services/segmentationService';
import { albumService } from '../services/albumService';
import SegmentationView from './SegmentationView';
import { makePhoto } from '../test/fixtures';

const mockedCheckHealth = segmentationService.checkAllServicesHealth as unknown as ReturnType<typeof vi.fn>;
const mockedSegmentImage = segmentationService.segmentImage as unknown as ReturnType<typeof vi.fn>;
const mockedGetResult = segmentationService.getSegmentationResult as unknown as ReturnType<typeof vi.fn>;

const formatDate = (d: string) => d;

beforeEach(() => {
  vi.clearAllMocks();
  mockedCheckHealth.mockResolvedValue({ segmentation: true, lastChecked: new Date('2024-01-01T00:00:00Z') });
});

it('checks health on mount and shows an Online chip', async () => {
  render(<SegmentationView photo={makePhoto()} formatDate={formatDate} />);

  expect(await screen.findByText('Segmentation: Online')).toBeInTheDocument();
});

it('shows an Offline chip and disables the button when unhealthy', async () => {
  mockedCheckHealth.mockResolvedValue({ segmentation: false, lastChecked: new Date() });
  render(<SegmentationView photo={makePhoto()} formatDate={formatDate} />);

  expect(await screen.findByText('Segmentation: Offline')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /semantic segmentation/i })).toBeDisabled();
});

it('re-checks health when Refresh is clicked', async () => {
  render(<SegmentationView photo={makePhoto()} formatDate={formatDate} />);
  await screen.findByText('Segmentation: Online');

  await userEvent.click(screen.getByRole('button', { name: /refresh/i }));

  await waitFor(() => expect(mockedCheckHealth).toHaveBeenCalledTimes(2));
});

it('shows the no-analysis message when nothing has been analyzed yet', async () => {
  render(<SegmentationView photo={makePhoto()} formatDate={formatDate} />);
  await screen.findByText('Segmentation: Online');

  expect(screen.getByText(/no segmentation analysis has been performed/i)).toBeInTheDocument();
});

it('rejects running analysis on a non-image file', async () => {
  const photo = makePhoto({ mimetype: 'video/mp4' });
  render(<SegmentationView photo={photo} formatDate={formatDate} />);
  await screen.findByText('Segmentation: Online');

  await userEvent.click(screen.getByRole('button', { name: /semantic segmentation/i }));

  expect(screen.getByText('Segmentation is only available for image files.')).toBeInTheDocument();
  expect(mockedSegmentImage).not.toHaveBeenCalled();
});

it('runs analysis, shows the detailed results, updates AI analysis, and notifies the parent', async () => {
  mockedSegmentImage.mockResolvedValue({
    success: true,
    job_id: 'job-1',
    total_masks: 1,
    segmentation_type: 'automatic',
    processing_time: 1.2,
    image_dimensions: { width: 100, height: 100 },
    masks: [
      { mask_file_path: '/results/masks_job-1/mask_000.png', area: 500, bbox: [1, 2, 10, 20], predicted_iou: 0.9 }
    ]
  });
  const onAnalysisComplete = vi.fn();
  const photo = makePhoto({ _id: 'photo-1', mimetype: 'image/jpeg' });
  render(<SegmentationView photo={photo} formatDate={formatDate} onAnalysisComplete={onAnalysisComplete} />);
  await screen.findByText('Segmentation: Online');

  await userEvent.click(screen.getByRole('button', { name: /semantic segmentation/i }));

  expect(await screen.findByText('Segmentation Details')).toBeInTheDocument();
  expect(screen.getByText('Mask 1')).toBeInTheDocument();
  expect(albumService.updatePhotoAIAnalysis).toHaveBeenCalledWith('photo-1', {
    analysisType: 'segmentation',
    jobId: 'job-1',
    totalMasks: 1,
    segmentationType: 'automatic',
    processingTime: 1.2
  });
  expect(onAnalysisComplete).toHaveBeenCalledTimes(1);
});

it('shows an error message when analysis fails', async () => {
  mockedSegmentImage.mockRejectedValue(new Error('down'));
  render(<SegmentationView photo={makePhoto({ mimetype: 'image/jpeg' })} formatDate={formatDate} />);
  await screen.findByText('Segmentation: Online');

  await userEvent.click(screen.getByRole('button', { name: /semantic segmentation/i }));

  expect(await screen.findByText('Failed to run segmentation analysis.')).toBeInTheDocument();
});

it('auto-loads previous analysis details when the photo already has a jobId', async () => {
  mockedGetResult.mockResolvedValue({
    job_id: 'job-1',
    segmentation_type: 'automatic',
    model_name: 'sam',
    processing_time: 0.8,
    total_masks: 0,
    masks: []
  });
  const photo = makePhoto({
    aiAnalysis: {
      segmentation: { jobId: 'job-1', analyzedAt: '2024-01-01', totalMasks: 2, segmentationType: 'automatic', processingTime: 1.5 }
    }
  });
  render(<SegmentationView photo={photo} formatDate={formatDate} />);

  await waitFor(() => expect(mockedGetResult).toHaveBeenCalledWith('job-1'));
  expect(await screen.findByText('Segmentation Details')).toBeInTheDocument();
  expect(screen.getByText('Previous Segmentation Analysis')).toBeInTheDocument();
});

it('shows an error when loading previous details fails', async () => {
  mockedGetResult.mockRejectedValue(new Error('gone'));
  const photo = makePhoto({
    aiAnalysis: {
      segmentation: { jobId: 'job-1', analyzedAt: '2024-01-01', totalMasks: 2, segmentationType: 'automatic', processingTime: 1.5 }
    }
  });
  render(<SegmentationView photo={photo} formatDate={formatDate} />);

  expect(await screen.findByText(/unable to load detailed analysis results/i)).toBeInTheDocument();
});

it('clears the detailed results view, then reloads them via "View Details"', async () => {
  mockedGetResult.mockResolvedValue({
    job_id: 'job-1',
    segmentation_type: 'automatic',
    model_name: 'sam',
    processing_time: 0.5,
    total_masks: 0,
    masks: []
  });
  const photo = makePhoto({
    aiAnalysis: {
      segmentation: { jobId: 'job-1', analyzedAt: '2024-01-01', totalMasks: 2, segmentationType: 'automatic', processingTime: 1.5 }
    }
  });
  render(<SegmentationView photo={photo} formatDate={formatDate} />);
  await screen.findByText('Segmentation Details');

  const closeButtons = screen.getAllByRole('button');
  const closeButton = closeButtons.find((b) => b.querySelector('[data-testid="CloseIcon"]'))!;
  await userEvent.click(closeButton);

  expect(screen.queryByText('Segmentation Details')).not.toBeInTheDocument();
  expect(mockedGetResult).toHaveBeenCalledTimes(1);

  await userEvent.click(screen.getByRole('button', { name: /view details/i }));

  await waitFor(() => expect(mockedGetResult).toHaveBeenCalledTimes(2));
  expect(await screen.findByText('Segmentation Details')).toBeInTheDocument();
});
