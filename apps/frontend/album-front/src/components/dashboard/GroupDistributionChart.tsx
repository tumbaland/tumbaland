import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box
} from '@mui/material';
import { Group as GroupIcon } from '@mui/icons-material';
import { PieChart } from '@mui/x-charts';

interface GroupData {
  groupId: string;
  albumCount: number;
  photoCount: number;
}

interface GroupDistributionChartProps {
  groups: GroupData[];
}

const GroupDistributionChart: React.FC<GroupDistributionChartProps> = ({ groups }) => {
  if (!groups.length) {
    return (
      <Card
        sx={{
          borderRadius: 3,
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.2)',
          height: '100%'
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <GroupIcon sx={{ mr: 2, color: '#ec4899' }} />
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
              Group Distribution
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="body1" sx={{
              color: "text.secondary"
            }}>
              No group data available
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  const colors = ['#ec4899', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'];

  return (
    <Card
      sx={{
        borderRadius: 3,
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.2)',
        height: '100%'
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <GroupIcon sx={{ mr: 2, color: '#ec4899' }} />
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
            Group Distribution
          </Typography>
        </Box>

        <Box sx={{ width: '100%', height: 300 }}>
          <PieChart
            series={[{
              data: groups.map((group, index) => ({
                id: group.groupId,
                value: group.photoCount,
                label: group.groupId === 'personal' ? 'Personal' : `Group ${group.groupId}`,
                color: colors[index % colors.length]
              })),
              innerRadius: 30,
              outerRadius: 100,
              paddingAngle: 2,
              cornerRadius: 4
            }]}
            height={300}
            margin={{
              top: 20,
              right: 20,
              bottom: 20,
              left: 20
            }}
          />
        </Box>

        <Box sx={{ mt: 2 }}>
          {groups.map((group, index) => (
            <Box key={group.groupId} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    backgroundColor: colors[index % colors.length],
                    mr: 1
                  }}
                />
                <Typography variant="body2" sx={{ color: '#64748b' }}>
                  {group.groupId === 'personal' ? 'Personal' : `Group ${group.groupId}`}
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: '#1e293b', fontWeight: 600 }}>
                {group.photoCount} photos
              </Typography>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

export default GroupDistributionChart;