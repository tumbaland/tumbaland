import { Request, Response } from 'express';
import DatasetAnalysis from '../models/DatasetAnalysis';
import { logger } from '@tumbaland/core';

/**
 * Upload dataset analysis JSON
 * POST /analysis/upload
 */
export const uploadAnalysis = async (req: Request, res: Response): Promise<void> => {
  try {
    const analysisData = req.body;

    // Validate required fields
    if (!analysisData.dataset || !analysisData.timestamp) {
      res.status(400).json({
        error: 'Missing required fields: dataset, timestamp'
      });
      return;
    }

    // Create new analysis record
    const analysis = new DatasetAnalysis({
      timestamp: new Date(analysisData.timestamp),
      dataset: analysisData.dataset,
      total_frames: analysisData.total_frames,
      total_pixels: analysisData.total_pixels,
      total_classes: analysisData.total_classes,
      image_dimensions: analysisData.image_dimensions,
      class_analysis: analysisData.class_analysis
    });

    await analysis.save();

    logger.info(`Dataset analysis uploaded: ${analysisData.dataset}`, {
      id: analysis._id,
      frames: analysisData.total_frames
    });

    res.status(201).json({
      message: 'Analysis uploaded successfully',
      data: analysis
    });
  } catch (error) {
    logger.error('Failed to upload analysis:', error);
    res.status(500).json({
      error: 'Failed to upload analysis',
      message: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Get all analyses
 * GET /analysis
 */
export const getAllAnalyses = async (req: Request, res: Response): Promise<void> => {
  try {
    const { dataset, limit = 50, skip = 0 } = req.query;

    const query: any = {};
    if (dataset) {
      query.dataset = dataset;
    }

    const total = await DatasetAnalysis.countDocuments(query);
    const analyses = await DatasetAnalysis.find(query)
      .sort({ timestamp: -1 })
      .limit(Number(limit))
      .skip(Number(skip));

    res.json({
      data: analyses,
      pagination: {
        total,
        limit: Number(limit),
        skip: Number(skip)
      }
    });
  } catch (error) {
    logger.error('Failed to fetch analyses:', error);
    res.status(500).json({
      error: 'Failed to fetch analyses',
      message: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Get analysis by ID
 * GET /analysis/:id
 */
export const getAnalysisById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const analysis = await DatasetAnalysis.findById(id);
    if (!analysis) {
      res.status(404).json({
        error: 'Analysis not found'
      });
      return;
    }

    res.json({ data: analysis });
  } catch (error) {
    logger.error('Failed to fetch analysis:', error);
    res.status(500).json({
      error: 'Failed to fetch analysis',
      message: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Get analyses by dataset name
 * GET /analysis/dataset/:name
 */
export const getAnalysisByDataset = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.params;
    const { limit = 50, skip = 0 } = req.query;

    const total = await DatasetAnalysis.countDocuments({ dataset: name });
    const analyses = await DatasetAnalysis.find({ dataset: name })
      .sort({ timestamp: -1 })
      .limit(Number(limit))
      .skip(Number(skip));

    res.json({
      data: analyses,
      pagination: {
        total,
        limit: Number(limit),
        skip: Number(skip)
      }
    });
  } catch (error) {
    logger.error('Failed to fetch analysis by dataset:', error);
    res.status(500).json({
      error: 'Failed to fetch analysis',
      message: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Delete analysis by ID
 * DELETE /analysis/:id
 */
export const deleteAnalysis = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const analysis = await DatasetAnalysis.findByIdAndDelete(id);
    if (!analysis) {
      res.status(404).json({
        error: 'Analysis not found'
      });
      return;
    }

    logger.info(`Dataset analysis deleted: ${analysis._id}`);

    res.json({
      message: 'Analysis deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete analysis:', error);
    res.status(500).json({
      error: 'Failed to delete analysis',
      message: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Compare multiple analyses
 * POST /analysis/compare
 */
export const compareAnalyses = async (req: Request, res: Response): Promise<void> => {
  try {
    const { analysisIds } = req.body;

    if (!analysisIds || !Array.isArray(analysisIds) || analysisIds.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Analysis IDs array is required'
      });
      return;
    }

    if (analysisIds.length > 10) {
      res.status(400).json({
        success: false,
        message: 'Maximum 10 analyses can be compared at once'
      });
      return;
    }

    // Fetch analyses
    const analyses = await DatasetAnalysis.find({ _id: { $in: analysisIds } })
      .sort({ timestamp: -1 });

    // Calculate comparison data for each analysis
    const comparisonData = analyses.map(analysis => {
      return {
        analysis: {
          _id: analysis._id,
          dataset: analysis.dataset,
          timestamp: analysis.timestamp,
          createdAt: analysis.createdAt,
          updatedAt: analysis.updatedAt
        },
        metrics: {
          totalFrames: analysis.total_frames,
          totalPixels: analysis.total_pixels,
          totalClasses: analysis.total_classes,
          imageDimensions: analysis.image_dimensions,
          pixelsPerFrame: analysis.total_frames > 0 ? analysis.total_pixels / analysis.total_frames : 0,
          classesPerFrame: analysis.total_frames > 0 ? analysis.total_classes / analysis.total_frames : 0
        },
        classAnalysis: analysis.class_analysis.map(cls => ({
          name: cls.name,
          classId: cls.class_id,
          totalPixels: cls.total_pixels,
          pixelPercentage: cls.pixel_percentage,
          framesWithClass: cls.frames_with_class,
          frameCoveragePercentage: cls.frame_coverage_percentage,
          avgPixelsPerFrame: cls.avg_pixels_per_frame
        }))
      };
    });

    res.json({
      success: true,
      data: {
        comparison: comparisonData,
        summary: {
          totalAnalyses: analyses.length,
          datasets: [...new Set(analyses.map(a => a.dataset))]
        }
      }
    });
  } catch (error) {
    console.error('Error comparing analyses:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to compare analyses';
    res.status(500).json({
      success: false,
      message: 'Failed to compare analyses',
      error: errorMessage
    });
  }
};
