import React from "react";
import { Box, CircularProgress, Alert } from "@mui/material";
import {
  AccessTime,
  Favorite,
  Timeline,
  Event,
  TrendingUp,
  Assessment,
} from "@mui/icons-material";
import { useStatistics } from "../hooks/useStatistics";
import StatCard from "./StatCard";

const StatsCards: React.FC = () => {
  const { statistics, loading, error } = useStatistics();

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "200px",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        Error loading statistics: {error}
      </Alert>
    );
  }

  if (!statistics) {
    return (
      <Alert severity="warning" sx={{ mb: 3 }}>
        No statistics available. Please check if the backend is running.
      </Alert>
    );
  }

  return (
    <>
      {/* Primary Stats Cards */}
      <Box sx={{ display: "flex", gap: 3, mb: 4, flexWrap: "wrap" }}>
        <Box sx={{ minWidth: 280, flex: 1 }}>
          <StatCard
            icon={<Timeline />}
            title="Days"
            value={statistics.daysTogether}
            subtitle={`${statistics.daysTogether} days since Jan 25, 2024`}
            color="warning.main"
          />
        </Box>
        <Box sx={{ minWidth: 280, flex: 1 }}>
          <StatCard
            icon={<AccessTime />}
            title="Total Hours Together"
            value={statistics.totalHoursTogether}
            subtitle={`${statistics.totalHoursTogether} hours spent together`}
            color="primary.main"
          />
        </Box>{" "}
        <Box sx={{ minWidth: 280, flex: 1 }}>
          <StatCard
            icon={<Favorite />}
            title="Make Love Days"
            value={statistics.sexActivityDays}
            subtitle={`${statistics.sexActivityDays} love days`}
            color="error.main"
          />
        </Box>
        <Box sx={{ minWidth: 280, flex: 1 }}>
          <StatCard
            icon={<Event />}
            title="Total Activities"
            value={statistics.totalActivities}
            subtitle={`${statistics.totalActivities} shared experiences`}
            color="error.main"
          />
        </Box>
      </Box>

      {/* Secondary Stats Cards */}
      <Box sx={{ display: "flex", gap: 3, mb: 4, flexWrap: "wrap" }}>
        <Box sx={{ minWidth: 280, flex: 1 }}>
          <StatCard
            icon={<Timeline />}
            title="This Month"
            value={statistics.activitiesThisMonth}
            subtitle={`${statistics.activitiesThisMonth} activities this month`}
            color="warning.main"
          />
        </Box>
        <Box sx={{ minWidth: 280, flex: 1 }}>
          <StatCard
            icon={<Assessment />}
            title="Most Frequent"
            value={statistics.mostFrequentActivity.type}
            subtitle={`${statistics.mostFrequentActivity.count} times`}
            color="secondary.main"
          />
        </Box>
        <Box sx={{ minWidth: 280, flex: 1 }}>
          <StatCard
            icon={<TrendingUp />}
            title="Weekly Average"
            value={statistics.recentTrends.weeklyAverage.toFixed(1)}
            subtitle={`${statistics.recentTrends.weeklyAverage.toFixed(1)} hours/week`}
            color="success.main"
          />
        </Box>
        <Box sx={{ minWidth: 280, flex: 1 }}>
          <StatCard
            icon={<Timeline />}
            title="Last Week"
            value={statistics.recentTrends.lastWeekHours}
            subtitle={`${statistics.recentTrends.lastWeekHours} hours last week`}
            color="info.main"
          />
        </Box>
      </Box>
    </>
  );
};

export default StatsCards;
