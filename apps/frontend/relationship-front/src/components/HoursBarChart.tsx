import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Tooltip,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
} from '@mui/material';
import { getMonthlyHours, MonthlyHoursData } from '../api/statistics';

interface BarChartProps {
  title?: string;
  year?: number;
  height?: number;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const HoursBarChart: React.FC<BarChartProps> = ({ 
  title = 'Hours Spent Together Per Month', 
  year,
  height = 300 
}) => {
  const [data, setData] = useState<MonthlyHoursData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | undefined>(year);

  // Generate available years (from 2024 to current year)
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: currentYear - 2023 }, (_, i) => 2024 + i);  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const monthlyData = await getMonthlyHours(selectedYear);
        console.log('Fetched monthly data:', monthlyData); // Debug log
        setData(monthlyData);
      } catch (err) {
        console.error('Error fetching monthly data:', err); // Debug log
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedYear]);

  const maxHours = Math.max(...data.map(d => d.hours), 1);
  console.log('Chart render data:', { data, maxHours }); // Debug log

  if (loading) {
    return (
      <Card elevation={2}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {title}
          </Typography>
          <Box display="flex" justifyContent="center" alignItems="center" height={height}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card elevation={2}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {title}
          </Typography>
          <Alert severity="error">{error}</Alert>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card elevation={2}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {title}
          </Typography>
          <Box display="flex" justifyContent="center" alignItems="center" height={height}>
            <Typography color="text.secondary">No data available</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card elevation={2}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            {title}
          </Typography>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Year</InputLabel>
            <Select
              value={selectedYear || 'all'}
              label="Year"
              onChange={(e) => setSelectedYear(e.target.value === 'all' ? undefined : Number(e.target.value))}
            >
              <MenuItem value="all">All Years</MenuItem>
              {availableYears.map(yearOption => (
                <MenuItem key={yearOption} value={yearOption}>
                  {yearOption}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        
        <Box sx={{ position: 'relative', height: height - 60, mt: 2, border: '1px solid #ddd', mb: 4 }}> {/* Added mb for month labels */}
          {/* Y-axis labels */}
          <Box sx={{ 
            position: 'absolute', 
            left: 0, 
            top: 0, 
            height: '100%', 
            width: 40,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            pr: 1
          }}>
            {[maxHours, Math.round(maxHours * 0.75), Math.round(maxHours * 0.5), Math.round(maxHours * 0.25), 0].map((value, index) => (
              <Typography key={index} variant="caption" color="text.secondary">
                {value}h
              </Typography>
            ))}
          </Box>          {/* Chart area */}
          <Box sx={{ 
            ml: 5, 
            height: '100%', 
            display: 'flex', 
            alignItems: 'flex-end',
            borderLeft: '1px solid #e0e0e0',
            borderBottom: '1px solid #e0e0e0',
            position: 'relative'
          }}>
            {/* Grid lines */}
            {[0.25, 0.5, 0.75, 1].map((ratio, index) => (
              <Box
                key={index}
                sx={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: `${ratio * 100}%`,
                  height: '1px',
                  backgroundColor: '#f0f0f0',
                  zIndex: 1
                }}
              />
            ))}

            {/* Bars */}
            {data.map((item) => {
              const barHeight = (item.hours / maxHours) * 100;
              const monthIndex = parseInt(item.month) - 1;
              const monthName = MONTHS[monthIndex] || `M${item.month}`;
              const actualBarHeight = Math.max(barHeight, item.hours > 0 ? 2 : 0);
              
              console.log('Bar data:', { item, barHeight, actualBarHeight, monthName, maxHours }); // Debug log
              
              return (
                <Tooltip
                  key={`${item.year}-${item.month}`}
                  title={`${monthName} ${item.year}: ${item.hours} hours (${item.activities} activities)`}
                  arrow
                >
                  <Box sx={{ 
                    flex: 1, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    mx: 0.5,
                    cursor: 'pointer',
                    zIndex: 2,
                    height: '100%', // Full height of container
                    position: 'relative'
                  }}>
                    {/* The actual bar */}
                    <Box
                      sx={{
                        width: '100%',
                        maxWidth: 40,
                        height: `${actualBarHeight}%`,
                        backgroundColor: item.hours > 0 ? '#1976d2' : '#e0e0e0',
                        borderRadius: '4px 4px 0 0',
                        border: '1px solid #ccc',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          backgroundColor: '#1565c0',
                          transform: 'scaleY(1.05)',
                        }
                      }}
                    />
                    {/* Month label - positioned absolutely at bottom */}
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        position: 'absolute',
                        bottom: -30,
                        transform: 'rotate(-45deg)',
                        transformOrigin: 'center',
                        whiteSpace: 'nowrap',
                        fontSize: '0.75rem'
                      }}
                    >
                      {monthName}
                    </Typography>
                  </Box>
                </Tooltip>
              );
            })}
          </Box>
        </Box>

        {/* Debug info */}
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
          Debug: {data.length} months of data, Max hours: {maxHours}
        </Typography>

        {/* Summary stats */}
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-around', pt: 2, borderTop: '1px solid #e0e0e0' }}>
          <Box textAlign="center">
            <Typography variant="h6" color="primary">
              {data.reduce((sum, item) => sum + item.hours, 0)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Total Hours
            </Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="h6" color="primary">
              {Math.round(data.reduce((sum, item) => sum + item.hours, 0) / data.length || 0)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Avg per Month
            </Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="h6" color="primary">
              {Math.max(...data.map(d => d.hours))}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Peak Month
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default HoursBarChart;
