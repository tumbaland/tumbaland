import React from "react";
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Chip,
  Divider,
} from "@mui/material";
import {
  AccessTime,
  Favorite,
  Timeline,
  Event,
  TrendingUp,
  Assessment,
} from "@mui/icons-material";
import { useStatistics } from "../hooks/useStatistics";
import StatCard from "../components/StatCard";

const Dashboard: React.FC = () => {
  const {
    statistics,
    loading: statsLoading,
    error: statsError,
  } = useStatistics();
  // Use statistics from API
  const displayStats = statistics
    ? {
        totalHours: statistics.totalHoursTogether,
        sexActivities: statistics.sexActivityDays,
        activitiesCount: statistics.totalActivities,
        avgHours: statistics.avgHoursPerDay,
        activitiesThisMonth: statistics.activitiesThisMonth,
        daysTogether: statistics.daysTogether,
        mostFrequent: statistics.mostFrequentActivity,
        trends: statistics.recentTrends,
        breakdown: statistics.activityBreakdown,
      }
    : null;

  const loading = statsLoading;
  const error = statsError;
  if (loading) {
    return (
      <Box
        sx={{
          p: 3,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "400px",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Relationship Dashboard
        </Typography>
        <Typography color="error">Error loading data: {error}</Typography>
      </Box>
    );
  }

  if (!displayStats) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Relationship Dashboard
        </Typography>
        <Typography>
          No statistics available. Please check if the backend is running.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Relationship Dashboard
      </Typography>
      {/* Stats Cards */}
      <Box sx={{ display: "flex", gap: 3, mb: 4, flexWrap: "wrap" }}>
        <Box sx={{ minWidth: 280, flex: 1 }}>
          <StatCard
            icon={<AccessTime />}
            title="Total Hours Together"
            value={displayStats.totalHours}
            subtitle={`${displayStats.totalHours} hours spent together`}
            color="primary.main"
          />
        </Box>
        <Box sx={{ minWidth: 280, flex: 1 }}>
          <StatCard
            icon={<Favorite />}
            title="Sex Activity Days"
            value={displayStats.sexActivities}
            subtitle={`${displayStats.sexActivities} intimate days`}
            color="success.main"
          />
        </Box>
        <Box sx={{ minWidth: 280, flex: 1 }}>
          <StatCard
            icon={<Event />}
            title="Total Activities"
            value={displayStats.activitiesCount}
            subtitle={`${displayStats.activitiesCount} shared experiences`}
            color="error.main"
          />
        </Box>{" "}
        <Box sx={{ minWidth: 280, flex: 1 }}>
          <StatCard
            icon={<Timeline />}
            title="Days Together"
            value={displayStats.daysTogether}
            subtitle={`${displayStats.daysTogether} days since Jan 25, 2024`}
            color="warning.main"
          />
        </Box>
        <Box sx={{ minWidth: 280, flex: 1 }}>
          <StatCard
            icon={<TrendingUp />}
            title="Average Hours/Day"
            value={displayStats.avgHours.toFixed(1)}
            subtitle={`${displayStats.avgHours.toFixed(1)} hours per day`}
            color="info.main"
          />
        </Box>
      </Box>{" "}
      {/* Additional Stats Row */}
      <Box sx={{ display: "flex", gap: 3, mb: 4, flexWrap: "wrap" }}>
        <Box sx={{ minWidth: 280, flex: 1 }}>
          <StatCard
            icon={<Timeline />}
            title="This Month"
            value={displayStats.activitiesThisMonth}
            subtitle={`${displayStats.activitiesThisMonth} activities this month`}
            color="warning.main"
          />
        </Box>
        <Box sx={{ minWidth: 280, flex: 1 }}>
          <StatCard
            icon={<Assessment />}
            title="Most Frequent"
            value={displayStats.mostFrequent.type}
            subtitle={`${displayStats.mostFrequent.count} times`}
            color="secondary.main"
          />
        </Box>
        <Box sx={{ minWidth: 280, flex: 1 }}>
          <StatCard
            icon={<TrendingUp />}
            title="Weekly Average"
            value={displayStats.trends.weeklyAverage.toFixed(1)}
            subtitle={`${displayStats.trends.weeklyAverage.toFixed(1)} hours/week`}
            color="success.main"
          />
        </Box>
        <Box sx={{ minWidth: 280, flex: 1 }}>
          <StatCard
            icon={<Timeline />}
            title="Last Week"
            value={displayStats.trends.lastWeekHours}
            subtitle={`${displayStats.trends.lastWeekHours} hours last week`}
            color="info.main"
          />
        </Box>
      </Box>
      {/* Charts Section */}
      <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
        <Box sx={{ flex: 2, minWidth: 400 }}>
          <Paper
            sx={{ p: 3, height: 400, display: "flex", flexDirection: "column" }}
          >
            {" "}
            <Typography variant="h6" gutterBottom>
              Activity Breakdown
            </Typography>
            {displayStats.breakdown.length > 0 ? (
              <Box
                sx={{
                  mt: 2,
                  flexGrow: 1,
                  overflowY: "auto",
                  pr: 1,
                }}
              >
                {displayStats.breakdown.map((activity, index) => (
                  <Box key={index} sx={{ mb: 2 }}>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        mb: 1,
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ textTransform: "capitalize" }}
                      >
                        {activity.type}
                      </Typography>
                      <Typography variant="body2">
                        {activity.count} times ({activity.percentage}%)
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        mb: 1,
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        {activity.totalHours} hours total
                      </Typography>
                      <Chip
                        label={`${activity.percentage}%`}
                        size="small"
                        color={index < 3 ? "primary" : "default"}
                      />
                    </Box>
                    <Box
                      sx={{
                        width: "100%",
                        height: 8,
                        backgroundColor: "grey.200",
                        borderRadius: 1,
                        overflow: "hidden",
                      }}
                    >
                      <Box
                        sx={{
                          width: `${activity.percentage}%`,
                          height: "100%",
                          backgroundColor:
                            index < 3 ? "primary.main" : "grey.400",
                          transition: "width 0.3s ease",
                        }}
                      />
                    </Box>{" "}
                    {index < displayStats.breakdown.length - 1 && (
                      <Divider sx={{ mt: 2 }} />
                    )}
                  </Box>
                ))}
              </Box>
            ) : (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexGrow: 1,
                  color: "text.secondary",
                }}
              >
                <Typography>Activity breakdown will appear here</Typography>
              </Box>
            )}
          </Paper>
        </Box>
        <Box sx={{ flex: 1, minWidth: 300 }}>
          <Paper
            sx={{ p: 3, height: 400, display: "flex", flexDirection: "column" }}
          >
            {" "}
            <Typography variant="h6" gutterBottom>
              Recent Trends
            </Typography>
            <Box
              sx={{
                mt: 3,
                flexGrow: 1,
                overflowY: "auto",
                pr: 1,
              }}
            >
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <Box sx={{ p: 2, backgroundColor: "grey.50", borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Weekly Average
                  </Typography>
                  <Typography variant="h4" color="primary.main">
                    {displayStats.trends.weeklyAverage.toFixed(1)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    hours per week
                  </Typography>
                </Box>
                <Box sx={{ p: 2, backgroundColor: "grey.50", borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Monthly Average
                  </Typography>
                  <Typography variant="h4" color="secondary.main">
                    {displayStats.trends.monthlyAverage.toFixed(1)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    hours per month
                  </Typography>
                </Box>
                <Box sx={{ p: 2, backgroundColor: "grey.50", borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Last Week
                  </Typography>
                  <Typography variant="h4" color="info.main">
                    {displayStats.trends.lastWeekHours}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    hours total
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
};

export default Dashboard;
