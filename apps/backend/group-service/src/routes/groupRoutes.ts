import { Router, RequestHandler } from 'express';

import { validate } from '@tumbaland/core';
import { validateInternalServiceToken, allowUserOrInternalService } from '../middleware/internalServiceAuth';
import * as ctrl from '../controllers/groupController';
import { createGroupSchema, updateGroupSchema, addMemberSchema, updateRoleSchema } from '../validation/schemas';

const router = Router();

// Apply internal service token validation to all routes
router.use(validateInternalServiceToken);

// Thin route layer delegating to controller
router.post('/', allowUserOrInternalService, validate(createGroupSchema), ctrl.createGroup as RequestHandler);
router.get('/mine', allowUserOrInternalService, ctrl.listMine as RequestHandler);
router.get('/mine/deleted', allowUserOrInternalService, ctrl.listMyDeleted as RequestHandler);
router.get('/mine/ids', allowUserOrInternalService, ctrl.getUserGroupIds as RequestHandler);
router.get('/:id', allowUserOrInternalService, ctrl.getOne as RequestHandler);
router.patch('/:id', allowUserOrInternalService, validate(updateGroupSchema), ctrl.updateGroup as RequestHandler);
router.delete('/:id', allowUserOrInternalService, ctrl.deleteGroup as RequestHandler);
router.post('/:id/restore', allowUserOrInternalService, ctrl.restoreGroup as RequestHandler);
router.delete('/:id/permanent', allowUserOrInternalService, ctrl.permanentlyDeleteGroup as RequestHandler);
router.post('/:id/members', allowUserOrInternalService, validate(addMemberSchema), ctrl.addMember as RequestHandler);
router.patch('/:id/members/:memberEmail', allowUserOrInternalService, validate(updateRoleSchema), ctrl.updateRole as RequestHandler);
router.delete('/:id/members/:memberEmail', allowUserOrInternalService, ctrl.removeMember as RequestHandler);
router.get('/:id/membership', allowUserOrInternalService, ctrl.membership as RequestHandler);

export default router;
