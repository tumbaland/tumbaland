import React from 'react';
import { Activity } from '../types/Activity';
import { formatDate, formatHours, getActivityTypeLabel } from '../utils/formatters';

interface ActivitiesTableProps {
  activities: Activity[];
}

const ActivitiesTable: React.FC<ActivitiesTableProps> = ({ activities }) => {
  if (activities.length === 0) {
    return (
      <div className="activities-table">
        <h3>Recent Activities</h3>
        <div className="no-activities">
          <p>No activities found. Start by adding some activities!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="activities-table">
      <h3>Recent Activities ({activities.length})</h3>
      <div className="table-container">
        <table className="activities-table-content">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Description</th>
              <th>Hours</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((activity) => (
              <tr key={activity._id}>
                <td>{formatDate(activity.date)}</td>
                <td>
                  <span className={`activity-type ${activity.activity.type}`}>
                    {getActivityTypeLabel(activity.activity.type)}
                  </span>
                </td>
                <td className="activity-description">{activity.activity.description}</td>
                <td>{formatHours(activity.hours)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ActivitiesTable;
