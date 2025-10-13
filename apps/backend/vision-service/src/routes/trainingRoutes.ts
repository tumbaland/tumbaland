import express from 'express';
import {
  getTrainings,
  getTrainingById,
  getTrainingByUuid,
  getTrainingWithEpochs,
  createTraining,
  updateTraining,
  deleteTraining
} from '../controllers/trainingController';

const router = express.Router();

// Training routes
router.get('/', getTrainings);
router.get('/:id', getTrainingById);
router.get('/:id/epochs', getTrainingWithEpochs);
router.get('/uuid/:uuid', getTrainingByUuid);
router.post('/', createTraining);
router.put('/:id', updateTraining);
router.delete('/:id', deleteTraining);

export default router;
