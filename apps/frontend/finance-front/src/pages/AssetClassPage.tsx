import React, { useEffect, useState } from 'react';
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
  Button,
  Alert,
  Snackbar
} from '@mui/material';
import { Add, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import ConfirmationModal from '../components/ConfirmationModal';
import { useTenantFilter } from '../components/tenant';
import AssetClassModal from '../components/AssetClassModal';
import {
  useAssetClasses,
  useCreateAssetClass,
  useUpdateAssetClass,
  useDeleteAssetClass
} from '../hooks/useAsset';
import { AssetClass } from '../types';

const AssetClassPage: React.FC = () => {
  const tenantGroupId = useTenantFilter(); // Get groupId from tenant context

  // React Query hooks
  const { data: assetClasses = [], isLoading: loading, error } = useAssetClasses(tenantGroupId);
  const createMutation = useCreateAssetClass();
  const updateMutation = useUpdateAssetClass();
  const deleteMutation = useDeleteAssetClass();

  // UI state
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    color: '#667eea',
    groupId: undefined as string | undefined
  });
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    color: '#667eea',
    groupId: undefined as string | undefined
  });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Success/Error notifications
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  // Handle mutation success/error
  useEffect(() => {
    if (createMutation.isSuccess) {
      setSnackbar({ open: true, message: 'Asset class created successfully', severity: 'success' });
      createMutation.reset();
    }
    if (createMutation.isError) {
      setSnackbar({ open: true, message: 'Failed to create asset class', severity: 'error' });
      createMutation.reset();
    }
  }, [createMutation.isSuccess, createMutation.isError]);

  useEffect(() => {
    if (updateMutation.isSuccess) {
      setSnackbar({ open: true, message: 'Asset class updated successfully', severity: 'success' });
      updateMutation.reset();
    }
    if (updateMutation.isError) {
      setSnackbar({ open: true, message: 'Failed to update asset class', severity: 'error' });
      updateMutation.reset();
    }
  }, [updateMutation.isSuccess, updateMutation.isError]);

  useEffect(() => {
    if (deleteMutation.isSuccess) {
      setSnackbar({ open: true, message: 'Asset class deleted successfully', severity: 'success' });
      deleteMutation.reset();
    }
    if (deleteMutation.isError) {
      setSnackbar({ open: true, message: 'Failed to delete asset class', severity: 'error' });
      deleteMutation.reset();
    }
  }, [deleteMutation.isSuccess, deleteMutation.isError]);

  const handleCreateOpen = () => {
    setCreateForm({
      name: '',
      description: '',
      color: '#667eea',
      groupId: tenantGroupId // Prefill with active tenant
    });
    setCreateOpen(true);
  };
  const handleCreateClose = () => setCreateOpen(false);
  const handleEditOpen = (assetClass: AssetClass) => {
    setEditId(assetClass._id);
    setEditForm({
      name: assetClass.name,
      description: assetClass.description || '',
      color: assetClass.color || '#667eea',
      groupId: assetClass.groupId
    });
    setEditOpen(true);
  };
  const handleEditClose = () => setEditOpen(false);

  const handleCreateSubmit = async (form: any) => {
    const payload = {
      ...form,
      groupId: tenantGroupId // Use tenant context for groupId
    };
    await createMutation.mutateAsync(payload);
    setCreateOpen(false);
  };
  const handleEditSubmit = async (form: any) => {
    if (!editId) return;
    const payload = {
      name: form.name,
      description: form.description,
      color: form.color
    };
    await updateMutation.mutateAsync({ id: editId, data: payload });
    setEditOpen(false);
  };

  // Replace handleDelete with confirmation logic
  const handleDeleteClick = (id: string) => {
    setDeleteId(id);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (deleteId) {
      await deleteMutation.mutateAsync(deleteId);
      setDeleteConfirmOpen(false);
      setDeleteId(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setDeleteId(null);
  };

  return (
    <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: { xs: 2, sm: 2.5, md: 3 },
        flexWrap: 'wrap',
        gap: { xs: 1, sm: 1.5, md: 2 },
        minHeight: { xs: 'auto', sm: 56, md: 64 }
      }}>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2.125rem', lg: '2.25rem' },
            flex: { xs: '1 1 100%', sm: '0 1 auto' },
            minWidth: 0,
            mr: { xs: 0, sm: 2 }
          }}
        >
          Asset Classes
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          sx={{
            bgcolor: 'primary.main',
            fontSize: { xs: '0.8125rem', sm: '0.875rem', md: '0.9375rem' },
            px: { xs: 1.5, sm: 2, md: 2.5 },
            flex: { xs: '1 1 100%', sm: '0 0 auto' },
            minWidth: { xs: '100%', sm: 'auto' },
            whiteSpace: 'nowrap'
          }}
          onClick={handleCreateOpen}
        >
          Add Asset Class
        </Button>
      </Box>

      <AssetClassModal
        open={createOpen}
        onClose={handleCreateClose}
        onSubmit={handleCreateSubmit}
        form={createForm}
        setForm={setCreateForm}
        title="Add Asset Class"
      />
      <AssetClassModal
        open={editOpen}
        onClose={handleEditClose}
        onSubmit={handleEditSubmit}
        form={editForm}
        setForm={setEditForm}
        title="Edit Asset Class"
      />

      <Paper elevation={0} sx={{ width: '100%', borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        <TableContainer
          sx={{
            overflowX: 'auto',
            maxWidth: '100%',
            '&::-webkit-scrollbar': {
              height: '6px',
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: 'rgba(0,0,0,0.1)',
              borderRadius: '3px',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(0,0,0,0.3)',
              borderRadius: '3px',
              '&:hover': {
                backgroundColor: 'rgba(0,0,0,0.5)',
              },
            },
          }}
        >
          <Table
            stickyHeader
            size="small"
            sx={{
              minWidth: { xs: 320, sm: 450, md: 550, lg: 650 },
              width: '100%',
              fontSize: { xs: '0.68rem', sm: '0.875rem', md: '0.9375rem', lg: '1rem' },
              '& th, & td': {
                px: { xs: 0.125, sm: 0.5, md: 1, lg: 1.5 },
                py: { xs: 0.375, sm: 0.75, md: 0.875, lg: 1 },
                fontSize: { xs: '0.68rem', sm: '0.875rem', md: '0.9375rem', lg: '1rem' },
                whiteSpace: { xs: 'nowrap', sm: 'normal' },
                maxWidth: { xs: 60, sm: 'none' },
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: { xs: 80, sm: 100, md: 120 }, width: { xs: 80, sm: 100, md: 120 } }}>
                  <span style={{ fontSize: '0.78em' }}>Name</span>
                </TableCell>
                <TableCell sx={{ minWidth: { xs: 70, sm: 80, md: 90 }, width: { xs: 70, sm: 80, md: 90 } }}>
                  <span style={{ fontSize: '0.78em' }}>Color</span>
                </TableCell>
                <TableCell sx={{ minWidth: { xs: 120, sm: 180, md: 220 }, width: { xs: 120, sm: 180, md: 220 } }}>
                  <span style={{ fontSize: '0.78em' }}>Description</span>
                </TableCell>
                <TableCell align="center" sx={{ minWidth: { xs: 60, sm: 70, md: 80 }, width: { xs: 60, sm: 70, md: 80 } }}>
                  <span style={{ fontSize: '0.78em' }}>Actions</span>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4}>Loading...</TableCell>
                </TableRow>
              ) : assetClasses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>No asset classes found.</TableCell>
                </TableRow>
              ) : (
                assetClasses.map((assetClass: AssetClass) => (
                  <TableRow key={assetClass._id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell sx={{ width: { xs: 80, sm: 100, md: 120 } }}>{assetClass.name}</TableCell>
                    <TableCell sx={{ width: { xs: 70, sm: 80, md: 90 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 } }}>
                        <Box
                          sx={{
                            width: { xs: 16, sm: 20 },
                            height: { xs: 16, sm: 20 },
                            borderRadius: '50%',
                            backgroundColor: assetClass.color || '#667eea',
                            border: '1px solid #ccc'
                          }}
                        />
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: { xs: '0.6875rem', sm: '0.75rem' } }}>
                          {assetClass.color || '#667eea'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ width: { xs: 120, sm: 180, md: 220 } }}>{assetClass.description || '-'}</TableCell>
                    <TableCell align="center" sx={{ width: { xs: 60, sm: 70, md: 80 } }}>
                      <Box sx={{ display: 'flex', gap: { xs: 0.125, sm: 0.5 }, justifyContent: 'center' }}>
                        <Button color="primary" size="small" onClick={() => handleEditOpen(assetClass)} sx={{ minWidth: 'auto', p: { xs: 0.25, sm: 0.5 } }}>
                          <EditIcon fontSize="small" />
                        </Button>
                        <Button color="error" size="small" onClick={() => handleDeleteClick(assetClass._id)} sx={{ minWidth: 'auto', p: { xs: 0.25, sm: 0.5 } }}>
                          <DeleteIcon fontSize="small" />
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      <ConfirmationModal
        open={deleteConfirmOpen}
        title="Delete Asset Class"
        message="Are you sure you want to delete this asset class? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        severity="error"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />

      {/* Error display */}
      {error && (
        <Snackbar
          open={true}
          autoHideDuration={6000}
          onClose={() => {}} // Error persists until page reload
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert severity="error" sx={{ width: '100%' }}>
            Failed to load asset classes. Please try refreshing the page.
          </Alert>
        </Snackbar>
      )}

      {/* Success/Error notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AssetClassPage;