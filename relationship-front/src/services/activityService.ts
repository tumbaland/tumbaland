import { ActivityResponse } from '../types/Activity';

const API_BASE_URL = 'http://localhost:4002/api';

export const activityService = {
  async fetchActivities(): Promise<ActivityResponse> {
    const response = await fetch(`${API_BASE_URL}/activities`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: ActivityResponse = await response.json();
    
    if (!data.success) {
      throw new Error('Failed to fetch activities');
    }
    
    return data;
  }
};
