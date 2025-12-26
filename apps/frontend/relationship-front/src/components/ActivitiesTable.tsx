import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  TableSortLabel,
  Typography,
  Box,
  Select,
  MenuItem,
  Paper,
  useTheme,
  alpha
} from '@mui/material';
import { Circle as CircleIcon } from '@mui/icons-material';
import EditActivityModal from '../components/EditActivityModal';
import DeleteActivityButton from '../components/DeleteActivityButton';

interface ActivitiesTableProps {
  activities: any[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  handleSort: (field: string) => void;
  formatDate: (date: Date | string) => string;
  refetch: () => void;
  rowsPerPage: number;
  onRowsPerPageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const ActivitiesTable: React.FC<ActivitiesTableProps> = ({
  activities,
  sortBy,
  sortOrder,
  handleSort,
  formatDate,
  refetch,
  rowsPerPage,
  onRowsPerPageChange
}) => {
  const theme = useTheme();

  return (
    <Box>
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          overflowX: 'auto',
          width: '100%'
        }}
      >
        <Table
          stickyHeader
          sx={{ minWidth: { xs: 300, sm: 600 } }}
          aria-label="activities table"
        >
          <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap', px: { xs: 1, sm: 2 } }}>
                <TableSortLabel
                  active={sortBy === 'date'}
                  direction={sortBy === 'date' ? sortOrder : 'asc'}
                  onClick={() => handleSort('date')}
                >
                  Date
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap', px: { xs: 1, sm: 2 } }}>
                <TableSortLabel
                  active={sortBy === 'activity'}
                  direction={sortBy === 'activity' ? sortOrder : 'asc'}
                  onClick={() => handleSort('activity')}
                >
                  Activity
                </TableSortLabel>
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, whiteSpace: 'nowrap', px: { xs: 1, sm: 2 } }}>
                <TableSortLabel
                  active={sortBy === 'hours'}
                  direction={sortBy === 'hours' ? sortOrder : 'asc'}
                  onClick={() => handleSort('hours')}
                >
                  Duration
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap', display: { xs: 'none', md: 'table-cell' }, px: { xs: 1, sm: 2 } }}>
                <TableSortLabel
                  active={sortBy === 'description'}
                  direction={sortBy === 'description' ? sortOrder : 'asc'}
                  onClick={() => handleSort('description')}
                >
                  Description
                </TableSortLabel>
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 600, whiteSpace: 'nowrap', px: { xs: 1, sm: 2 } }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!activities || activities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                  <Typography variant="body1" color="text.secondary">
                    No activities yet. Click "Add Activity" to get started!
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              activities.map((activity) => (
                <TableRow 
                  key={activity._id || activity.id} 
                  hover
                  sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                >
                  <TableCell sx={{ whiteSpace: 'nowrap', px: { xs: 1, sm: 2 } }}>
                    {formatDate(activity.date)}
                  </TableCell>
                  <TableCell sx={{ px: { xs: 1, sm: 2 } }}>
                    <Chip
                      icon={
                        <CircleIcon 
                          style={{ 
                            fill: activity.activity.typeId?.color || '#9e9e9e', 
                            fontSize: 12 
                          }} 
                        />
                      }
                      label={activity.activity.typeId?.name || 'Unknown Type'}
                      size="small"
                      variant="outlined"
                      sx={{
                        borderColor: alpha(activity.activity.typeId?.color || '#9e9e9e', 0.5),
                        bgcolor: alpha(activity.activity.typeId?.color || '#9e9e9e', 0.05),
                        fontFamily: 'monospace',
                        fontWeight: 500,
                        maxWidth: { xs: 100, sm: 'none' }
                      }}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ px: { xs: 1, sm: 2 } }}>
                    {activity.hours ? `${activity.hours}h` : '-'}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 300, display: { xs: 'none', md: 'table-cell' }, px: { xs: 1, sm: 2 } }}>
                    <Typography variant="body2" noWrap title={activity.activity.description}>
                      {activity.activity.description || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center" sx={{ px: { xs: 1, sm: 2 } }}>
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                      <EditActivityModal activity={activity} onActivityUpdated={refetch} />
                      <DeleteActivityButton activityId={activity._id || activity.id || ''} onDeleted={refetch} />
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      
      {/* Pagination */}
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          alignItems: 'center', 
          pt: 2, 
          gap: 2 
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Rows per page:
        </Typography>
        <Select
          value={rowsPerPage === 10000 ? -1 : rowsPerPage}
          onChange={(event) => {
            const syntheticEvent = {
              target: { value: event.target.value.toString() }
            } as React.ChangeEvent<HTMLInputElement>;
            onRowsPerPageChange(syntheticEvent);
          }}
          size="small"
          variant="outlined"
          sx={{ 
            minWidth: 80,
            height: 32,
            fontSize: '0.875rem'
          }}
        >
          <MenuItem value={10}>10</MenuItem>
          <MenuItem value={25}>25</MenuItem>
          <MenuItem value={50}>50</MenuItem>
          <MenuItem value={100}>100</MenuItem>
          <MenuItem value={-1}>All</MenuItem>
        </Select>
      </Box>
    </Box>
  );
};

export default ActivitiesTable;
