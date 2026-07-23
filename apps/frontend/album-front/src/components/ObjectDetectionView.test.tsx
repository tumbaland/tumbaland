import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('../services/objectDetectionService', () => ({
  objectDetectionService: {
    checkAllServicesHealth: vi.fn(),
    detectObjects: vi.fn(),
    getObjectDetectionResult: vi.fn(),
    getVisualizationImageUrl: vi.fn((path: string) => `https://od.example/${path}`)
  }
}));
vi.mock('../services/albumService', () => ({
  albumService: { updatePhotoAIAnalysis: vi.fn() }
}));

import { objectDetectionService } from '../services/objectDetectionService';
import { albumService } from '../services/albumService';
import ObjectDetectionView from './ObjectDetectionView';
import { makePhoto } from '../test/fixtures';

const mockedCheckHealth = objectDetectionService.checkAllServicesHealth as unknown as ReturnType<typeof vi.fn>;
const mockedDetectObjects = objectDetectionService.detectObjects as unknown as ReturnType<typeof vi.fn>;
const mockedGetResult = objectDetectionService.getObjectDetectionResult as unknown as ReturnType<typeof vi.fn>;

const formatDate = (d: string) => d;

beforeEach(() => {
  vi.clearAllMocks();
  mockedCheckHealth.mockResolvedValue({ objectDetection: true, lastChecked: new Date('2024-01-01T00:00:00Z') });
});

it('checks health on mount and shows an Online chip', async () => {
  render(<ObjectDetectionView photo={makePhoto()} formatDate={formatDate} />);

  expect(await screen.findByText('Object Detection: Online')).toBeInTheDocument();
});

it('shows an Offline chip when the health check reports unhealthy', async () => {
  mockedCheckHealth.mockResolvedValue({ objectDetection: false, lastChecked: new Date() });
  render(<ObjectDetectionView photo={makePhoto()} formatDate={formatDate} />);

  expect(await screen.findByText('Object Detection: Offline')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /object detection/i })).toBeDisabled();
});

it('re-checks health when Refresh is clicked', async () => {
  render(<ObjectDetectionView photo={makePhoto()} formatDate={formatDate} />);
  await screen.findByText('Object Detection: Online');

  await userEvent.click(screen.getByRole('button', { name: /refresh/i }));

  await waitFor(() => expect(mockedCheckHealth).toHaveBeenCalledTimes(2));
});

it('shows the no-analysis message when nothing has been analyzed yet', async () => {
  render(<ObjectDetectionView photo={makePhoto()} formatDate={formatDate} />);
  await screen.findByText('Object Detection: Online');

  expect(screen.getByText(/no object detection analysis has been performed/i)).toBeInTheDocument();
});

it('rejects running analysis on a non-image file', async () => {
  const photo = makePhoto({ mimetype: 'video/mp4' });
  render(<ObjectDetectionView photo={photo} formatDate={formatDate} />);
  await screen.findByText('Object Detection: Online');

  await userEvent.click(screen.getByRole('button', { name: /object detection/i }));

  expect(screen.getByText('Object detection is only available for image files.')).toBeInTheDocument();
  expect(mockedDetectObjects).not.toHaveBeenCalled();
});

it('runs analysis, shows the detected objects, updates AI analysis, and notifies the parent', async () => {
  mockedDetectObjects.mockResolvedValue({
    success: true,
    result_id: 'result-1',
    processing_time: 1.2,
    total_detections: 1,
    model_name: 'yolo',
    confidence_threshold: 0.25,
    image_dimensions: { width: 100, height: 100 },
    detections: [
      {
        class_id: 1,
        class_name: 'cat',
        confidence: 0.9,
        bbox: { x1: 0, y1: 0, x2: 10, y2: 10, width: 10, height: 10 },
        center_point: [5, 5]
      }
    ]
  });
  const onAnalysisComplete = vi.fn();
  const photo = makePhoto({ _id: 'photo-1', mimetype: 'image/jpeg' });
  render(<ObjectDetectionView photo={photo} formatDate={formatDate} onAnalysisComplete={onAnalysisComplete} />);
  await screen.findByText('Object Detection: Online');

  await userEvent.click(screen.getByRole('button', { name: /object detection/i }));

  expect(await screen.findByText('cat (ID: 1)')).toBeInTheDocument();
  expect(albumService.updatePhotoAIAnalysis).toHaveBeenCalledWith('photo-1', {
    analysisType: 'objectDetection',
    jobId: 'result-1',
    processingTime: 1.2
  });
  expect(onAnalysisComplete).toHaveBeenCalledTimes(1);
});

