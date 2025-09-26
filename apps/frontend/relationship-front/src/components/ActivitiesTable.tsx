import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableRow, Chip, TableSortLabel, Typography } from '@mui/material';
import EditActivityModal from '../components/EditActivityModal';
import DeleteActivityButton from '../components/DeleteActivityButton';

import { TablePagination } from '@mui/material';

interface ActivitiesTableProps {
  activities: any[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  handleSort: (field: string) => void;
  formatDate: (date: Date | string) => string;
  refetch: () => void;
  pagination: { total: number };
  rowsPerPage: number;
  page: number;
  onPageChange: (_event: unknown, newPage: number) => void;
  onRowsPerPageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const ActivitiesTable: React.FC<ActivitiesTableProps> = ({
  activities,
  sortBy,
  sortOrder,
  handleSort,
  formatDate,
  refetch,
  pagination,
  rowsPerPage,
  page,
  onPageChange,
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
      <TablePagination
        rowsPerPageOptions={[10, 100, 1000, { label: 'All', value: -1 }]}
        component="div"
        count={pagination.total}
        rowsPerPage={rowsPerPage === 10000 ? -1 : rowsPerPage}
        page={rowsPerPage === 10000 ? 0 : page}
        onPageChange={onPageChange}
        onRowsPerPageChange={onRowsPerPageChange}
        sx={{
          '.MuiTablePagination-toolbar': {
            minHeight: { xs: 32, sm: 52 },
            px: { xs: 0.5, sm: 2 },
            justifyContent: { xs: 'flex-start', sm: 'flex-end' },
            display: 'flex'
          },
          '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
            fontSize: { xs: '0.72rem', sm: '0.95rem' }
          },
          '.MuiTablePagination-select': {
            fontSize: { xs: '0.72rem', sm: '0.95rem' }
          },
          '.MuiTablePagination-actions': {
            mx: { xs: 0, sm: 1 }
          }
        }}
      />
    </>
  );
};

export default ActivitiesTable;
