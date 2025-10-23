import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import Training from '../models/Training';
import Epoch from '../models/Epoch';

// Get all trainings
export const getTrainings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      status, 
      datasetId,
      sortBy = 'updatedAt', 
      order = 'desc' 
    } = req.query;

    let query: any = {};

    // Search functionality
    if (search) {
      query.$text = { $search: search as string };
    }

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by dataset
    if (datasetId) {
      query.datasetId = datasetId;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sortOrder = order === 'desc' ? -1 : 1;
    const sortField = sortBy as string;

    const [trainings, total] = await Promise.all([
      Training.find(query)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(Number(limit)),
      Training.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        trainings,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching trainings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch trainings';
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trainings',
      error: errorMessage
    });
  }
};

// Get training by ID
export const getTrainingById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const training = await Training.findById(id);

    if (!training) {
      res.status(404).json({
        success: false,
        message: 'Training not found'
      });
      return;
    }

    res.json({
      success: true,
      data: training
    });
  } catch (error) {
    console.error('Error fetching training:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch training';
    res.status(500).json({
      success: false,
      message: 'Failed to fetch training',
      error: errorMessage
    });
  }
};

// Get training by UUID
export const getTrainingByUuid = async (req: Request, res: Response): Promise<void> => {
  try {
    const { uuid } = req.params;

    const training = await Training.findOne({ uuid });

    if (!training) {
      res.status(404).json({
        success: false,
        message: 'Training not found'
      });
      return;
    }

    res.json({
      success: true,
      data: training
    });
  } catch (error) {
    console.error('Error fetching training:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch training';
    res.status(500).json({
      success: false,
      message: 'Failed to fetch training',
      error: errorMessage
    });
  }
};

// Get training with epochs
export const getTrainingWithEpochs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { sortBy = 'epoch', order = 'asc' } = req.query;

    const training = await Training.findById(id);

    if (!training) {
      res.status(404).json({
        success: false,
        message: 'Training not found'
      });
      return;
    }

    const sortOrder = order === 'desc' ? -1 : 1;
    const sortField = sortBy as string;

    const epochs = await Epoch.find({ trainingId: id })
      .sort({ [sortField]: sortOrder });

    res.json({
      success: true,
      data: {
        training,
        epochs
      }
    });
  } catch (error) {
    console.error('Error fetching training with epochs:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch training with epochs';
    res.status(500).json({
      success: false,
      message: 'Failed to fetch training with epochs',
      error: errorMessage
    });
  }
};

// Create training
export const createTraining = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      name, 
      description, 
      datasetId,
      configId, 
      status = 'pending',
      startTime,
      endTime,
      metadata 
    } = req.body;

    if (!name || name.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Training name is required'
      });
      return;
    }

    // Generate UUID if not provided
    const uuid = req.body.uuid || uuidv4();

    const training = new Training({
      uuid,
      name: name.trim(),
      description: description?.trim(),
      datasetId,
      configId,
      status,
      startTime,
      endTime,
      metadata
    });

    const savedTraining = await training.save();

    res.status(201).json({
      success: true,
      message: 'Training created successfully',
      data: savedTraining
    });
  } catch (error) {
    console.error('Error creating training:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create training';
    res.status(500).json({
      success: false,
      message: 'Failed to create training',
      error: errorMessage
    });
  }
};

// Update training
export const updateTraining = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { 
      name, 
      description, 
      datasetId,
      configId, 
      status,
      startTime,
      endTime,
      metadata 
    } = req.body;

    // Validate ID format
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      res.status(400).json({
        success: false,
        message: 'Invalid training ID format'
      });
      return;
    }

    const training = await Training.findById(id);

    if (!training) {
      res.status(404).json({
        success: false,
        message: 'Training not found'
      });
      return;
    }

    // Update fields
    if (name !== undefined) training.name = name.trim();
    if (description !== undefined) training.description = description?.trim();
    if (datasetId !== undefined) training.datasetId = datasetId;
    if (configId !== undefined) training.configId = configId;
    if (status !== undefined) training.status = status;
    if (startTime !== undefined) training.startTime = startTime;
    if (endTime !== undefined) training.endTime = endTime;
    if (metadata !== undefined) training.metadata = metadata;

    const updatedTraining = await training.save();

    res.json({
      success: true,
      message: 'Training updated successfully',
      data: updatedTraining
    });
  } catch (error) {
    console.error('Error updating training:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update training';
    res.status(500).json({
      success: false,
      message: 'Failed to update training',
      error: errorMessage
    });
  }
};

// Delete training
export const deleteTraining = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Validate ID format
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      res.status(400).json({
        success: false,
        message: 'Invalid training ID format'
      });
      return;
    }

    const training = await Training.findById(id);

    if (!training) {
      res.status(404).json({
        success: false,
        message: 'Training not found'
      });
      return;
    }

    // Delete all associated epochs
    await Epoch.deleteMany({ trainingId: id });

    // Delete the training
    await Training.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Training and all associated epochs deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting training:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete training';
    res.status(500).json({
      success: false,
      message: 'Failed to delete training',
      error: errorMessage
    });
  }
};
