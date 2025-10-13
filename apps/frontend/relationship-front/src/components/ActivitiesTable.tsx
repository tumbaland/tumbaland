import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableRow, Chip, TableSortLabel, Typography, Box, Select, MenuItem } from '@mui/material';
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
  return (
    <>
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
            textOverflow: 'ellipsis'
          }
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell sx={{ minWidth: 60 }}>
              <TableSortLabel
                active={sortBy === 'date'}
                direction={sortBy === 'date' ? sortOrder : 'asc'}
                onClick={() => handleSort('date')}
              >
                <span style={{ fontSize: '0.78em' }}>Date</span>
              </TableSortLabel>
            </TableCell>
            <TableCell sx={{ minWidth: 50, maxWidth: 70, width: 60 }}>
              <TableSortLabel
                active={sortBy === 'activity'}
                direction={sortBy === 'activity' ? sortOrder : 'asc'}
                onClick={() => handleSort('activity')}
              >
                <span style={{ fontSize: '0.78em' }}>Activity</span>
              </TableSortLabel>
            </TableCell>
            <TableCell align="right" sx={{ minWidth: 60 }}>
              <TableSortLabel
                active={sortBy === 'hours'}
                direction={sortBy === 'hours' ? sortOrder : 'asc'}
                onClick={() => handleSort('hours')}
              >
                <span style={{ fontSize: '0.78em' }}>Duration</span>
              </TableSortLabel>
            </TableCell>
            <TableCell sx={{ minWidth: 140, maxWidth: 220, width: 180 }}>
              <TableSortLabel
                active={sortBy === 'description'}
                direction={sortBy === 'description' ? sortOrder : 'asc'}
                onClick={() => handleSort('description')}
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
              <TableRow key={activity._id || activity.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                <TableCell>{formatDate(activity.date)}</TableCell>
                <TableCell>
                  <Chip
                    label={activity.activity.typeId?.name || 'Unknown Type'}
                    sx={{
                      fontSize: { xs: '0.62rem', sm: '0.80rem' },
                      height: { xs: 18, sm: 22 },
                      backgroundColor: activity.activity.typeId?.color || '#9e9e9e',
                      color: 'white'
                    }}
                    size="small"
                  />
                </TableCell>
                <TableCell align="right">{activity.hours || '-'}</TableCell>
                <TableCell
                  sx={{
                    maxWidth: { xs: 140, sm: 220 },
                    minWidth: { xs: 100, sm: 140 },
                    width: { xs: 120, sm: 180 }
                  }}
                >
                  {activity.activity.description}
                </TableCell>
                <TableCell align="center">
                  <EditActivityModal activity={activity} onActivityUpdated={refetch} />
                  <DeleteActivityButton activityId={activity._id || activity.id || ''} onDeleted={refetch} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      
      {/* Simple page size selector */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', p: 2, gap: 2 }}>
        <Typography variant="body2" sx={{ fontSize: { xs: '0.72rem', sm: '0.95rem' } }}>
          Show:
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
          sx={{ fontSize: { xs: '0.72rem', sm: '0.95rem' }, minWidth: 80 }}
        >
          <MenuItem value={10}>10</MenuItem>
          <MenuItem value={25}>25</MenuItem>
          <MenuItem value={50}>50</MenuItem>
          <MenuItem value={100}>100</MenuItem>
          <MenuItem value={-1}>All</MenuItem>
        </Select>
      </Box>
    </>
  );
};

export default ActivitiesTable;
