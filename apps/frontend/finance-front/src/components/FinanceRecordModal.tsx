import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Box } from '@mui/material';
import GroupSelector from './GroupSelector';

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

const FinanceRecordModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onSubmit: (form: any) => void;
  form: any;
  setForm: (f: any) => void;
  title: string;
}> = ({ open, onClose, onSubmit, form, setForm, title }) => (
  <Dialog open={open} onClose={onClose}>
    <DialogTitle>{title}</DialogTitle>
    <DialogContent>
      <TextField
        margin="dense"
        label="Date"
        name="date"
        type="date"
        fullWidth
        value={getInputDate(form.date)}
        onChange={(e) => setForm((f: any) => ({ ...f, date: e.target.value }))}
        InputLabelProps={{ shrink: true }}
      />
      <TextField
        margin="dense"
        label="2nd Pillar"
        name="secondPillar"
        type="number"
        fullWidth
        value={form.secondPillar}
        onChange={(e) => setForm((f: any) => ({ ...f, secondPillar: e.target.value }))}
      />
      <TextField
        margin="dense"
        label="2nd Pillar Gain"
        name="secondPillarGain"
        type="number"
        fullWidth
        value={form.secondPillarGain}
        onChange={(e) => setForm((f: any) => ({ ...f, secondPillarGain: e.target.value }))}
      />
      <TextField
        margin="dense"
        label="3rd Pillar"
        name="thirdPillar"
        type="number"
        fullWidth
        value={form.thirdPillar}
        onChange={(e) => setForm((f: any) => ({ ...f, thirdPillar: e.target.value }))}
      />
      <TextField
        margin="dense"
        label="3rd Pillar Gain"
        name="thirdPillarGain"
        type="number"
        fullWidth
        value={form.thirdPillarGain}
        onChange={(e) => setForm((f: any) => ({ ...f, thirdPillarGain: e.target.value }))}
      />
      <TextField
        margin="dense"
        label="ETF Portfolio"
        name="etfPortfolio"
        type="number"
        fullWidth
        value={form.etfPortfolio}
        onChange={(e) => setForm((f: any) => ({ ...f, etfPortfolio: e.target.value }))}
      />
      <TextField
        margin="dense"
        label="ETF Gain"
        name="etfGain"
        type="number"
        fullWidth
        value={form.etfGain}
        onChange={(e) => setForm((f: any) => ({ ...f, etfGain: e.target.value }))}
      />
      <TextField
        margin="dense"
        label="Cash"
        name="cash"
        type="number"
        fullWidth
        value={form.cash}
        onChange={(e) => setForm((f: any) => ({ ...f, cash: e.target.value }))}
      />
      <TextField
        margin="dense"
        label="Gold"
        name="gold"
        type="number"
        fullWidth
        value={form.gold}
        onChange={(e) => setForm((f: any) => ({ ...f, gold: e.target.value }))}
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

export default FinanceRecordModal;
