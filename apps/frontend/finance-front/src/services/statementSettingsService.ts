import { financeApi } from './financeApi';
import { ApiResponse } from '../types';

export interface StatementSettings {
  /**
   * How the account holder's name appears on their statements, in every
   * ordering the bank writes it.
   */
  ownerNames: string[];
}

const SETTINGS_URL = '/statement-settings';

const scoped = (groupId?: string) => (groupId ? { params: { groupId } } : undefined);

export const getStatementSettings = async (groupId?: string): Promise<StatementSettings> => {
  const res = await financeApi.get<ApiResponse<StatementSettings>>(SETTINGS_URL, scoped(groupId));
  return res.data;
};

export const updateStatementSettings = async (
  ownerNames: string[],
  groupId?: string
): Promise<StatementSettings> => {
  const res = await financeApi.put<ApiResponse<StatementSettings>>(
    SETTINGS_URL,
    { ownerNames },
    scoped(groupId)
  );
  return res.data;
};
