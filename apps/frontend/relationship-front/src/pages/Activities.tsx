import React from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
} from "@mui/material";
import {
  Restaurant,
  Movie,
  SportsEsports,
  Flight,
  Favorite,
  Category,
} from "@mui/icons-material";
import { useActivities } from "../hooks/useActivities";
import { ActivityType } from "../api/types";
import AddActivityModal from "../components/AddActivityModal";
import DeleteActivityButton from "../components/DeleteActivityButton";

const Activities: React.FC = () => {
  const { activities = [], loading, error, refetch } = useActivities();

  const getActivityIcon = (activityType: ActivityType) => {
    const icons = {
      movies: <Movie />,
      cooking: <Restaurant />,
      coffee: <Restaurant />,
      gaming: <SportsEsports />,
      together: <Flight />,
      sex: <Favorite />,
      other: <Category />,
    };
    return icons[activityType] || <Category />;
  };

  const getActivityColor = (activityType: ActivityType) => {
    const colors: { [key: string]: string } = {
      cooking: "warning",
      movies: "primary",
      gaming: "secondary",
      together: "success",
      dining: "warning",
      lunch: "info",
      sex: "error",
      other: "default",
    };
    return colors[activityType] || "default";
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString();
  };

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
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Typography variant="h4" component="h1">
          Activities Together
        </Typography>
        <AddActivityModal />
      </Box>
      <Paper sx={{ width: "100%", overflow: "hidden" }}>
        <TableContainer>
          <Table stickyHeader>
            {" "}
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Activity</TableCell>
                <TableCell align="right">Duration (hrs)</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {" "}
              {!activities || activities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No activities yet. Click "Add Activity" to get started!
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                activities.map((activity) => (
                  <TableRow
                    key={activity._id || activity.id}
                    sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                  >
                    {" "}
                    <TableCell>{formatDate(activity.date)}</TableCell>
                    <TableCell>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        {getActivityIcon(activity.activity.type)}
                        <Chip
                          label={activity.activity.type}
                          color={
                            getActivityColor(activity.activity.type) as any
                          }
                          size="small"
                        />
                      </Box>
                    </TableCell>
                    <TableCell align="right">{activity.hours}</TableCell>
                    <TableCell>{activity.activity.description}</TableCell>{" "}
                    <TableCell align="center">
                      <DeleteActivityButton
                        activityId={activity._id || activity.id || ""}
                        onDeleted={refetch}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default Activities;
