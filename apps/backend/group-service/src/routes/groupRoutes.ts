import { Router, RequestHandler } from 'express';
import { GroupRole } from '../models/Group';
import * as ctrl from '../controllers/groupController';

const router = Router();
// Thin route layer delegating to controller
router.post('/', ctrl.createGroup as RequestHandler);
router.get('/mine', ctrl.listMine as RequestHandler);
router.get('/:id', ctrl.getOne as RequestHandler);
router.post('/:id/invite', ctrl.invite as RequestHandler);
router.post('/:id/accept', ctrl.accept as RequestHandler);
router.patch('/:id/members/:memberEmail', ctrl.updateRole as RequestHandler);
router.delete('/:id/members/:memberEmail', ctrl.removeMember as RequestHandler);
router.get('/:id/membership', ctrl.membership as RequestHandler);

export default router;
