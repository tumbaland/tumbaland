import { ActivityType } from '../api/types';

/**
 * Format date for display
 */
export const formatDate = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

/**
 * Format date for form inputs (YYYY-MM-DD)
 */
export const formatDateForInput = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toISOString().split('T')[0];
};

/**
 * Format duration in hours
 */
export const formatDuration = (hours: number): string => {
  if (hours < 1) {
    return `${Math.round(hours * 60)} mins`;
  } else if (hours === 1) {
    return '1 hour';
  } else if (hours % 1 === 0) {
    return `${hours} hours`;
  } else {
    return `${hours} hours`;
  }
};

/**
 * Validate activity data
 */
export const validateActivity = (activity: {
  date?: Date | string;
  hours?: number;
  activity?: {
    type?: ActivityType;
    description?: string;
  };
}): string[] => {
  const errors: string[] = [];
  if (!activity.date) {
    errors.push('Date is required');
  }

  // Hours is now optional, but if provided, must be valid
  if (activity.hours !== undefined && activity.hours !== null) {
    if (activity.hours <= 0) {
      errors.push('Duration must be greater than 0');
    }
    if (!Number.isInteger(activity.hours)) {
      errors.push('Duration must be a whole number');
    }
  }

  if (!activity.activity?.type) {
    errors.push('Activity type is required');
  }

  // Description is now optional, but if provided, must not exceed max length
  if (activity.activity?.description && activity.activity.description.length > 500) {
    errors.push('Description must be 500 characters or less');
  }

  return errors;
};

/**
 * Sort activities by date (newest first)
 */
export const sortActivitiesByDate = <T extends { date: Date | string }>(activities: T[]): T[] => {
  return [...activities].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateB.getTime() - dateA.getTime();
  });
};

/**
 * Group activities by month
 */
export const groupActivitiesByMonth = <T extends { date: Date | string }>(activities: T[]): Record<string, T[]> => {
  return activities.reduce(
    (groups, activity) => {
      const date = new Date(activity.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(activity);

      return groups;
    },
    {} as Record<string, T[]>
  );
};

/**
 * Calculate total hours for activities
 */
export const calculateTotalHours = <T extends { hours: number }>(activities: T[]): number => {
  return activities.reduce((total, activity) => total + activity.hours, 0);
};
