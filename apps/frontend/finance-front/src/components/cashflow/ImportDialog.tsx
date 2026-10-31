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
  TableRow,
  TextField,
  MenuItem
} from '@mui/material';
import { UploadFile, CheckCircle } from '@mui/icons-material';
import { useImportStatement } from '../../hooks/useCashflow';
import {
  AnyImportResult,
  ImportResult,
  TransactionFileFormat,
  isCategoryResult,
  isPensionResult,
  FORMAT_LABELS
} from '../../services/cashflowService';
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
  /**
   * Empty means "work it out from the file", which is the default because it is
   * reliable and saves a decision. Choosing a format turns it into an assertion
   * the server checks: pick wrong and the upload is refused rather than the
   * file being read as something it is not.
   */
  const [format, setFormat] = useState<TransactionFileFormat | ''>('');

  const reset = () => {
    setResult(null);
    setError(null);
    setFileName(null);
  };

  const handleClose = () => {
    reset();
    setFormat('');
    onClose();
  };

  const handleFile = async (file: File) => {
    setResult(null);
    setError(null);
    setFileName(file.name);

    try {
      // Bytes, not text: file.text() decodes as UTF-8, which corrupts the
      // Latin-1 Pensionikeskus export before the server ever sees it.
      const csv = await file.arrayBuffer();
      const imported = await importMutation.mutateAsync({
        csv,
        groupId: tenantGroupId,
        format: format || undefined
      });
      setResult(imported);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    }
  };

  const categories = result && isCategoryResult(result) ? result : null;
  const pension = result && isPensionResult(result) ? result : null;
  const statement = result && !categories && !pension ? (result as ImportResult) : null;
  const skippedEntries = Object.entries(statement?.skipped || {});

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Import bank statement</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Three kinds of file land here and the format decides what happens — you do not have to
        say which is which.
        </Typography>
        <Box component="ul" sx={{ color: 'text.secondary', pl: 2.5, mt: 0, mb: 2 }}>
          <Typography component="li" variant="body2">
            <strong>A SEB account statement.</strong> Re-importing a period you already loaded is
            safe — rows are matched on the bank&apos;s archive reference, so an overlap is skipped
            rather than duplicated.
          </Typography>
          <Typography component="li" variant="body2">
            <strong>A Pensionikeskus account statement.</strong> One file covers every pillar and
            fund manager. II pillar is imported — it comes out of gross pay and no bank statement
            can see it. III pillar was paid by bank transfer you have already imported, so those
            are matched against it and left alone.
          </Typography>
          <Typography component="li" variant="body2">
            <strong>An export from this page with the categories edited.</strong> Only the category
            column is read back; everything else stays as the bank reported it.
          </Typography>
        </Box>

        <TextField
          select
          fullWidth
          size="small"
          label="File type"
          value={format}
          onChange={(e) => setFormat(e.target.value as TransactionFileFormat | '')}
          disabled={importMutation.isPending}
          helperText={
            format
              ? `The file will be refused if it is not a ${FORMAT_LABELS[format]}.`
              : 'Worked out from the file. Choose one to have it checked instead.'
          }
          sx={{ mb: 2 }}
        >
          <MenuItem value="">Detect automatically</MenuItem>
          {(Object.keys(FORMAT_LABELS) as TransactionFileFormat[]).map((key) => (
            <MenuItem key={key} value={key}>
              {FORMAT_LABELS[key]}
            </MenuItem>
          ))}
        </TextField>

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
              if (file) void handleFile(file);
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

        {pension && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              {pension.imported > 0
                ? `${pension.imported} contribution${pension.imported === 1 ? '' : 's'} imported`
                : 'Nothing new to import'}
            </Typography>
            <Chip
              size="small"
              variant="outlined"
              label={`Read as: ${FORMAT_LABELS[pension.format]}`}
              sx={{ mb: 1 }}
            />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {pension.contributions} contribution{pension.contributions === 1 ? '' : 's'} in the file
              {pension.period ? `, ${pension.period.from} to ${pension.period.to}` : ''}.
            </Typography>

            {pension.byPillar.map((p) => (
              <Box key={p.pillar} sx={{ mt: 1 }}>
                <Typography variant="body2">
                  <strong>{p.pillar} pillar</strong> — {p.count} contribution
                  {p.count === 1 ? '' : 's'}, {p.amount.toFixed(0)} €
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {p.action}
                </Typography>
              </Box>
            ))}

            {pension.coveredByBank > 0 && (
              <Alert severity="info" sx={{ mt: 1.5 }}>
                {pension.coveredByBank} contribution{pension.coveredByBank === 1 ? '' : 's'} already
                reached the fund as a bank transfer you have imported. Counting them here would
                double them.
              </Alert>
            )}
            {pension.duplicates > 0 && (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                {pension.duplicates} already imported from an earlier statement.
              </Typography>
            )}
            {pension.funds.length > 0 && (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                Funds: {pension.funds.join(', ')}
              </Typography>
            )}
          </Box>
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

            {statement.trades && (statement.trades.imported > 0 || statement.trades.alreadyRecorded > 0 || statement.trades.unmatched.length > 0) && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Trades and dividends
                </Typography>
                <Typography variant="body2">
                  {statement.trades.imported} added to the trade log
                  {statement.trades.alreadyRecorded > 0 && `, ${statement.trades.alreadyRecorded} already there`}.
                </Typography>
                {statement.trades.unmatched.length > 0 && (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Not recorded, because the ticker could not be found:
                    </Typography>
                    {statement.trades.unmatched.map((u) => (
                      <Typography key={u.what} variant="body2">
                        {u.what} ({u.count})
                      </Typography>
                    ))}
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      Add the missing ISIN or ticker under Tickers, then import the file again.
                    </Typography>
                  </Alert>
                )}
                {statement.trades.holdingsLeftAlone.length > 0 && (
                  <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                    Holding left as you entered it, since it has no earlier trades: {statement.trades.holdingsLeftAlone.join(', ')}.
                  </Typography>
                )}
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
