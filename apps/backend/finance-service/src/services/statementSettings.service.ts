import StatementSettings, { IStatementSettings } from '../models/StatementSettings';
import { assertMemberOf } from '@tumbaland/backend-core';
import { tenantScope } from '../utils/scope';
import { ownerNameTest, OwnerNameTest } from './bankStatement.service';

export interface StatementSettingsInput {
  ownerNames: string[];
  groupId?: string;
}

/** The owner's settings, or an empty set when they have never saved any. */
export const getSettings = async (
  userId: string,
  userGroups: string[] = []
): Promise<{ ownerNames: string[] }> => {
  const existing = await StatementSettings.findOne(tenantScope(userId, userGroups)).lean();
  return { ownerNames: existing?.ownerNames || [] };
};

/** The own-account test for this owner, ready for the import to use. */
export const getOwnerNameTest = async (
  userId: string,
  userGroups: string[] = []
): Promise<OwnerNameTest | null> => {
  const { ownerNames } = await getSettings(userId, userGroups);
  return ownerNameTest(ownerNames);
};

/**
 * Save the owner's settings.
 *
 * Upsert against one document per owner: these are settings, not a list, and a
 * second save should replace the first rather than accumulate.
 */
export const saveSettings = async (
  input: StatementSettingsInput,
  userId: string,
  userGroups: string[] = []
): Promise<IStatementSettings> => {
  assertMemberOf(input.groupId, userGroups);

  // Blank entries would match every counterparty and silently swallow the whole
  // statement as own-account transfers.
  const ownerNames = [...new Set(input.ownerNames.map((name) => name.trim()).filter(Boolean))];
  const scope = tenantScope(userId, input.groupId ? [input.groupId] : []);

  const updated = await StatementSettings.findOneAndUpdate(
    scope,
    {
      $set: {
        ownerNames,
        userId,
        ...(input.groupId ? { groupId: input.groupId } : {})
      }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return updated;
};
