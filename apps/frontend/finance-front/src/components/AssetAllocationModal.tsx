import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Box, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import GroupSelector from './GroupSelector';
import { AssetClass } from '../types';

// Helper to get YYYY-MM-DD for input type=date
function getInputDate(date: string | Date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  // Adjust for timezone offset to get correct local date
  const tzOffset = d.getTimezoneOffset() * 60000;
  const localISO = new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
  return localISO;
}

const AssetAllocationModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onSubmit: (form: any) => void;
  form: any;
  setForm: (f: any) => void;
  title: string;
  assetClasses: AssetClass[];
}> = ({ open, onClose, onSubmit, form, setForm, title, assetClasses }) => (
  <Dialog 
    open={open} 
    onClose={onClose}
    slotProps={{
      paper: {
        elevation: 0,
        sx: {
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider'
        }
      }
    }}
  >
    <DialogTitle>{title}</DialogTitle>
    <DialogContent>
      <FormControl fullWidth margin="dense" required>
        <InputLabel>Asset Class</InputLabel>
        <Select
          value={form.assetClassId}
          onChange={(e) => setForm((f: any) => ({ ...f, assetClassId: e.target.value }))}
          label="Asset Class"
        >
          {assetClasses.map((assetClass) => (
            <MenuItem key={assetClass._id} value={assetClass._id}>
              {assetClass.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        margin="dense"
        label="Total Value"
        name="totalValue"
        type="number"
        fullWidth
        required
        value={form.totalValue}
        onChange={(e) => setForm((f: any) => ({ ...f, totalValue: e.target.value }))}
        slotProps={{ inputLabel: { shrink: true } }}
      />

      <TextField
        margin="dense"
        label="Gain"
        name="gain"
        type="number"
        fullWidth
        required
        value={form.gain}
        onChange={(e) => setForm((f: any) => ({ ...f, gain: e.target.value }))}
        slotProps={{ inputLabel: { shrink: true } }}
      />

      <TextField
        margin="dense"
        label="Date"
        name="date"
        type="date"
        fullWidth
        required
        value={getInputDate(form.date)}
        onChange={(e) => setForm((f: any) => ({ ...f, date: e.target.value }))}
        slotProps={{ inputLabel: { shrink: true } }}
      />

      <Box sx={{ mt: 2 }}>
        <GroupSelector
          value={form.groupId}
          onChange={(groupId) => setForm((f: any) => ({ ...f, groupId }))}
          label="Share with Group (optional)"
          includePersonal={false}
          includeNone={true}
        />
      </Box>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cancel</Button>
      <Button onClick={() => onSubmit(form)} variant="contained">
        {title.includes('Edit') ? 'Update' : 'Add'}
      </Button>
    </DialogActions>
  </Dialog>
);

export default AssetAllocationModal;