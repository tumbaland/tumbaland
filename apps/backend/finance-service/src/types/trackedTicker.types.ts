export interface TrackedTickerResponse {
  _id: string;
  ticker: string;
  displayName: string;
  description?: string;
  dateAdded: string;
  isActive: boolean;
}

export interface ErrorResponse {
  error: string;
}
