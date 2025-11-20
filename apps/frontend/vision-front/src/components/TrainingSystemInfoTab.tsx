import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
} from '@mui/material';
import { LineChart } from '@mui/x-charts';
import { Epoch } from '../types';

interface TrainingSystemInfoTabProps {
  epochs: Epoch[];
}

const TrainingSystemInfoTab: React.FC<TrainingSystemInfoTabProps> = ({ epochs }) => {
  // Filter epochs that have system_info
  const epochsWithSystemInfo = epochs.filter(epoch => epoch.system_info);

  if (epochsWithSystemInfo.length === 0) {
    return (
      <Alert severity="info">
        No system information available for this training. System info is recorded in epoch.json files.
      </Alert>
    );
  }

  // Prepare data for charts
  const chartData = epochsWithSystemInfo.map(epoch => ({
    epoch: epoch.epoch,
    cpuPercent: epoch.system_info?.cpu?.percent || 0,
    memoryPercent: epoch.system_info?.memory?.percent || 0,
    gpuUtilization: epoch.system_info?.gpu?.utilization || 0,
    gpuMemoryUsed: epoch.system_info?.gpu?.memory?.used || 0,
    gpuMemoryTotal: epoch.system_info?.gpu?.memory?.total || 0,
    gpuTemperature: epoch.system_info?.gpu?.temperature || 0,
    gpuPower: epoch.system_info?.gpu?.power?.current || 0,
    gpuPowerLimit: epoch.system_info?.gpu?.power?.limit || 0,
  }));

  const epochNumbers = chartData.map(d => d.epoch);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        System Information Over Training
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        System metrics collected during training epochs, including CPU, memory, and GPU usage.
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: 3 }}>
        {/* CPU Usage */}
        <Box>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                CPU Usage (%)
              </Typography>
              <LineChart
                xAxis={[{ data: epochNumbers, label: 'Epoch' }]}
                series={[
                  {
                    data: chartData.map(d => d.cpuPercent),
                    label: 'CPU %',
                    color: '#1976d2',
                  },
                ]}
                height={300}
                margin={{ left: 70, right: 30, top: 30, bottom: 50 }}
              />
            </CardContent>
          </Card>
        </Box>

        {/* Memory Usage */}
        <Box>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Memory Usage (%)
              </Typography>
              <LineChart
                xAxis={[{ data: epochNumbers, label: 'Epoch' }]}
                series={[
                  {
                    data: chartData.map(d => d.memoryPercent),
                    label: 'Memory %',
                    color: '#2e7d32',
                  },
                ]}
                height={300}
                margin={{ left: 70, right: 30, top: 30, bottom: 50 }}
              />
            </CardContent>
          </Card>
        </Box>

        {/* GPU Utilization */}
        <Box>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                GPU Utilization (%)
              </Typography>
              <LineChart
                xAxis={[{ data: epochNumbers, label: 'Epoch' }]}
                series={[
                  {
                    data: chartData.map(d => d.gpuUtilization),
                    label: 'GPU %',
                    color: '#ed6c02',
                  },
                ]}
                height={300}
                margin={{ left: 70, right: 30, top: 30, bottom: 50 }}
              />
            </CardContent>
          </Card>
        </Box>

        {/* GPU Memory Usage */}
        <Box>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                GPU Memory Usage (GB)
              </Typography>
              <LineChart
                xAxis={[{ data: epochNumbers, label: 'Epoch' }]}
                series={[
                  {
                    data: chartData.map(d => d.gpuMemoryUsed / (1024**3)), // Convert to GB
                    label: 'Used (GB)',
                    color: '#9c27b0',
                  },
                  {
                    data: chartData.map(d => d.gpuMemoryTotal / (1024**3)), // Convert to GB
                    label: 'Total (GB)',
                    color: '#607d8b',
                  },
                ]}
                height={300}
                margin={{ left: 70, right: 30, top: 30, bottom: 50 }}
              />
            </CardContent>
          </Card>
        </Box>

        {/* GPU Temperature */}
        <Box>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                GPU Temperature (°C)
              </Typography>
              <LineChart
                xAxis={[{ data: epochNumbers, label: 'Epoch' }]}
                series={[
                  {
                    data: chartData.map(d => d.gpuTemperature),
                    label: 'Temperature (°C)',
                    color: '#d32f2f',
                  },
                ]}
                height={300}
                margin={{ left: 70, right: 30, top: 30, bottom: 50 }}
              />
            </CardContent>
          </Card>
        </Box>

        {/* GPU Power */}
        <Box>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                GPU Power Usage (W)
              </Typography>
              <LineChart
                xAxis={[{ data: epochNumbers, label: 'Epoch' }]}
                series={[
                  {
                    data: chartData.map(d => d.gpuPower),
                    label: 'Current (W)',
                    color: '#f57c00',
                  },
                  {
                    data: chartData.map(d => d.gpuPowerLimit),
                    label: 'Limit (W)',
                    color: '#424242',
                  },
                ]}
                height={300}
                margin={{ left: 70, right: 30, top: 30, bottom: 50 }}
              />
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
};

export default TrainingSystemInfoTab;