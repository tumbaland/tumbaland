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
