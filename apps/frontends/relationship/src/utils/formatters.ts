// Utility functions for formatting data

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export const formatDateTime = (dateString: string): string => {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatHours = (hours: number): string => {
  return hours === 1 ? '1 hour' : `${hours} hours`;
};

export const capitalizeFirst = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const getActivityTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    'movies': 'Movies',
    'cooking': 'Cooking',
    'dining': 'Dining',
    'date': 'Date',
    'walk': 'Walk',
    'shopping': 'Shopping',
    'gaming': 'Gaming',
    'other': 'Other'
  };
  return labels[type] || capitalizeFirst(type);
};
