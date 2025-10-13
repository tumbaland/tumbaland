import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import Epoch from '../models/Epoch';
import Training from '../models/Training';

// Get epochs for a training
export const getEpochsByTraining = async (req: Request, res: Response): Promise<void> => {
  try {
    const { trainingId } = req.params;
    const { page, limit, sortBy = 'epoch', order = 'asc' } = req.query;

    // Check if training exists
    const training = await Training.findById(trainingId);
    if (!training) {
      res.status(404).json({
        success: false,
        message: 'Training not found'
      });
      return;
    }

    const sortOrder = order === 'desc' ? -1 : 1;
    const sortField = sortBy as string;

    let query = Epoch.find({ trainingId }).sort({ [sortField]: sortOrder });

    // If pagination is provided
    if (page && limit) {
      const skip = (Number(page) - 1) * Number(limit);
      query = query.skip(skip).limit(Number(limit));
      
      const [epochs, total] = await Promise.all([
        query,
        Epoch.countDocuments({ trainingId })
      ]);

      res.json({
        success: true,
        data: {
          epochs,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit))
          }
        }
      });
    } else {
      // Return all epochs without pagination
      const epochs = await query;
      
      res.json({
        success: true,
        data: {
          epochs,
          total: epochs.length
        }
      });
    }
  } catch (error) {
    console.error('Error fetching epochs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch epochs'
    });
  }
};

// Get epoch by ID
export const getEpochById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const epoch = await Epoch.findById(id);

    if (!epoch) {
      res.status(404).json({
        success: false,
        message: 'Epoch not found'
      });
      return;
    }

    res.json({
      success: true,
      data: epoch
    });
  } catch (error) {
    console.error('Error fetching epoch:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch epoch'
    });
  }
};

// Get epoch by UUID
export const getEpochByUuid = async (req: Request, res: Response): Promise<void> => {
  try {
    const { uuid } = req.params;

    const epoch = await Epoch.findOne({ epoch_uuid: uuid });

    if (!epoch) {
      res.status(404).json({
        success: false,
        message: 'Epoch not found'
      });
      return;
    }

    res.json({
      success: true,
      data: epoch
    });
  } catch (error) {
    console.error('Error fetching epoch:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch epoch'
    });
  }
};

// Create epoch
export const createEpoch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      trainingId,
      training_uuid,
      epoch,
      timestamp,
      results,
      learning_rate,
      epoch_time,
      metadata
    } = req.body;

    if (!trainingId) {
      res.status(400).json({
        success: false,
        message: 'Training ID is required'
      });
      return;
    }

    if (!training_uuid) {
      res.status(400).json({
        success: false,
        message: 'Training UUID is required'
      });
      return;
    }

    if (epoch === undefined || epoch === null) {
      res.status(400).json({
        success: false,
        message: 'Epoch number is required'
      });
      return;
    }

    if (!results) {
      res.status(400).json({
        success: false,
        message: 'Results are required'
      });
      return;
    }

    // Check if training exists
    const training = await Training.findById(trainingId);
    if (!training) {
      res.status(404).json({
        success: false,
        message: 'Training not found'
      });
      return;
    }

    // Generate UUID if not provided
    const epoch_uuid = req.body.epoch_uuid || uuidv4();

    const epochData = new Epoch({
      trainingId,
      training_uuid,
      epoch_uuid,
      epoch,
      timestamp: timestamp || new Date(),
      results,
      learning_rate,
      epoch_time,
      metadata
    });

    const savedEpoch = await epochData.save();

    res.status(201).json({
      success: true,
      message: 'Epoch created successfully',
      data: savedEpoch
    });
  } catch (error) {
    console.error('Error creating epoch:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create epoch'
    });
  }
};

// Update epoch
export const updateEpoch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { 
      timestamp,
      results,
      learning_rate,
      epoch_time,
      metadata
    } = req.body;

    const epoch = await Epoch.findById(id);

    if (!epoch) {
      res.status(404).json({
        success: false,
        message: 'Epoch not found'
      });
      return;
    }

    // Update fields
    if (timestamp !== undefined) epoch.timestamp = timestamp;
    if (results !== undefined) epoch.results = results;
    if (learning_rate !== undefined) epoch.learning_rate = learning_rate;
    if (epoch_time !== undefined) epoch.epoch_time = epoch_time;
    if (metadata !== undefined) epoch.metadata = metadata;

    const updatedEpoch = await epoch.save();

    res.json({
      success: true,
      message: 'Epoch updated successfully',
      data: updatedEpoch
    });
  } catch (error) {
    console.error('Error updating epoch:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update epoch'
    });
  }
};

// Delete epoch
export const deleteEpoch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const epoch = await Epoch.findById(id);

    if (!epoch) {
      res.status(404).json({
        success: false,
        message: 'Epoch not found'
      });
      return;
    }

    await Epoch.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Epoch deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting epoch:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete epoch'
    });
  }
};

// Batch create epochs
export const createEpochsBatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { epochs } = req.body;

    if (!Array.isArray(epochs) || epochs.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Epochs array is required and must not be empty'
      });
      return;
    }

    // Validate and prepare epochs
    const preparedEpochs = epochs.map((epoch: any) => {
      if (!epoch.trainingId || !epoch.training_uuid || epoch.epoch === undefined || !epoch.results) {
        throw new Error('Each epoch must have trainingId, training_uuid, epoch number, and results');
      }

      return {
        ...epoch,
        epoch_uuid: epoch.epoch_uuid || uuidv4(),
        timestamp: epoch.timestamp || new Date()
      };
    });

    const savedEpochs = await Epoch.insertMany(preparedEpochs);

    res.status(201).json({
      success: true,
      message: `${savedEpochs.length} epochs created successfully`,
      data: savedEpochs
    });
  } catch (error) {
    console.error('Error creating epochs batch:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create epochs batch'
    });
  }
};
