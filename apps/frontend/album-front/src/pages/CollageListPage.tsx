import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { logger } from '@tumbaland/frontend-core';
import {
  Box,
  Container,
  Typography,
  Button,
  CircularProgress,
  TextField,
  InputAdornment,
  Alert,
  LinearProgress
} from '@mui/material';
import { Add as AddIcon, Search as SearchIcon, PhotoLibrary as PhotoLibraryIcon } from '@mui/icons-material';
import { useCollageList, useCollageMutations } from '../hooks/useCollage';
import { Collage, CollageInput } from '../types/collage';
import { CollageCreateModal } from '../components/collage/CollageCreateModal';
import { CollageEditModal } from '../components/collage/CollageEditModal';
import ConfirmDialog from '../components/ConfirmDialog';
import CollageCard from '../components/collage/CollageCard';
import { gradient } from '@tumbaland/components';
import { appPath } from '../appBase';

const CollageListPage: React.FC = () => {
  const navigate = useNavigate();
  const collageListQuery = useCollageList();
  const { createCollage, deleteCollage, updateCollage } = useCollageMutations();
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedCollage, setSelectedCollage] = useState<Collage | null>(null);
  const [collageToDelete, setCollageToDelete] = useState<Collage | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Filter and Sort logic
  const filteredCollages = useMemo(() => {
    if (!collageListQuery.data) return [];

    let result = [...collageListQuery.data];

    // Filter by search term
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(
        (collage) =>
          collage.title.toLowerCase().includes(lowerTerm) ||
          collage.config?.title?.subtitle?.toLowerCase().includes(lowerTerm)
      );
    }

    // Sort by updatedAt desc
    return result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [collageListQuery.data, searchTerm]);

  const handleOpenModal = () => setModalOpen(true);
  const handleCloseModal = () => setModalOpen(false);

  const handleCreateCollage = async (input: CollageInput) => {
    const created = await createCollage(input);
    // jump straight into the editor for the new collage
    navigate(appPath(`/collages/${created._id}`));
  };

  const handleViewCollage = (collage: Collage) => {
    navigate(appPath(`/collages/${collage._id}?mode=view`));
  };

  const handleEditCollage = (collage: Collage) => {
    navigate(appPath(`/collages/${collage._id}`));
  };

  const handleEditDetails = (collage: Collage) => {
    setSelectedCollage(collage);
    setEditModalOpen(true);
  };

  const handleDeleteClick = (collage: Collage) => {
    setCollageToDelete(collage);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!collageToDelete) return;

    setDeleting(true);
    try {
      await deleteCollage(collageToDelete._id);
      setDeleteDialogOpen(false);
      setCollageToDelete(null);
    } catch (error) {
      logger.error('Failed to delete collage', error);
    } finally {
      setDeleting(false);
    }
  };

  if (collageListQuery.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 1, sm: 4 }, px: { xs: 0, sm: 3 } }}>
      {/* Title and action on one line, search directly under it. This used to
          be a centred heading, a full-width button and a padded search card,
          which on a phone left the first collage below the fold. The header
          button stays on every screen size, so no floating button repeats it. */}
      <Box
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: { xs: 1.5, sm: 3 } }}
      >
        <Typography
          variant="h5"
          component="h1"
          sx={{ fontWeight: 700, color: '#1e293b', fontSize: { xs: '1.35rem', sm: '1.75rem' } }}
        >
          Collages
        </Typography>
        <Button
          variant="contained"
          size="small"
          disableElevation
          startIcon={<AddIcon />}
          onClick={handleOpenModal}
          sx={{
            flexShrink: 0,
            whiteSpace: 'nowrap',
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            background: gradient.brand
          }}
        >
          Create collage
        </Button>
      </Box>
      <TextField
        size="small"
        fullWidth
        placeholder="Search collages..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" fontSize="small" />
              </InputAdornment>
            ),
            sx: { borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, 0.75)' }
          }
        }}
        sx={{ mb: { xs: 1.5, sm: 3 }, maxWidth: { sm: 400 } }}
      />
      {collageListQuery.isFetching && !collageListQuery.isLoading && <LinearProgress sx={{ mb: 2 }} />}
      {collageListQuery.error && (
        <Alert severity="error" sx={{ mb: { xs: 2, sm: 4 } }}>
          Failed to load collages
        </Alert>
      )}
      {filteredCollages.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center',
            py: { xs: 4, sm: 8 }
          }}
        >
          <PhotoLibraryIcon sx={{ fontSize: { xs: 48, sm: 64 }, color: 'grey.400', mb: 2 }} />
          <Typography
            variant="h6"
            gutterBottom
            sx={{
              color: 'text.secondary'
            }}
          >
            {searchTerm ? 'No collages found' : 'No collages yet'}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              mb: 3
            }}
          >
            {searchTerm ? 'Try adjusting your search terms' : 'Create your first collage to get started'}
          </Typography>
          {!searchTerm && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenModal}>
              Create Collage
            </Button>
          )}
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              sm: 'repeat(3, minmax(0, 1fr))',
              md: 'repeat(4, minmax(0, 1fr))',
              lg: 'repeat(5, minmax(0, 1fr))',
              xl: 'repeat(6, minmax(0, 1fr))'
            },
            gap: { xs: 1.5, sm: 2, md: 3 }
          }}
        >
          {filteredCollages.map((collage) => (
            <CollageCard
              key={collage._id}
              collage={collage}
              onView={handleViewCollage}
              onEdit={handleEditCollage}
              onEditDetails={handleEditDetails}
              onDelete={handleDeleteClick}
            />
          ))}
        </Box>
      )}
      {/* Create Modal */}
      <CollageCreateModal open={modalOpen} onClose={handleCloseModal} onCreate={handleCreateCollage} />
      {/* Edit details (title / subtitle / source albums) */}
      {selectedCollage && (
        <CollageEditModal
          open={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setSelectedCollage(null);
          }}
          initialData={selectedCollage}
          onSave={async (data) => {
            if (selectedCollage) {
              await updateCollage(selectedCollage._id, data);
              setEditModalOpen(false);
              setSelectedCollage(null);
            }
          }}
        />
      )}
      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Collage"
        message={`Are you sure you want to delete "${collageToDelete?.title}"?`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={deleting}
      />
    </Container>
  );
};

export default CollageListPage;
