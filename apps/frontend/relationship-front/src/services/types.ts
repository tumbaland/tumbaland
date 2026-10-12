export interface ActivityType {
  _id: string;
  id: string;
  name: string;
  slug: string;
  description?: string;
  color?: string;
  icon?: string;
  valueType?: 'string' | 'boolean' | 'number';
  /** whether entries of this type can carry a place; orthogonal to valueType */
  hasLocation?: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  userId: string;
  groupId?: string;
}

/** Where an entry happened. Only on entries whose type has hasLocation. */
export interface ActivityLocation {
  label: string;
  lat: number;
  lng: number;
}

/**
 * One logged entry: something that happened on a date. Which fields it
 * carries depends on its type's valueType — 'string' types use description
 * (which game, which restaurant), 'number' types use hours, 'boolean' types
 * are presence markers (the entry existing means "yes"). Independently of
 * that, a type with hasLocation adds a place.
 */
export interface ActivityEntry {
  _id: string;
  date: Date | string;
  typeId: string;
  /** populated ActivityType (from GET /days) */
  type?: ActivityType;
  description?: string;
  hours?: number;
  location?: ActivityLocation;
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
  /** null clears a previously saved place */
  location?: ActivityLocation | null;
}

/** One distinct place with its visit history — a pin on the map. */
export interface Place {
  /** rounded "lat,lng"; stable pin identity */
  id: string;
  label: string;
  lat: number;
  lng: number;
  visits: number;
  /** YYYY-MM-DD */
  firstVisit: string;
  /** YYYY-MM-DD */
  lastVisit: string;
  types: PlaceTypeBreakdown[];
}

export interface PlaceTypeBreakdown {
  typeId: string;
  name: string;
  slug: string;
  color?: string;
  count: number;
}

/** One visit behind a pin, as listed in its popup. */
export interface PlaceVisit {
  /** YYYY-MM-DD */
  date: string;
  typeId: string;
  typeName?: string;
  typeColor?: string;
  description?: string;
  hours?: number;
}

export interface GetPlacesFilters {
  groupId?: string;
  typeId?: string;
  startDate?: string;
  endDate?: string;
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

/**
 * Something coming up: a concert on Friday at 19:00. Not an entry: it becomes
 * one only when someone logs it afterwards (`loggedActivityId`).
 */
export interface Plan {
  _id: string;
  id: string;
  title: string;
  /** YYYY-MM-DD, the (first) day */
  date: string;
  /** YYYY-MM-DD, the last day of a trip; null for one day */
  endDate: string | null;
  /** HH:mm, null all day */
  time: string | null;
  timeZone: string;
  startsAt: string;
  notes?: string;
  typeId: string | null;
  type?: ActivityType;
  location: ActivityLocation | null;
  /** minutes before the start to remind the group; all-day plans count from 09:00 */
  remindBefore: number | null;
  remindAt: string | null;
  remindedAt: string | null;
  loggedActivityId: string | null;
  userId: string;
  groupId?: string;
}

export interface PlanInput {
  title: string;
  date: string;
  endDate?: string | null;
  time?: string | null;
  timeZone?: string;
  notes?: string;
  typeId?: string | null;
  location?: ActivityLocation | null;
  remindBefore?: number | null;
  groupId?: string;
}

export interface GetPlansFilters {
  groupId?: string;
  /** YYYY-MM-DD */
  startDate?: string;
  /** YYYY-MM-DD */
  endDate?: string;
  /** only the ones not yet logged */
  upcoming?: boolean;
  limit?: number;
}
