import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box
} from '@mui/material';
import { Tag as TagIcon } from '@mui/icons-material';
import { BarChart } from '@mui/x-charts';

interface TagData {
  tag: string;
  count: number;
}

interface TagsChartProps {
  tags: TagData[];
}

const TagsChart: React.FC<TagsChartProps> = ({ tags }) => {
  if (!tags.length) {
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
            <TagIcon sx={{ mr: 2, color: '#8b5cf6' }} />
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
              Popular Tags
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="body1" color="text.secondary">
              No tags found
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

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
          <TagIcon sx={{ mr: 2, color: '#8b5cf6' }} />
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
            Popular Tags
          </Typography>
        </Box>
        <Box sx={{ width: '100%', height: 300 }}>
          <BarChart
            yAxis={[{
              data: tags.map(tag => tag.tag),
              scaleType: 'band'
            }]}
            xAxis={[{
              label: 'Usage Count',
              labelStyle: { textAnchor: 'middle' },
              tickNumber: 5
            }]}
            series={[{
              data: tags.map(tag => tag.count),
              valueFormatter: (value) => `${value}`,
              color: '#8b5cf6'
            }]}
            height={300}
            margin={{
              top: 20,
              right: 30,
              bottom: 60,
              left: 80
            }}
            grid={{ horizontal: false, vertical: true }}
            layout="horizontal"
          />
        </Box>
      </CardContent>
    </Card>
  );
};

export default TagsChart;