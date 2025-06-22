import React from "react";
import { Box, Typography, CircularProgress } from "@mui/material";
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
import HoursBarChart from "../components/HoursBarChart";
import MonthlyStackedBarChart from "../components/MonthlyStackedBarChart";
import ActivityStackedBarChart from "../components/ActivityStackedBarChart";
import WeeklyHeatmap from "../components/WeeklyHeatmap";
import CumulativeTimeline from "../components/CumulativeTimeline";

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
      </Box>
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
      <Box sx={{ mb: 4 }}>
        <HoursBarChart />
      </Box>
      <Box sx={{ mb: 4 }}>
        <MonthlyStackedBarChart />
      </Box>
      <Box sx={{ mb: 4, width: "100%" }}>
        <ActivityStackedBarChart height={500} />
      </Box>
      <Box sx={{ mb: 4, width: "100%" }}>
        <WeeklyHeatmap />
      </Box>
      <Box sx={{ mb: 4, width: "100%" }}>
        <CumulativeTimeline height={400} />
      </Box>
    </Box>
  );
};

export default Dashboard;
