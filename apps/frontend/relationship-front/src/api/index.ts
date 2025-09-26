// Export all API functions and types from a single entry point
export * from './types';
export * from './activities';
export * from './activityTypes';
export * from './statistics';

// Convenience re-exports for commonly used items
export { relationshipApi as api } from '../config/relationshipApi';
export {
  createActivity,
  getActivities,
  getActivityById,
  updateActivity,
  deleteActivity,
  getActivityStats,
  getActivitiesByDateRange,
  getRecentActivities,
  getActivityTypes
} from './activities';

export { getStatistics, statisticsApi } from './statistics';
