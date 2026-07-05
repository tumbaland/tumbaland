export interface ActivityType {
  _id: string;
  id: string;
  name: string;
  slug: string;
  description?: string;
  color?: string;
  icon?: string;
  valueType?: 'string' | 'boolean' | 'number';
  isActive: boolean;
  sortOrder: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  userId: string;
  groupId?: string;
}

/**
 * One logged entry: something that happened on a date. Which fields it
 * carries depends on its type's valueType — 'string' types use description
 * (which game, which restaurant), 'number' types use hours, 'boolean' types
 * are presence markers (the entry existing means "yes").
 */
export interface ActivityEntry {
  _id: string;
  date: Date | string;
  typeId: string;
  /** populated ActivityType (from GET /days) */
  type?: ActivityType;
  description?: string;
  hours?: number;
  userId?: string;
  groupId?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface Day {
  /** YYYY-MM-DD */
  date: string;
  entries: ActivityEntry[];
}

/** Entry payload for PUT /days/:date. _id present = update existing. */
export interface DayEntryInput {
  _id?: string;
  typeId: string;
  description?: string;
  hours?: number;
}

export interface GetDaysFilters {
  page?: number;
  limit?: number;
  typeId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  groupId?: string;
}

export interface DaysResponse {
  days: Day[];
  total: number;
  page: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
