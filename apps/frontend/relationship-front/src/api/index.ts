// Export all API functions and types from a single entry point
export * from './types';
export * from './config';
export * from './activities';

// Convenience re-exports for commonly used items
export { apiClient as api } from './config';
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
