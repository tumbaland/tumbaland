import React from 'react';
import { Group } from '../../types';
import StatsStrip from '../StatsStrip';

interface GroupsStatsProps {
  groups: Group[];
  getUserRole: (group: Group) => string;
}

/**
 * One compact strip. Three full-width tiles stacked on a phone took more height
 * than the groups they summarised.
 */
const GroupsStats: React.FC<GroupsStatsProps> = ({ groups, getUserRole }) => {
  if (groups.length === 0) return null;

  const items = [
    { label: groups.length === 1 ? 'Group' : 'Groups', value: groups.length },
    { label: 'Members', value: groups.reduce((acc, group) => acc + (group.members?.length || 1), 0) },
    { label: 'You own', value: groups.filter((g) => getUserRole(g) === 'owner').length }
  ];

  return <StatsStrip items={items} />;
};

export default GroupsStats;
