import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Typography
} from '@mui/material';
import { GroupMember } from '../../types';

interface ChangeRoleDialogProps {
  open: boolean;
  onClose: () => void;
  member: GroupMember | null;
  onSave: (email: string, newRole: 'admin' | 'member') => Promise<void>;
}

const ChangeRoleDialog: React.FC<ChangeRoleDialogProps> = ({
  open,
  onClose,
  member,
  onSave
}) => {
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (member) {
      setRole(member.role === 'admin' ? 'admin' : 'member');
    }
  }, [member]);

  const handleSave = async () => {
    if (!member) return;
    try {
      setLoading(true);
      await onSave(member.email, role);
      onClose();
    } catch (error) {
      console.error('Failed to update role', error);
    } finally {
      setLoading(false);
    }
  };

  if (!member) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Change Role</DialogTitle>
      <DialogContent>
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            mb: 2
          }}>
          Select a new role for <strong>{member.email}</strong>.
        </Typography>
        <FormControl component="fieldset">
          <RadioGroup
            value={role}
            onChange={(e) => setRole(e.target.value as 'admin' | 'member')}
          >
            <FormControlLabel value="admin" control={<Radio />} label="Admin" />
            <FormControlLabel value="member" control={<Radio />} label="Member" />
          </RadioGroup>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={loading}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ChangeRoleDialog;
