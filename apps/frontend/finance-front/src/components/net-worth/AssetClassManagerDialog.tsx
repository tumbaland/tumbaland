import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Typography
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import AssetClassModal, { AssetClassFormValues } from '../AssetClassModal';
import ConfirmationModal from '../ConfirmationModal';
import { AssetClass } from '../../types';
import {
  useCreateAssetClass,
  useUpdateAssetClass,
  useDeleteAssetClass
} from '../../hooks/useAssetClasses';

interface AssetClassManagerDialogProps {
  open: boolean;
  onClose: () => void;
  assetClasses: AssetClass[];
  tenantGroupId?: string;
  /** True when a class is still referenced by snapshot entries */
  isClassInUse: (id: string) => boolean;
}

const emptyForm: AssetClassFormValues = { name: '', description: '', color: '#3b82f6', groupId: undefined };

/** Add/rename/recolor asset classes without leaving the Net Worth page. */
const AssetClassManagerDialog: React.FC<AssetClassManagerDialogProps> = ({
  open,
  onClose,
  assetClasses,
  tenantGroupId,
  isClassInUse
}) => {
  const createMutation = useCreateAssetClass();
  const updateMutation = useUpdateAssetClass();
  const deleteMutation = useDeleteAssetClass();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AssetClassFormValues>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<AssetClass | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, groupId: tenantGroupId });
    setEditorOpen(true);
  };

  const openEdit = (ac: AssetClass) => {
    setEditingId(ac._id);
    setForm({ name: ac.name, description: ac.description || '', color: ac.color || '#3b82f6', groupId: ac.groupId });
    setEditorOpen(true);
  };

  const handleSubmit = async (f: AssetClassFormValues) => {
    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, data: { name: f.name, description: f.description, color: f.color } });
    } else {
      await createMutation.mutateAsync({ ...f, groupId: tenantGroupId });
    }
    setEditorOpen(false);
  };

  const handleDelete = async () => {
    if (deleteTarget) {
      await deleteMutation.mutateAsync(deleteTarget._id);
      setDeleteTarget(null);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
        <DialogTitle>Asset classes</DialogTitle>
        <DialogContent>
          <List dense>
            {assetClasses.map((ac) => (
              <ListItem
                key={ac._id}
                secondaryAction={
                  <Box>
                    <IconButton size="small" onClick={() => openEdit(ac)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => setDeleteTarget(ac)}
                      disabled={isClassInUse(ac._id)}
                      title={isClassInUse(ac._id) ? 'Used in check-ins — remove those entries first' : 'Delete'}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                }
              >
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: ac.color || '#667eea', mr: 1.5 }} />
                <ListItemText primary={ac.name} secondary={ac.description} />
              </ListItem>
            ))}
            {assetClasses.length === 0 && (
              <Typography variant="body2" sx={{ color: 'text.secondary', py: 2, textAlign: 'center' }}>
                No asset classes yet — add the categories you want to track (e.g. Cash, Investments, Real estate).
              </Typography>
            )}
          </List>
        </DialogContent>
        <DialogActions>
          <Button startIcon={<AddIcon />} onClick={openCreate}>Add class</Button>
          <Button onClick={onClose} variant="contained">Done</Button>
        </DialogActions>
      </Dialog>

      <AssetClassModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSubmit={handleSubmit}
        form={form}
        setForm={setForm}
        title={editingId ? 'Edit Asset Class' : 'Add Asset Class'}
      />

      <ConfirmationModal
        open={!!deleteTarget}
        title="Delete asset class"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmText="Delete"
        severity="error"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
};

export default AssetClassManagerDialog;
