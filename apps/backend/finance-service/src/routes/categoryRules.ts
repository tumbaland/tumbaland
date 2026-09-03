import { Router } from 'express';
import { authenticateAgent, requireScope, validate } from '@tumbaland/backend-core';
import {
  getCategoryRules,
  createCategoryRule,
  updateCategoryRule,
  deleteCategoryRule,
  moveCategoryRule,
  applyCategoryRules
} from '../controllers/categoryRule.controller';
import {
  createCategoryRuleSchema,
  updateCategoryRuleSchema,
  moveCategoryRuleSchema,
  applyCategoryRulesSchema
} from '../validation/schemas';

const router = Router();

router.use(authenticateAgent());

// Must precede /:id so it is not read as a rule id
router.post('/apply', requireScope('finance:write'), validate(applyCategoryRulesSchema), applyCategoryRules);

router.get('/', requireScope('finance:read'), getCategoryRules);
router.post('/', requireScope('finance:write'), validate(createCategoryRuleSchema), createCategoryRule);
router.put('/:id', requireScope('finance:write'), validate(updateCategoryRuleSchema), updateCategoryRule);
router.post('/:id/move', requireScope('finance:write'), validate(moveCategoryRuleSchema), moveCategoryRule);
router.delete('/:id', requireScope('finance:write'), deleteCategoryRule);

export default router;
