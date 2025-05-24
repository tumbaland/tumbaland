// Activity-related type definitions
export interface Activity {
  _id: string;
  date: string;
  hours: number;
  activity: {
    type: 'movies' | 'cooking' | 'dining' | 'date' | 'walk' | 'shopping' | 'gaming' | 'other';
    description: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ActivityResponse {
  success: boolean;
  data: {
    activities: Activity[];
    total: number;
    page: number;
    totalPages: number;
  };
}

export interface ActivitySummary {
  totalActivities: number;
  totalHours: number;
  averageHoursPerActivity: number;
  mostFrequentActivityType: string;
  activitiesByType: Record<string, number>;
}

export interface ActivityFilters {
  type?: string;
  dateFrom?: string;
  dateTo?: string;
}
