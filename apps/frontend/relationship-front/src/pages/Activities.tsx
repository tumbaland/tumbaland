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
        <TableContainer sx={{ maxHeight: 'none', overflowY: 'unset' }}>
          <Table
            stickyHeader
            size="small"
            sx={{
              minWidth: 500,
              fontSize: { xs: '0.72rem', sm: '0.95rem' },
              '& th, & td': {
                px: { xs: 0.5, sm: 1 },
                py: { xs: 0.5, sm: 0.8 },
                fontSize: { xs: '0.72rem', sm: '0.95rem' },
                whiteSpace: { xs: 'nowrap', sm: 'normal' },
                maxWidth: { xs: 80, sm: 'none' },
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 60 }}>
                  <TableSortLabel
                    active={sortBy === "date"}
                    direction={sortBy === "date" ? sortOrder : "asc"}
                    onClick={() => handleSort("date")}
                  >
                    <span style={{ fontSize: '0.78em' }}>Date</span>
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ minWidth: 50, maxWidth: 70, width: 60 }}>
                  <TableSortLabel
                    active={sortBy === "activity"}
                    direction={sortBy === "activity" ? sortOrder : "asc"}
                    onClick={() => handleSort("activity")}
                  >
                    <span style={{ fontSize: '0.78em' }}>Activity</span>
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sx={{ minWidth: 60 }}>
                  <TableSortLabel
                    active={sortBy === "hours"}
                    direction={sortBy === "hours" ? sortOrder : "asc"}
                    onClick={() => handleSort("hours")}
                  >
                    <span style={{ fontSize: '0.78em' }}>Duration</span>
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ minWidth: 140, maxWidth: 220, width: 180 }}>
                  <TableSortLabel
                    active={sortBy === "description"}
                    direction={sortBy === "description" ? sortOrder : "asc"}
                    onClick={() => handleSort("description")}
                  >
                    <span style={{ fontSize: '0.78em' }}>Description</span>
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center" sx={{ minWidth: 60 }}>
                  <span style={{ fontSize: '0.78em' }}>Actions</span>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!activities || activities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.72rem', sm: '0.95rem' } }}>
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
                    <TableCell>{formatDate(activity.date)}</TableCell>
                    <TableCell>
                      <Chip
                        label={activity.activity.type}
                        color={getActivityColor(activity.activity.type) as any}
                        size="small"
                        sx={{ fontSize: { xs: '0.62rem', sm: '0.80rem' }, height: { xs: 18, sm: 22 } }}
                      />
                    </TableCell>
                    <TableCell align="right">{activity.hours}</TableCell>
                    <TableCell sx={{ maxWidth: { xs: 140, sm: 220 }, minWidth: { xs: 100, sm: 140 }, width: { xs: 120, sm: 180 } }}>{activity.activity.description}</TableCell>
                    <TableCell align="center">
                      <EditActivityModal activity={activity} onActivityUpdated={refetch} />
                      <DeleteActivityButton activityId={activity._id || activity.id || ""} onDeleted={refetch} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <TablePagination
            rowsPerPageOptions={[10, 100, 1000, { label: "All", value: -1 }]}
            component="div"
            count={pagination.total}
            rowsPerPage={rowsPerPage === 10000 ? -1 : rowsPerPage}
            page={rowsPerPage === 10000 ? 0 : page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            sx={{
              '.MuiTablePagination-toolbar': {
                minHeight: { xs: 32, sm: 52 },
                px: { xs: 0.5, sm: 2 },
                justifyContent: { xs: 'flex-start', sm: 'flex-end' },
                display: 'flex',
              },
              '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
                fontSize: { xs: '0.72rem', sm: '0.95rem' },
              },
              '.MuiTablePagination-select': {
                fontSize: { xs: '0.72rem', sm: '0.95rem' },
              },
              '.MuiTablePagination-actions': {
                mx: { xs: 0, sm: 1 },
              },
            }}
          />
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default Activities;
