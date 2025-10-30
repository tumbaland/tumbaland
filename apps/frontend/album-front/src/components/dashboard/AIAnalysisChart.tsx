import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress
} from '@mui/material';
import { SmartToy as AIIcon } from '@mui/icons-material';

interface AIAnalysisData {
  totalPhotos: number;
  analyzedPhotos: number;
  analysisRate: number;
  totalDetections: number;
  totalMasks: number;
}

interface AIAnalysisChartProps {
  data: AIAnalysisData;
}

const AIAnalysisChart: React.FC<AIAnalysisChartProps> = ({ data }) => {
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
          <AIIcon sx={{ mr: 2, color: '#06b6d4' }} />
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
            AI Analysis
          </Typography>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              Analysis Rate
            </Typography>
            <Typography variant="body2" sx={{ color: '#1e293b', fontWeight: 600 }}>
              {data.analysisRate.toFixed(1)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={data.analysisRate}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: '#e5e7eb',
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                backgroundColor: '#06b6d4'
              }
            }}
          />
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Box>
            <Typography variant="body2" sx={{ color: '#64748b', mb: 1 }}>
              Photos Analyzed
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
              {data.analyzedPhotos.toLocaleString()}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              of {data.totalPhotos.toLocaleString()} total
            </Typography>
          </Box>

          <Box>
            <Typography variant="body2" sx={{ color: '#64748b', mb: 1 }}>
              AI Detections
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
              {data.totalDetections.toLocaleString()}
            </Typography>
          </Box>

          <Box sx={{ gridColumn: '1 / -1' }}>
            <Typography variant="body2" sx={{ color: '#64748b', mb: 1 }}>
              Segmentation Masks
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
              {data.totalMasks.toLocaleString()}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default AIAnalysisChart;