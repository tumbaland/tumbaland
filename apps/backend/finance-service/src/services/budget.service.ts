import Budget from '../models/Budget';
import { ConflictError, ForbiddenError, NotFoundError, canAccessResource } from '@tumbaland/backend-core';
import { tenantScope } from '../utils/scope';

export interface BudgetInput {
  category: string;
  amount: number;
  groupId?: string;
}

export const getBudgets = async (userId: string, userGroups: string[] = []) =>
  Budget.find(tenantScope(userId, userGroups)).sort({ category: 1 });

export const createBudget = async (data: BudgetInput, userId: string, userGroups: string[] = []) => {
  if (data.groupId && !userGroups.includes(data.groupId)) {
    throw new ForbiddenError('Access denied');
  }

  const duplicate = await Budget.findOne({
    ...tenantScope(userId, data.groupId ? [data.groupId] : []),
    category: data.category
  });
  if (duplicate) {
    throw new ConflictError(`A budget for "${data.category}" already exists`);
  }

  return new Budget({ ...data, userId }).save();
};

export const updateBudget = async (
  id: string,
  data: Partial<BudgetInput>,
  userId: string,
  userGroups: string[] = []
) => {
  const existing = await Budget.findById(id);
  if (!existing) {
    throw new NotFoundError('Budget not found');
  }
  if (!canAccessResource(userId, existing.userId, existing.groupId, userGroups, false)) {
    throw new ForbiddenError('Access denied');
  }

  return Budget.findByIdAndUpdate(id, data, { new: true, runValidators: true });
};

export const deleteBudget = async (id: string, userId: string, userGroups: string[] = []) => {
  const existing = await Budget.findById(id);
  if (!existing) {
    throw new NotFoundError('Budget not found');
  }
  if (!canAccessResource(userId, existing.userId, existing.groupId, userGroups, false)) {
    throw new ForbiddenError('Access denied');
  }

  return Budget.findByIdAndDelete(id);
};
