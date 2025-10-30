import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  TableSortLabel
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Delete as DeleteIcon,
  PhotoLibrary as PhotoLibraryIcon
} from '@mui/icons-material';
import { useCollageList, useCollageMutations } from '../hooks/useCollage';
import { Collage, CollageInput } from '../types/collage';
import { CollageCreateModal } from '../components/collage/CollageCreateModal';
import { CollageEditModal } from '../components/collage/CollageEditModal';
import ConfirmDialog from '../components/ConfirmDialog';

const CollageListPage: React.FC = () => {
  const collageListQuery = useCollageList();
  const { createCollage, deleteCollage, updateCollage } = useCollageMutations();
  const [deleting, setDeleting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedCollage, setSelectedCollage] = useState<Collage | null>(null);
  const [collageToDelete, setCollageToDelete] = useState<Collage | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Sorting state
  const [sortBy, setSortBy] = useState<'title' | 'createdAt' | 'updatedAt'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Sorting logic
  const sortedCollages = useMemo(() => {
    if (!collageListQuery.data) return [];
    
    return [...collageListQuery.data].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;
      
      switch (sortBy) {
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case 'updatedAt':
          aValue = new Date(a.updatedAt).getTime();
          bValue = new Date(b.updatedAt).getTime();
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [collageListQuery.data, sortBy, sortOrder]);

  // Date formatting function
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
  };

  // Sort handler
  const handleSort = (property: 'title' | 'createdAt' | 'updatedAt') => {
    const isAsc = sortBy === property && sortOrder === 'asc';
    setSortOrder(isAsc ? 'desc' : 'asc');
    setSortBy(property);
  };

  const handleOpenModal = () => setModalOpen(true);
  const handleCloseModal = () => setModalOpen(false);
  const handleCreateCollage = async (input: CollageInput) => {
    await createCollage(input);
    await collageListQuery.refetch();
  };
  const handleEditModalClose = () => {
    setEditModalOpen(false);
    setSelectedCollage(null);
  };
  const handleEditSave = async (input: CollageInput) => {
    if (selectedCollage) {
      await updateCollage(selectedCollage._id, input);
      await collageListQuery.refetch();
      handleEditModalClose();
    }
  };
  const handleDeleteConfirm = async () => {
    if (collageToDelete) {
      setDeleting(true);
      try {
        await deleteCollage(collageToDelete._id);
      } finally {
        setDeleteDialogOpen(false);
        setCollageToDelete(null);
        setDeleting(false);
        await collageListQuery.refetch();
      }
    }
  };
  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setCollageToDelete(null);
  };

  return (
    <Box sx={{ p: { xs: 1, sm: 3 }, maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>
          Collages
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="contained" color="primary" onClick={handleOpenModal} startIcon={<AddIcon />}>
          New Collage
        </Button>
      </Box>
      <CollageCreateModal open={modalOpen} onClose={handleCloseModal} onCreate={handleCreateCollage} />
      {collageListQuery.isPending ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
          <CircularProgress />
        </Box>
      ) : (sortedCollages.length || 0) === 0 ? (
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            px: 3
          }}
        >
          <PhotoLibraryIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No collages yet
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Create your first collage to get started
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenModal}>
            Create Collage
          </Button>
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 2 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                  <TableSortLabel
                    active={sortBy === 'title'}
                    direction={sortBy === 'title' ? sortOrder : 'asc'}
                    onClick={() => handleSort('title')}
                  >
                    Name
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.875rem' }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                  <TableSortLabel
                    active={sortBy === 'createdAt'}
                    direction={sortBy === 'createdAt' ? sortOrder : 'asc'}
                    onClick={() => handleSort('createdAt')}
                  >
                    Created At
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                  <TableSortLabel
                    active={sortBy === 'updatedAt'}
                    direction={sortBy === 'updatedAt' ? sortOrder : 'asc'}
                    onClick={() => handleSort('updatedAt')}
                  >
                    Updated At
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.875rem', width: 120 }} align="center">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedCollages.map((collage) => (
                <TableRow
                  key={collage._id}
                  sx={{
                    '&:hover': { bgcolor: 'grey.50' },
                    cursor: 'pointer'
                  }}
                  onClick={() => window.open(`/collage/${collage._id}?mode=edit`, '_blank')}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <PhotoLibraryIcon sx={{ color: 'primary.main' }} />
                      <Box>
                        <Typography variant="body1" fontWeight={500}>
                          {collage.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ID: {collage._id.slice(-8)}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {collage.config?.title?.subtitle || 'No description'}
                    </Typography>
                    {collage.config?.photos && (
                      <Chip
                        label={`${collage.config.photos.length} photos`}
                        size="small"
                        variant="outlined"
                        sx={{ mt: 0.5, fontSize: '0.7rem' }}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(collage.createdAt)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(collage.updatedAt)}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`/collage/${collage._id}?mode=view`, '_blank');
                        }}
                        sx={{ color: 'primary.main' }}
                        title="View collage"
                      >
                        <ViewIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCollage(collage);
                          setEditModalOpen(true);
                        }}
                        sx={{ color: 'success.main' }}
                        title="Edit collage"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCollageToDelete(collage);
                          setDeleteDialogOpen(true);
                        }}
                        sx={{ color: 'error.main' }}
                        title="Delete collage"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Edit Modal */}
      {selectedCollage && (
        <CollageEditModal
          open={editModalOpen}
          onClose={handleEditModalClose}
          onSave={handleEditSave}
          initialData={selectedCollage}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Delete Collage"
        message={collageToDelete ? `Are you sure you want to delete "${collageToDelete.title}"? This action cannot be undone.` : ''}
        confirmText="Delete Collage"
        cancelText="Cancel"
        variant="danger"
        loading={deleting}
      />
    </Box>
  );
};

export default CollageListPage;
