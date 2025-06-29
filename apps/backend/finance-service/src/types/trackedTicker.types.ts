export interface TrackedTickerResponse {
  ticker: string;
  displayName: string;
  description?: string;
  dateAdded: string;
  isActive: boolean;
}

export interface ErrorResponse {
  error: string;
}
