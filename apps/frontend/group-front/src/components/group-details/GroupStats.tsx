import React from 'react';
import { Group } from '../../types';
import StatsStrip from '../StatsStrip';

interface GroupStatsProps {
  group: Group;
}

/** One compact strip, matching the groups list. Admins counts the owner too. */
const GroupStats: React.FC<GroupStatsProps> = ({ group }) => {
  const members = group.members ?? [];
  const items = [
    { label: 'Members', value: members.length },
    { label: 'Admins', value: members.filter((m) => m.role === 'admin' || m.role === 'owner').length },
    { label: 'Owners', value: members.filter((m) => m.role === 'owner').length }
  ];

  return <StatsStrip items={items} />;
};

export default GroupStats;
