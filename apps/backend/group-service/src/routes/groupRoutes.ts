import { Router } from 'express';

import { validate } from '@tumbaland/backend-core';
import { validateInternalServiceToken, allowUserOrInternalService } from '../middleware/internalServiceAuth';
import * as ctrl from '../controllers/groupController';
import { createGroupSchema, updateGroupSchema, addMemberSchema, updateRoleSchema } from '../validation/schemas';

const router = Router();

// Apply internal service token validation to all routes
router.use(validateInternalServiceToken);

// Thin route layer delegating to controller
router.post('/', allowUserOrInternalService, validate(createGroupSchema), ctrl.createGroup);
router.get('/mine', allowUserOrInternalService, ctrl.listMine);
router.get('/mine/deleted', allowUserOrInternalService, ctrl.listMyDeleted);
router.get('/mine/ids', allowUserOrInternalService, ctrl.getUserGroupIds);
router.get('/:id', allowUserOrInternalService, ctrl.getOne);
router.patch('/:id', allowUserOrInternalService, validate(updateGroupSchema), ctrl.updateGroup);
router.delete('/:id', allowUserOrInternalService, ctrl.deleteGroup);
router.post('/:id/restore', allowUserOrInternalService, ctrl.restoreGroup);
router.delete('/:id/permanent', allowUserOrInternalService, ctrl.permanentlyDeleteGroup);
router.post('/:id/members', allowUserOrInternalService, validate(addMemberSchema), ctrl.addMember);
router.patch('/:id/members/:memberEmail', allowUserOrInternalService, validate(updateRoleSchema), ctrl.updateRole);
router.delete('/:id/members/:memberEmail', allowUserOrInternalService, ctrl.removeMember);
router.get('/:id/membership', allowUserOrInternalService, ctrl.membership);

export default router;
