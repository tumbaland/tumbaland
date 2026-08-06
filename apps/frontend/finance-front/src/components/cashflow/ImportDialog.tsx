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
import { AnyImportResult, isCategoryResult, FORMAT_LABELS } from '../../services/cashflowService';
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
  const [result, setResult] = useState<AnyImportResult | null>(null);
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

  const statement = result && !isCategoryResult(result) ? result : null;
  const categories = result && isCategoryResult(result) ? result : null;
  const skippedEntries = Object.entries(statement?.skipped || {});

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Import bank statement</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Two kinds of file land here and the format decides what happens.
        </Typography>
        <Box component="ul" sx={{ color: 'text.secondary', pl: 2.5, mt: 0, mb: 2 }}>
          <Typography component="li" variant="body2">
            <strong>A SEB account statement.</strong> Re-importing a period you already loaded is
            safe — rows are matched on the bank&apos;s archive reference, so an overlap is skipped
            rather than duplicated.
          </Typography>
          <Typography component="li" variant="body2">
            <strong>An export from this page with the categories edited.</strong> Only the category
            column is read back; everything else stays as the bank reported it.
          </Typography>
        </Box>

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
          <Chip
            size="small"
            variant="outlined"
            sx={{ mt: 2 }}
            label={`Read as: ${FORMAT_LABELS[result.format]}`}
          />
        )}

        {categories && (
          <Box sx={{ mt: 2 }}>
            <Alert
              severity={categories.updated > 0 ? 'success' : 'info'}
              icon={categories.updated > 0 ? <CheckCircle /> : undefined}
            >
              <AlertTitle>
                {categories.updated > 0
                  ? `${categories.updated} transaction${categories.updated === 1 ? '' : 's'} recategorised`
                  : 'No categories changed'}
              </AlertTitle>
              {categories.unchanged > 0 && (
                <Typography variant="body2">
                  {categories.unchanged} row{categories.unchanged === 1 ? ' was' : 's were'} already
                  in the category the file gives.
                </Typography>
              )}
              {categories.notFound > 0 && (
                <Typography variant="body2">
                  {categories.notFound} id{categories.notFound === 1 ? '' : 's'} in the file
                  {categories.notFound === 1 ? ' does' : ' do'} not match anything here.
                </Typography>
              )}
              {categories.malformed > 0 && (
                <Typography variant="body2">
                  {categories.malformed} row{categories.malformed === 1 ? '' : 's'} had no usable id
                  or category and {categories.malformed === 1 ? 'was' : 'were'} left alone.
                </Typography>
              )}
            </Alert>

            {categories.categories.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Moved into</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {categories.categories.map((c) => (
                    <Chip key={c.category} size="small" label={`${c.category}: ${c.count}`} />
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        )}

        {statement && (
          <Box sx={{ mt: 2 }}>
            <Alert
              severity={statement.imported > 0 ? 'success' : 'info'}
              icon={statement.imported > 0 ? <CheckCircle /> : undefined}
            >
              <AlertTitle>
                {statement.imported > 0
                  ? `${statement.imported} transaction${statement.imported === 1 ? '' : 's'} imported`
                  : 'Nothing new to import'}
              </AlertTitle>
              {statement.period && (
                <Typography variant="body2">
                  File covered {statement.period.from} → {statement.period.to} ({statement.rows} rows)
                </Typography>
              )}
              {statement.duplicates > 0 && (
                <Typography variant="body2">
                  {statement.duplicates} row{statement.duplicates === 1 ? ' was' : 's were'} already
                  held from an earlier import — skipped, not duplicated.
                </Typography>
              )}
            </Alert>

            {statement.categories.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  What came in
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {statement.categories.map((c) => (
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
