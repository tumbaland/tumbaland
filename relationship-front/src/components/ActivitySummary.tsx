import React from 'react';
import { ActivitySummary } from '../types/Activity';
import { formatHours, getActivityTypeLabel } from '../utils/formatters';

interface ActivitySummaryProps {
  summary: ActivitySummary;
}

const ActivitySummaryComponent: React.FC<ActivitySummaryProps> = ({ summary }) => {
  return (
    <div className="activity-summary">
      <h3>Activity Summary</h3>
      <div className="summary-cards">
        <div className="summary-card">
          <div className="summary-value">{summary.totalActivities}</div>
          <div className="summary-label">Total Activities</div>
        </div>
        <div className="summary-card">
          <div className="summary-value">{formatHours(summary.totalHours)}</div>
          <div className="summary-label">Total Time</div>
        </div>
        <div className="summary-card">
          <div className="summary-value">{summary.averageHoursPerActivity}h</div>
          <div className="summary-label">Average per Activity</div>
        </div>
        <div className="summary-card">
          <div className="summary-value">{getActivityTypeLabel(summary.mostFrequentActivityType)}</div>
          <div className="summary-label">Most Frequent</div>
        </div>
      </div>
    </div>
  );
};

export default ActivitySummaryComponent;
