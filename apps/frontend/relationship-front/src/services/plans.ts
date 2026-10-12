import { relationshipApi } from './relationshipApi';
import { ApiResponse, GetPlansFilters, Plan, PlanInput } from './types';

/** Plans in a range of days, earliest first, or the upcoming ones. */
export const getPlans = async (filters?: GetPlansFilters): Promise<Plan[]> => {
  const params = new URLSearchParams();
  if (filters?.groupId) params.append('groupId', filters.groupId);
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);
  if (filters?.upcoming) params.append('upcoming', 'true');
  if (filters?.limit) params.append('limit', String(filters.limit));

  const response = await relationshipApi.get<ApiResponse<Plan[]>>(
    `/plans${params.size ? `?${params.toString()}` : ''}`
  );
  return response.data;
};

export const getPlan = async (id: string): Promise<Plan> =>
  (await relationshipApi.get<ApiResponse<Plan>>(`/plans/${encodeURIComponent(id)}`)).data;

/** The browser's own zone goes with every plan, so 19:00 means 19:00 here. */
const browserTimeZone = (): string | undefined => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
};

export const createPlan = async (input: PlanInput): Promise<Plan> =>
  (await relationshipApi.post<ApiResponse<Plan>>('/plans', { timeZone: browserTimeZone(), ...input })).data;

export const updatePlan = async (id: string, patch: Partial<Omit<PlanInput, 'groupId'>>): Promise<Plan> =>
  (
    await relationshipApi.patch<ApiResponse<Plan>>(`/plans/${encodeURIComponent(id)}`, {
      timeZone: browserTimeZone(),
      ...patch
    })
  ).data;

export const deletePlan = async (id: string): Promise<void> => {
  await relationshipApi.delete(`/plans/${encodeURIComponent(id)}`);
};

/** "Log it": the plan happened, so it becomes an entry on its day. */
export const logPlan = async (id: string, typeId?: string): Promise<{ plan: Plan; activityId: string }> =>
  (
    await relationshipApi.post<ApiResponse<{ plan: Plan; activityId: string }>>(
      `/plans/${encodeURIComponent(id)}/log`,
      typeId ? { typeId } : {}
    )
  ).data;