it('shows an error message when analysis fails', async () => {
  mockedDetectObjects.mockRejectedValue(new Error('down'));
  render(<ObjectDetectionView photo={makePhoto({ mimetype: 'image/jpeg' })} formatDate={formatDate} />);
  await screen.findByText('Object Detection: Online');

  await userEvent.click(screen.getByRole('button', { name: /object detection/i }));

  expect(await screen.findByText('Failed to run object detection analysis.')).toBeInTheDocument();
});

it('auto-loads previous analysis details when the photo already has a jobId', async () => {
  mockedGetResult.mockResolvedValue({
    model_name: 'yolo',
    confidence_threshold: 0.25,
    processing_time: 0.8,
    total_detections: 0,
    detections: []
  });
  const photo = makePhoto({
    aiAnalysis: {
      objectDetection: { jobId: 'job-1', analyzedAt: '2024-01-01', totalDetections: 2, processingTime: 1.5 }
    }
  });
  render(<ObjectDetectionView photo={photo} formatDate={formatDate} />);

  await waitFor(() => expect(mockedGetResult).toHaveBeenCalledWith('job-1'));
  expect(await screen.findByText('Object Detection Details')).toBeInTheDocument();
  expect(screen.getByText('Detected 2 objects (Processing time: 1.50s)')).toBeInTheDocument();
});

it('shows an error when loading previous details fails', async () => {
  mockedGetResult.mockRejectedValue(new Error('gone'));
  const photo = makePhoto({
    aiAnalysis: {
      objectDetection: { jobId: 'job-1', analyzedAt: '2024-01-01', totalDetections: 2, processingTime: 1.5 }
    }
  });
  render(<ObjectDetectionView photo={photo} formatDate={formatDate} />);

  expect(await screen.findByText(/unable to load detailed analysis results/i)).toBeInTheDocument();
});

it('reloads previous-analysis details via "View Details" after clearing them', async () => {
  mockedGetResult.mockResolvedValue({
    model_name: 'yolo',
    confidence_threshold: 0.25,
    processing_time: 0.8,
    total_detections: 0,
    detections: []
  });
  const photo = makePhoto({
    aiAnalysis: {
      objectDetection: { jobId: 'job-1', analyzedAt: '2024-01-01', totalDetections: 2, processingTime: 1.5 }
    }
  });
  render(<ObjectDetectionView photo={photo} formatDate={formatDate} />);
  await screen.findByText('Object Detection Details');

  const closeButtons = screen.getAllByRole('button');
  const closeButton = closeButtons.find((b) => b.querySelector('[data-testid="CloseIcon"]'))!;
  await userEvent.click(closeButton);

  expect(screen.queryByText('Object Detection Details')).not.toBeInTheDocument();
  expect(mockedGetResult).toHaveBeenCalledTimes(1);

  await userEvent.click(screen.getByRole('button', { name: /view details/i }));

  await waitFor(() => expect(mockedGetResult).toHaveBeenCalledTimes(2));
  expect(await screen.findByText('Object Detection Details')).toBeInTheDocument();
});

it('clears the detailed results view', async () => {
  mockedDetectObjects.mockResolvedValue({
    success: true,
    result_id: 'result-1',
    processing_time: 1.2,
    total_detections: 0,
    detections: []
  });
  render(<ObjectDetectionView photo={makePhoto({ mimetype: 'image/jpeg' })} formatDate={formatDate} />);
  await screen.findByText('Object Detection: Online');
  await userEvent.click(screen.getByRole('button', { name: /object detection/i }));
  await screen.findByText('Object Detection Details');

  const closeButtons = screen.getAllByRole('button');
  const closeButton = closeButtons.find((b) => b.querySelector('[data-testid="CloseIcon"]'))!;
  await userEvent.click(closeButton);

  expect(screen.queryByText('Object Detection Details')).not.toBeInTheDocument();
});
