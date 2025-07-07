import React from "react";
import { Box } from "@mui/material";
import StatsCards from "../components/StatsCards";
import RecentActivitiesCards from "../components/RecentActivitiesCards";
import HoursBarChart from "../components/HoursBarChart";
import MonthlyStackedBarChart from "../components/MonthlyStackedBarChart";
import ActivityStackedBarChart from "../components/ActivityStackedBarChart";
import WeeklyHeatmap from "../components/WeeklyHeatmap";
import CumulativeTimeline from "../components/CumulativeTimeline";

const Dashboard: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <StatsCards />
      <RecentActivitiesCards />
      <Box sx={{ mb: 4, width: "100%" }}>
        <HoursBarChart />
      </Box>
      <Box sx={{ mb: 4, width: "100%" }}>
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
