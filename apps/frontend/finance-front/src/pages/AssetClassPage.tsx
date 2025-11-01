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
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Asset Classes
        </Typography>
        <Button variant="contained" startIcon={<Add />} sx={{ bgcolor: 'primary.main' }} onClick={handleCreateOpen}>
          Add Asset Class
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }} variant="outlined">
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 2 }}>
          {/* Show current tenant context */}
          {tenantGroupId ? (
            <Typography variant="body2" color="primary">
              Showing asset classes for selected group
            </Typography>
          ) : (
            <Typography variant="body2" color="primary">
              Showing personal asset classes
            </Typography>
          )}
        </Box>
      </Paper>

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

      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer>
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
                <TableCell sx={{ minWidth: 120 }}>
                  <span style={{ fontSize: '0.78em' }}>Name</span>
                </TableCell>
                <TableCell sx={{ minWidth: 80 }}>
                  <span style={{ fontSize: '0.78em' }}>Color</span>
                </TableCell>
                <TableCell sx={{ minWidth: 200 }}>
                  <span style={{ fontSize: '0.78em' }}>Description</span>
                </TableCell>
                <TableCell align="center" sx={{ minWidth: 60 }}>
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
                    <TableCell>{assetClass.name}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            backgroundColor: assetClass.color || '#667eea',
                            border: '1px solid #ccc'
                          }}
                        />
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {assetClass.color || '#667eea'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{assetClass.description || '-'}</TableCell>
                    <TableCell align="center">
                      <Button color="primary" size="small" onClick={() => handleEditOpen(assetClass)}>
                        <EditIcon />
                      </Button>
                      <Button color="error" size="small" onClick={() => handleDeleteClick(assetClass._id)}>
                        <DeleteIcon />
                      </Button>
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