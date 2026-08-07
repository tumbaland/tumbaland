import { Router } from 'express';
import { authenticateToken, validate } from '@tumbaland/backend-core';
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

router.use(authenticateToken);

// Must precede /:id so it is not read as a rule id
router.post('/apply', validate(applyCategoryRulesSchema), applyCategoryRules);

router.get('/', getCategoryRules);
router.post('/', validate(createCategoryRuleSchema), createCategoryRule);
router.put('/:id', validate(updateCategoryRuleSchema), updateCategoryRule);
router.post('/:id/move', validate(moveCategoryRuleSchema), moveCategoryRule);
router.delete('/:id', deleteCategoryRule);

export default router;
