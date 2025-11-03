import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import TestResult from '../models/TestResult';

// Get all test results
export const getTestResults = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, sortBy = 'timestamp', order = 'desc', epoch } = req.query;

    const sortOrder = order === 'desc' ? -1 : 1;
    const sortField = sortBy as string;

    let query = TestResult.find();

    // Filter by epoch if provided
    if (epoch !== undefined) {
      query = query.where('epoch').equals(Number(epoch));
    }

    query = query.sort({ [sortField]: sortOrder });

    // If pagination is provided
    if (page && limit) {
      const skip = (Number(page) - 1) * Number(limit);
      query = query.skip(skip).limit(Number(limit));

      const [testResults, total] = await Promise.all([
        query,
        TestResult.countDocuments(epoch !== undefined ? { epoch: Number(epoch) } : {})
      ]);

      res.json({
        success: true,
        data: {
          testResults,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit))
          }
        }
      });
    } else {
      // Return all test results without pagination
      const testResults = await query;

      res.json({
        success: true,
        data: {
          testResults,
          total: testResults.length
        }
      });
    }
  } catch (error) {
    console.error('Error fetching test results:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch test results'
    });
  }
};

// Get test result by ID
export const getTestResultById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const testResult = await TestResult.findById(id);

    if (!testResult) {
      res.status(404).json({
        success: false,
        message: 'Test result not found'
      });
      return;
    }

    res.json({
      success: true,
      data: testResult
    });
  } catch (error) {
    console.error('Error fetching test result:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch test result'
    });
  }
};

// Get test result by test UUID
export const getTestResultByTestUuid = async (req: Request, res: Response): Promise<void> => {
  try {
    const { testUuid } = req.params;

    const testResult = await TestResult.findOne({ test_uuid: testUuid });

    if (!testResult) {
      res.status(404).json({
        success: false,
        message: 'Test result not found'
      });
      return;
    }

    res.json({
      success: true,
      data: testResult
    });
  } catch (error) {
    console.error('Error fetching test result:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch test result'
    });
  }
};

// Get test results by epoch UUID
export const getTestResultsByEpochUuid = async (req: Request, res: Response): Promise<void> => {
  try {
    const { epochUuid } = req.params;
    const { page, limit, sortBy = 'timestamp', order = 'desc' } = req.query;

    const sortOrder = order === 'desc' ? -1 : 1;
    const sortField = sortBy as string;

    let query = TestResult.find({ epoch_uuid: epochUuid }).sort({ [sortField]: sortOrder });

    // If pagination is provided
    if (page && limit) {
      const skip = (Number(page) - 1) * Number(limit);
      query = query.skip(skip).limit(Number(limit));

      const [testResults, total] = await Promise.all([
        query,
        TestResult.countDocuments({ epoch_uuid: epochUuid })
      ]);

      res.json({
        success: true,
        data: {
          testResults,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit))
          }
        }
      });
    } else {
      // Return all test results without pagination
      const testResults = await query;

      res.json({
        success: true,
        data: {
          testResults,
          total: testResults.length
        }
      });
    }
  } catch (error) {
    console.error('Error fetching test results by epoch UUID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch test results'
    });
  }
};

// Create test result
export const createTestResult = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      timestamp,
      epoch,
      epoch_uuid,
      test_uuid,
      test_results
    } = req.body;

    if (epoch === undefined || epoch === null) {
      res.status(400).json({
        success: false,
        message: 'Epoch number is required'
      });
      return;
    }

    if (!epoch_uuid) {
      res.status(400).json({
        success: false,
        message: 'Epoch UUID is required'
      });
      return;
    }

    if (!test_results) {
      res.status(400).json({
        success: false,
        message: 'Test results are required'
      });
      return;
    }

    // Check if test result already exists
    if (test_uuid) {
      const existingTestResult = await TestResult.findOne({ test_uuid });
      if (existingTestResult) {
        res.status(409).json({
          success: false,
          message: `Test result with test_uuid ${test_uuid} already exists`
        });
        return;
      }
    }

    const testResultData = new TestResult({
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      epoch,
      epoch_uuid,
      test_uuid: test_uuid || uuidv4(),
      test_results
    });

    const savedTestResult = await testResultData.save();

    res.status(201).json({
      success: true,
      message: 'Test result created successfully',
      data: savedTestResult
    });
  } catch (error) {
    console.error('Error creating test result:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create test result'
    });
  }
};

// Create test result from JSON (accepts the full JSON structure)
export const createTestResultFromJson = async (req: Request, res: Response): Promise<void> => {
  try {
    const jsonData = req.body;

    // Validate required fields
    if (!jsonData.test_results) {
      res.status(400).json({
        success: false,
        message: 'test_results field is required'
      });
      return;
    }

    if (jsonData.epoch === undefined || jsonData.epoch === null) {
      res.status(400).json({
        success: false,
        message: 'epoch field is required'
      });
      return;
    }

    if (!jsonData.epoch_uuid) {
      res.status(400).json({
        success: false,
        message: 'epoch_uuid field is required'
      });
      return;
    }

    // Check if test result already exists
    if (jsonData.test_uuid) {
      const existingTestResult = await TestResult.findOne({ test_uuid: jsonData.test_uuid });
      if (existingTestResult) {
        res.status(409).json({
          success: false,
          message: `Test result with test_uuid ${jsonData.test_uuid} already exists`
        });
        return;
      }
    }

    const testResultData = new TestResult({
      timestamp: jsonData.timestamp ? new Date(jsonData.timestamp) : new Date(),
      epoch: jsonData.epoch,
      epoch_uuid: jsonData.epoch_uuid,
      test_uuid: jsonData.test_uuid || uuidv4(),
      test_results: jsonData.test_results
    });

    const savedTestResult = await testResultData.save();

    res.status(201).json({
      success: true,
      message: 'Test result created successfully',
      data: savedTestResult
    });
  } catch (error) {
    console.error('Error creating test result from JSON:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create test result'
    });
  }
};

// Update test result
export const updateTestResult = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      timestamp,
      epoch,
      epoch_uuid,
      test_results
    } = req.body;

    const testResult = await TestResult.findById(id);

    if (!testResult) {
      res.status(404).json({
        success: false,
        message: 'Test result not found'
      });
      return;
    }

    // Update fields
    if (timestamp !== undefined) testResult.timestamp = new Date(timestamp);
    if (epoch !== undefined) testResult.epoch = epoch;
    if (epoch_uuid !== undefined) testResult.epoch_uuid = epoch_uuid;
    if (test_results !== undefined) testResult.test_results = test_results;

    const updatedTestResult = await testResult.save();

    res.json({
      success: true,
      message: 'Test result updated successfully',
      data: updatedTestResult
    });
  } catch (error) {
    console.error('Error updating test result:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update test result'
    });
  }
};

// Delete test result
export const deleteTestResult = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const testResult = await TestResult.findById(id);

    if (!testResult) {
      res.status(404).json({
        success: false,
        message: 'Test result not found'
      });
      return;
    }

    await TestResult.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Test result deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting test result:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete test result'
    });
  }
};

// Get unique epochs that have test results
export const getTestResultEpochs = async (req: Request, res: Response): Promise<void> => {
  try {
    const epochs = await TestResult.distinct('epoch').sort();

    res.json({
      success: true,
      data: {
        epochs
      }
    });
  } catch (error) {
    console.error('Error fetching test result epochs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch test result epochs'
    });
  }
};