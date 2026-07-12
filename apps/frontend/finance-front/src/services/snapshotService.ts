import { financeApi } from './financeApi';
import { ApiResponse, Snapshot, SnapshotEntry } from '../types';

const API_URL = '/snapshots';

export const getSnapshots = async (groupId?: string): Promise<Snapshot[]> => {
  const params = groupId ? { groupId } : undefined;
  const res = await financeApi.get<ApiResponse<Snapshot[]>>(API_URL, { params });
  return res.data;
};

/** Create or replace the snapshot for a month (YYYY-MM): the monthly check-in. */
export const saveSnapshot = async (
  month: string,
  entries: SnapshotEntry[],
  groupId?: string
): Promise<Snapshot> => {
  const res = await financeApi.put<ApiResponse<Snapshot>>(`${API_URL}/${month}`, {
    entries,
    ...(groupId ? { groupId } : {})
  });
  return res.data;
};

export const deleteSnapshot = async (id: string): Promise<void> => {
  await financeApi.delete(`${API_URL}/${id}`);
};

/** Month key (YYYY-MM) of a snapshot's date. */
export const snapshotMonth = (snapshot: Snapshot): string => snapshot.date.slice(0, 7);
