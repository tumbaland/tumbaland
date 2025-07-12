import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActionArea,
  CardMedia,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem
} from '@mui/material';
import GridOnIcon from '@mui/icons-material/GridOn';
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
              <Card key={`card-${collage._id}`} sx={{ position: 'relative' }}>
                <IconButton
                  aria-label="more"
                  aria-controls="collage-menu"
                  aria-haspopup="true"
                  onClick={(e) => handleMenuOpen(e, collage)}
                  sx={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}
                >
                  <MoreVertIcon />
                </IconButton>
                <CardActionArea target="_blank" href={`/collage/${collage._id}`}>
                  {collage.config?.photos?.[0]?.filename ? (
                    <CardMedia
                      component="img"
                      height="140"
                      image={collage.config.photos[0].filename}
                      alt={collage.title}
                    />
                  ) : (
                    <Box
                      sx={{
                        height: 140,
                        bgcolor: 'grey.100',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <GridOnIcon color="disabled" sx={{ fontSize: 48 }} />
                    </Box>
                  )}
                  <CardContent>
                    <Typography variant="h6" noWrap>
                      {collage.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {collage.config?.title?.subtitle ?? ''}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Box>
          ))}
      <Menu
        id="collage-menu"
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
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
