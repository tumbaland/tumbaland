import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  AlertTitle,
  LinearProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableRow
} from '@mui/material';
import { UploadFile, CheckCircle } from '@mui/icons-material';
import { useImportStatement } from '../../hooks/useCashflow';
import { ImportResult } from '../../services/cashflowService';
import { formatCurrency } from '../../utils/numberUtils';

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  tenantGroupId?: string;
}

/**
 * Upload a bank statement export. Re-importing a period that overlaps one
 * already loaded is the expected way to use this — the bank's archive
 * reference is stable, so the rows already held are recognised and counted
 * rather than added a second time.
 */
const ImportDialog: React.FC<ImportDialogProps> = ({ open, onClose, tenantGroupId }) => {
  const importMutation = useImportStatement();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const reset = () => {
    setResult(null);
    setError(null);
    setFileName(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (file: File) => {
    setResult(null);
    setError(null);
    setFileName(file.name);

    try {
      const csv = await file.text();
      const imported = await importMutation.mutateAsync({ csv, groupId: tenantGroupId });
      setResult(imported);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    }
  };

  const skippedEntries = Object.entries(result?.skipped || {});

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Import bank statement</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          A SEB account statement export (CSV). Importing a period you have already loaded is
          safe — rows are matched on the bank&apos;s archive reference, so an overlap is skipped
          rather than duplicated.
        </Typography>

        <Button
          component="label"
          variant="outlined"
          startIcon={<UploadFile />}
          fullWidth
          disabled={importMutation.isPending}
          sx={{ py: 2 }}
        >
          {fileName || 'Choose a CSV file'}
          <input
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              // Clear the input so picking the same file twice still fires
              e.target.value = '';
              if (file) handleFile(file);
            }}
          />
        </Button>

        {importMutation.isPending && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Reading and matching against what you already have…
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {result && (
          <Box sx={{ mt: 2 }}>
            <Alert
              severity={result.imported > 0 ? 'success' : 'info'}
              icon={result.imported > 0 ? <CheckCircle /> : undefined}
            >
              <AlertTitle>
                {result.imported > 0
                  ? `${result.imported} transaction${result.imported === 1 ? '' : 's'} imported`
                  : 'Nothing new to import'}
              </AlertTitle>
              {result.period && (
                <Typography variant="body2">
                  File covered {result.period.from} → {result.period.to} ({result.rows} rows)
                </Typography>
              )}
              {result.duplicates > 0 && (
                <Typography variant="body2">
                  {result.duplicates} row{result.duplicates === 1 ? ' was' : 's were'} already
                  held from an earlier import — skipped, not duplicated.
                </Typography>
              )}
            </Alert>

            {result.categories.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  What came in
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {result.categories.map((c) => (
                    <Chip
                      key={c.category}
                      size="small"
                      label={`${c.category}: ${c.count} · ${formatCurrency(c.amount)}`}
                    />
                  ))}
                </Box>
              </Box>
            )}

            {skippedEntries.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Left out on purpose
                </Typography>
                <Table size="small">
                  <TableBody>
                    {skippedEntries
                      .sort(([, a], [, b]) => b - a)
                      .map(([reason, count]) => (
                        <TableRow key={reason}>
                          <TableCell sx={{ border: 0, py: 0.25, pl: 0 }}>{reason}</TableCell>
                          <TableCell align="right" sx={{ border: 0, py: 0.25, pr: 0, width: 60 }}>
                            {count}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {result && <Button onClick={reset}>Import another</Button>}
        <Button onClick={handleClose} variant="contained">
          {result ? 'Done' : 'Cancel'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImportDialog;
