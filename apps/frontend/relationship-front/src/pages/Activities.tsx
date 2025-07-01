import React, { useState } from "react";
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
} from "@mui/material";
import { useActivities } from "../hooks/useActivities";
import { ActivityType } from "../api/types";
import AddActivityModal from "../components/AddActivityModal";
import ActivitiesTable from "../components/ActivitiesTable";

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
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: { xs: 'flex-start', sm: 'space-between' },
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: 2,
          mb: 3,
        }}
      >
        <Typography variant="h4" component="h1" sx={{ mb: { xs: 1, sm: 0 } }}>
          Activities Together
        </Typography>
        <AddActivityModal onActivityAdded={refetch} />
      </Box>

      <Paper
        sx={{
          width: "100%",
          overflowX: "auto",
          boxShadow: { xs: 'none', sm: undefined },
        }}
      >
        <ActivitiesTable
          activities={activities}
          sortBy={sortBy}
          sortOrder={sortOrder}
          handleSort={handleSort}
          getActivityColor={getActivityColor}
          formatDate={formatDate}
          refetch={refetch}
          pagination={pagination}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
    </Box>
  );
};

export default Activities;
