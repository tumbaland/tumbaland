import React, { useEffect, useState } from "react";
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
} from "@mui/material";
import { getWeeklyHeatmapData, WeeklyHeatmapData } from "../api/statistics";

interface WeeklyHeatmapProps {
  title?: string;
  year?: number;
  height?: number;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Color intensity levels based on activity count
const getActivityColor = (count: number, maxCount: number): string => {
  if (count === 0) return "#ebedf0";

  const intensity = count / maxCount;
  if (intensity <= 0.2) return "#c6e48b";
  if (intensity <= 0.4) return "#7bc96f";
  if (intensity <= 0.6) return "#239a3b";
  if (intensity <= 0.8) return "#196127";
  return "#0d4820";
};

const WeeklyHeatmap: React.FC<WeeklyHeatmapProps> = ({
  title = "Activity Heatmap",
  year,
  height = 200,
}) => {
  const [data, setData] = useState<WeeklyHeatmapData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | undefined>(year);

  // Generate available years (from 2024 to current year)
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from(
    { length: currentYear - 2023 },
    (_, i) => 2024 + i
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const heatmapData = await getWeeklyHeatmapData(selectedYear);
        console.log("Fetched heatmap data:", heatmapData);
        setData(heatmapData);
      } catch (err) {
        console.error("Error fetching heatmap data:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedYear]);

  // Calculate max activity count for color scaling
  const maxActivityCount = Math.max(...data.map((d) => d.totalActivities), 1);

  // Create a map for quick lookup of data by date
  const dataMap = new Map<string, WeeklyHeatmapData>();
  data.forEach((item) => {
    dataMap.set(item.date, item);
  });

  // Generate calendar grid
  const generateCalendarGrid = () => {
    if (data.length === 0) return [];

    const yearToShow = selectedYear || currentYear;
    const startDate = new Date(yearToShow, 0, 1);
    const endDate = new Date(yearToShow, 11, 31);

    // Find the Sunday of the week containing January 1st
    const firstSunday = new Date(startDate);
    firstSunday.setDate(startDate.getDate() - startDate.getDay());

    // Generate weeks
    const weeks = [];
    const currentDate = new Date(firstSunday);

    while (currentDate <= endDate || weeks.length < 53) {
      const week = [];

      for (let day = 0; day < 7; day++) {
        const dateStr = currentDate.toISOString().split("T")[0];
        const dayData = dataMap.get(dateStr);
        const isCurrentYear = currentDate.getFullYear() === yearToShow;

        week.push({
          date: dateStr,
          data: dayData,
          isCurrentYear,
          dayOfWeek: day,
          displayDate: new Date(currentDate),
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      weeks.push(week);

      // Break if we've gone too far past the end of the year
      if (currentDate > endDate && currentDate.getMonth() > 0) {
        break;
      }
    }

    return weeks;
  };

  if (loading) {
    return (
      <Card elevation={2}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {title}
          </Typography>
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            height={height}
          >
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

  const weeks = generateCalendarGrid();

  return (
    <Card elevation={2}>
      <CardContent>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Typography variant="h6">{title}</Typography>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Year</InputLabel>
            <Select
              value={selectedYear || currentYear}
              label="Year"
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {availableYears.map((yearOption) => (
                <MenuItem key={yearOption} value={yearOption}>
                  {yearOption}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>{" "}
        {/* Heatmap Grid */}
        <Box
          sx={{
            overflowX: "auto",
            pb: 2,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Box sx={{ display: "flex", gap: 1, minWidth: 800 }}>
            {/* Day labels */}
            <Box
              sx={{ display: "flex", flexDirection: "column", gap: 1, pt: 4 }}
            >
              {DAYS.map((day, index) => (
                <Box
                  key={day}
                  sx={{
                    height: 12,
                    display: "flex",
                    alignItems: "center",
                    opacity: index % 2 === 0 ? 1 : 0, // Show every other day label
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ fontSize: "0.7rem", width: 25 }}
                  >
                    {index % 2 === 0 ? day : ""}
                  </Typography>
                </Box>
              ))}
            </Box>{" "}
            {/* Calendar Grid */}
            <Box sx={{ flex: 1 }}>
              {/* Month labels */}
              <Box sx={{ display: "flex", mb: 1, height: 20, gap: 1 }}>
                {weeks.map((week, weekIndex) => {
                  const firstDayOfWeek = week[0].displayDate;
                  const showMonth =
                    firstDayOfWeek.getDate() <= 7 || weekIndex === 0;

                  return (
                    <Box
                      key={weekIndex}
                      sx={{
                        width: 12,
                        display: "flex",
                        justifyContent: "center",
                      }}
                    >
                      {showMonth && (
                        <Typography
                          variant="caption"
                          sx={{ fontSize: "0.7rem" }}
                        >
                          {MONTHS[firstDayOfWeek.getMonth()]}
                        </Typography>
                      )}
                    </Box>
                  );
                })}
              </Box>

              {/* Heatmap cells */}
              <Box sx={{ display: "flex", gap: 1 }}>
                {weeks.map((week, weekIndex) => (
                  <Box
                    key={weekIndex}
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 1,
                      width: 12,
                    }}
                  >
                    {week.map((day, dayIndex) => {
                      const activityCount = day.data?.totalActivities || 0;
                      const color = day.isCurrentYear
                        ? getActivityColor(activityCount, maxActivityCount)
                        : "#ebedf0";

                      const tooltipTitle = day.data
                        ? `${day.displayDate.toLocaleDateString()}: ${activityCount} activities (${day.data.totalHours}h)`
                        : `${day.displayDate.toLocaleDateString()}: No activities`;

                      return (
                        <Tooltip key={dayIndex} title={tooltipTitle} arrow>
                          <Box
                            sx={{
                              width: 12,
                              height: 12,
                              backgroundColor: color,
                              border: "1px solid #e1e4e8",
                              borderRadius: "2px",
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                              "&:hover": {
                                transform: "scale(1.2)",
                                borderColor: "#333",
                              },
                            }}
                          />
                        </Tooltip>
                      );
                    })}
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </Box>
        {/* Legend */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mt: 2,
            pt: 2,
            borderTop: "1px solid #e0e0e0",
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {data.length} days with activities
          </Typography>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Less
            </Typography>
            {[0, 0.2, 0.4, 0.6, 0.8, 1].map((intensity, index) => (
              <Box
                key={index}
                sx={{
                  width: 12,
                  height: 12,
                  backgroundColor: getActivityColor(
                    intensity * maxActivityCount,
                    maxActivityCount
                  ),
                  border: "1px solid #e1e4e8",
                  borderRadius: "2px",
                }}
              />
            ))}
            <Typography variant="caption" color="text.secondary">
              More
            </Typography>
          </Box>
        </Box>
        {/* Summary stats */}
        <Box
          sx={{
            mt: 2,
            display: "flex",
            justifyContent: "space-around",
            pt: 2,
            borderTop: "1px solid #e0e0e0",
          }}
        >
          <Box textAlign="center">
            <Typography variant="h6" color="primary">
              {data.reduce((sum, item) => sum + item.totalActivities, 0)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Total Activities
            </Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="h6" color="primary">
              {data.filter((item) => item.totalActivities > 0).length}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Active Days
            </Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="h6" color="primary">
              {maxActivityCount}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Max Per Day
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default WeeklyHeatmap;
