import React, { useState } from "react";
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
  TablePagination,
  TableSortLabel,
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
import EditActivityModal from "../components/EditActivityModal";

const Activities: React.FC = () => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState<string>("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const {
    activities = [],
    loading,
    error,
    pagination,
    refetch,
  } = useActivities({
    page: page + 1, // API uses 1-based pagination
    limit: rowsPerPage,
    sortBy,
    sortOrder,
  });
  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };
  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = parseInt(event.target.value, 10);
    if (value === -1) {
      setRowsPerPage(10000); // Set to a very high number to load all
    } else {
      setRowsPerPage(value);
    }
    setPage(0);
  };

  const handleSort = (field: string) => {
    const isAsc = sortBy === field && sortOrder === "asc";
    setSortOrder(isAsc ? "desc" : "asc");
    setSortBy(field);
    setPage(0); // Reset to first page when sorting
  };

  const getActivityIcon = (activityType: ActivityType) => {
    const icons = {
      movies: <Movie />,
      cooking: <Restaurant />,
      dining: <Restaurant />,
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
        <AddActivityModal onActivityAdded={refetch} />
      </Box>

      <Paper sx={{ width: "100%", overflow: "hidden" }}>
        <TableContainer>
          <Table stickyHeader>
            {" "}
            <TableHead>
              <TableRow>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === "date"}
                    direction={sortBy === "date" ? sortOrder : "asc"}
                    onClick={() => handleSort("date")}
                  >
                    Date
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === "activity"}
                    direction={sortBy === "activity" ? sortOrder : "asc"}
                    onClick={() => handleSort("activity")}
                  >
                    Activity
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={sortBy === "hours"}
                    direction={sortBy === "hours" ? sortOrder : "asc"}
                    onClick={() => handleSort("hours")}
                  >
                    Duration (hrs)
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === "description"}
                    direction={sortBy === "description" ? sortOrder : "asc"}
                    onClick={() => handleSort("description")}
                  >
                    Description
                  </TableSortLabel>
                </TableCell>
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
                      <EditActivityModal
                        activity={activity}
                        onActivityUpdated={refetch}
                      />
                      <DeleteActivityButton
                        activityId={activity._id || activity.id || ""}
                        onDeleted={refetch}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>{" "}
          <TablePagination
            rowsPerPageOptions={[10, 100, 1000, { label: "All", value: -1 }]}
            component="div"
            count={pagination.total}
            rowsPerPage={rowsPerPage === 10000 ? -1 : rowsPerPage}
            page={rowsPerPage === 10000 ? 0 : page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default Activities;
