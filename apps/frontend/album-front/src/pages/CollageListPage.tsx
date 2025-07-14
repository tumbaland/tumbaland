import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, CircularProgress, IconButton, Menu, MenuItem } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useCollage } from '../hooks/useCollage';
import { Collage, CollageInput } from '../types/collage';
import { CollageCreateModal } from '../components/collage/CollageCreateModal';
import { CollageEditModal } from '../components/collage/CollageEditModal';
import ConfirmDialog from '../components/ConfirmDialog';

const CollageListPage: React.FC = () => {
  const { getCollages, createCollage, deleteCollage, updateCollage } = useCollage();
  const [collages, setCollages] = useState<Collage[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedCollage, setSelectedCollage] = useState<Collage | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuCollage, setMenuCollage] = useState<Collage | null>(null);
  const [collageToDelete, setCollageToDelete] = useState<Collage | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  // Remove duplicate useCollage hook call

  const fetchCollages = () => {
    setLoading(true);
    getCollages()
      .then((data) => setCollages(data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCollages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenModal = () => setModalOpen(true);
  const handleCloseModal = () => setModalOpen(false);
  const handleCreateCollage = async (input: CollageInput) => {
    await createCollage(input);
    fetchCollages();
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, collage: Collage) => {
    setMenuAnchorEl(event.currentTarget);
    setMenuCollage(collage);
  };
  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setMenuCollage(null);
  };
  const handleEditClick = () => {
    setSelectedCollage(menuCollage);
    setEditModalOpen(true);
    handleMenuClose();
  };
  const handleEditModalClose = () => {
    setEditModalOpen(false);
    setSelectedCollage(null);
  };
  const handleEditSave = async (input: CollageInput) => {
    if (selectedCollage) {
      await updateCollage(selectedCollage._id, input);
      fetchCollages();
      handleEditModalClose();
    }
  };
  const handleDeleteClick = () => {
    setCollageToDelete(menuCollage);
    setDeleteDialogOpen(true);
    handleMenuClose();
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
        fetchCollages();
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
      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
          <CircularProgress />
        </Box>
      ) : collages.length === 0 ? (
        <Typography variant="body1" color="text.secondary">
          No collages yet. Click "New Collage" to create your first one!
        </Typography>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: '1fr 1fr',
              md: '1fr 1fr 1fr',
              lg: '1fr 1fr 1fr 1fr'
            },
            gap: 3
          }}
        >
          {collages.map((collage) => (
            <Box key={collage._id}>
              <Box
                sx={{
                  position: 'relative',
                  bgcolor: 'background.paper',
                  borderRadius: 3,
                  boxShadow: 2,
                  p: 3,
                  minHeight: 120,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                  transition: 'box-shadow 0.2s, background 0.2s',
                  cursor: 'pointer',
                  '&:hover': {
                    boxShadow: 6,
                    bgcolor: 'grey.50'
                  }
                }}
                onClick={() => window.open(`/collage/${collage._id}?mode=edit`, '_blank')}
              >
                <IconButton
                  aria-label="more"
                  aria-controls="collage-menu"
                  aria-haspopup="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMenuOpen(e, collage);
                  }}
                  sx={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}
                >
                  <MoreVertIcon />
                </IconButton>
                <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5, maxWidth: '90%' }} noWrap>
                  {collage.title}
                </Typography>
                {collage.config?.title?.subtitle && (
                  <Typography variant="body2" color="text.secondary" sx={{ maxWidth: '90%' }} noWrap>
                    {collage.config.title.subtitle}
                  </Typography>
                )}
                <Typography variant="caption" color="text.disabled" sx={{ mt: 1 }}>
                  {collage._id}
                </Typography>
              </Box>
            </Box>
          ))}
          <Menu id="collage-menu" anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={handleMenuClose}>
            <MenuItem
              onClick={() => {
                if (menuCollage) window.open(`/collage/${menuCollage._id}?mode=view`, '_blank');
                handleMenuClose();
              }}
            >
              View
            </MenuItem>
            <MenuItem onClick={handleEditClick}>Edit</MenuItem>
            <MenuItem onClick={handleDeleteClick}>Delete</MenuItem>
          </Menu>
          {selectedCollage && (
            <CollageEditModal
              open={editModalOpen}
              onClose={handleEditModalClose}
              onSave={handleEditSave}
              initialData={selectedCollage}
            />
          )}
          <ConfirmDialog
            open={deleteDialogOpen}
            onClose={handleDeleteCancel}
            onConfirm={handleDeleteConfirm}
            title="Delete Collage"
            message={collageToDelete ? `Are you sure you want to delete "${collageToDelete.title}"?` : ''}
            confirmText="Delete Collage"
            cancelText="Cancel"
            variant="danger"
            loading={deleting}
          />
        </Box>
      )}
    </Box>
  );
};

export default CollageListPage;
