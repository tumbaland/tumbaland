import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Autocomplete,
  Box,
  Typography,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Alert,
  Tooltip,
  CircularProgress,
  MenuItem,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import {
  Delete as DeleteIcon,
  ArrowUpward,
  ArrowDownward,
  Add as AddIcon,
  PlayArrow as ApplyIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import {
  useCategoryRules,
  useCreateCategoryRule,
  useDeleteCategoryRule,
  useMoveCategoryRule,
  useApplyCategoryRules
} from '../../hooks/useCategoryRules';
import { useStatementSettings, useUpdateStatementSettings } from '../../hooks/useStatementSettings';
import { CategoryRule } from '../../services/categoryRuleService';
import { TransactionType } from '../../services/cashflowService';

interface CategoryRulesDialogProps {
  open: boolean;
  onClose: () => void;
  categories: string[];
  tenantGroupId?: string;
  notify: (message: string, severity: 'success' | 'error') => void;
}

const DIRECTION_LABEL: Record<string, string> = {
  '': 'Either',
  income: 'Money in',
  expense: 'Money out'
};

/**
 * The rules that decide where an imported transaction lands.
 *
 * They used to be a list compiled into the service, which meant a merchant it
 * did not know stayed uncategorised until someone shipped a release. Here they
 * are data: order matters because the first match wins, so the list is shown in
 * running order and can be reordered.
 */
const CategoryRulesDialog: React.FC<CategoryRulesDialogProps> = ({
  open,
  onClose,
  categories,
  tenantGroupId,
  notify
}) => {
  const { data: rules = [], isLoading } = useCategoryRules(tenantGroupId);
  const createMutation = useCreateCategoryRule();
  const deleteMutation = useDeleteCategoryRule();
  const moveMutation = useMoveCategoryRule();
  const applyMutation = useApplyCategoryRules();

  const { data: settings } = useStatementSettings(tenantGroupId);
  const settingsMutation = useUpdateStatementSettings();

  const [pattern, setPattern] = useState('');
  const [category, setCategory] = useState('');
  const [direction, setDirection] = useState<TransactionType | ''>('');
  const [onlyUncategorised, setOnlyUncategorised] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState('');

  const ownerNames = settings?.ownerNames || [];

  const saveOwnerNames = async (next: string[], message: string) => {
    try {
      await settingsMutation.mutateAsync({ ownerNames: next, groupId: tenantGroupId });
      notify(message, 'success');
    } catch {
      notify('Failed to save your name', 'error');
    }
  };

  const handleAddOwnerName = async () => {
    const name = ownerName.trim();
    if (!name || ownerNames.includes(name)) return;

    setOwnerName('');
    await saveOwnerNames([...ownerNames, name], `Transfers naming ${name} will be skipped`);
  };

  const handleAdd = async () => {
    const text = pattern.trim();
    const next = category.trim();
    if (!text || !next) {
      setError('A rule needs both text to look for and a category to file it under');
      return;
    }

    setError(null);
    try {
      await createMutation.mutateAsync({
        pattern: text,
        category: next,
        ...(direction ? { type: direction } : {}),
        groupId: tenantGroupId
      });
      setPattern('');
      setCategory('');
      setDirection('');
      notify(`${text} will be filed as ${next}`, 'success');
    } catch {
      setError('Failed to save the rule');
    }
  };

  const handleDelete = async (rule: CategoryRule) => {
    try {
      await deleteMutation.mutateAsync(rule._id);
      notify(`Rule for ${rule.pattern} deleted`, 'success');
    } catch {
      notify('Failed to delete the rule', 'error');
    }
  };

  const handleMove = async (rule: CategoryRule, moveDirection: 'up' | 'down') => {
    try {
      await moveMutation.mutateAsync({ id: rule._id, direction: moveDirection, groupId: tenantGroupId });
    } catch {
      notify('Failed to reorder the rules', 'error');
    }
  };

  const handleApply = async () => {
    try {
      const result = await applyMutation.mutateAsync({ onlyUncategorised, groupId: tenantGroupId });
      notify(
        result.updated > 0
          ? `Recategorised ${result.updated} of ${result.examined} transaction${result.examined === 1 ? '' : 's'}`
          : 'Nothing left for these rules to change',
        'success'
      );
    } catch {
      notify('Failed to apply the rules', 'error');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Category rules</DialogTitle>
      <DialogContent>
        {/* Not a rule, but the same kind of thing: what the import needs to know
            about this owner in order to read their statements correctly. */}
        <Box sx={{ mb: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            Your name on statements
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
            Moving money between two of your own accounts is not income or spending. Add your name as the bank writes it
            — in both orderings, because it uses both — and those rows are skipped instead of counted twice.
          </Typography>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
            {ownerNames.map((name) => (
              <Chip
                key={name}
                label={name}
                onDelete={() =>
                  saveOwnerNames(
                    ownerNames.filter((n) => n !== name),
                    `${name} removed`
                  )
                }
              />
            ))}
            {ownerNames.length === 0 && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                None yet — only transfers between accounts the statement itself covers are spotted.
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              label="Add a name"
              size="small"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddOwnerName();
                }
              }}
              placeholder="SMITH ALEX"
              helperText="Case and accents are ignored"
              sx={{ minWidth: 220 }}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <Button
              onClick={handleAddOwnerName}
              disabled={settingsMutation.isPending || !ownerName.trim()}
              sx={{ mt: 0.25 }}
            >
              Add name
            </Button>
          </Box>
        </Box>

        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Every import is filed by these rules, top to bottom — the first that matches wins, so a specific one has to
          sit above a broader one.
        </Typography>

        {/* Add */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'flex-start', mb: 2 }}>
          <TextField
            label="Text to look for"
            size="small"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            helperText="Part of the merchant name, accents and case ignored"
            sx={{ flexGrow: 1, minWidth: 200 }}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <Autocomplete
            freeSolo
            options={categories}
            inputValue={category}
            onInputChange={(_, value, reason) => {
              if (reason === 'reset') return;
              setCategory(value);
            }}
            sx={{ flexGrow: 1, minWidth: 180 }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="File it as"
                size="small"
                slotProps={{ ...params.slotProps, inputLabel: { shrink: true } }}
              />
            )}
          />
          <TextField
            select
            label="Applies to"
            size="small"
            value={direction}
            onChange={(e) => setDirection(e.target.value as TransactionType | '')}
            sx={{ minWidth: 130 }}
            slotProps={{ inputLabel: { shrink: true } }}
          >
            <MenuItem value="">Either</MenuItem>
            <MenuItem value="expense">Money out</MenuItem>
            <MenuItem value="income">Money in</MenuItem>
          </TextField>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAdd}
            disabled={createMutation.isPending}
            sx={{ mt: 0.25 }}
          >
            Add rule
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} role="alert">
            {error}
          </Alert>
        )}

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : rules.length === 0 ? (
          <Alert severity="info">
            No rules yet, so every import lands in Uncategorised. Add one above, or change a transaction&apos;s category
            and let it be remembered.
          </Alert>
        ) : (
          /* The dialog is near full-width on a phone and these columns are not,
              so the row scrolls sideways on its own rather than taking the page
              with it. */
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 60 }}>Order</TableCell>
                  <TableCell>Matches</TableCell>
                  <TableCell>Files as</TableCell>
                  <TableCell>Applies to</TableCell>
                  <TableCell align="right" sx={{ width: 40 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {rules.map((rule, index) => (
                  <TableRow key={rule._id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex' }}>
                        <IconButton
                          size="small"
                          aria-label={`Move ${rule.pattern} earlier`}
                          disabled={index === 0 || moveMutation.isPending}
                          onClick={() => handleMove(rule, 'up')}
                        >
                          <ArrowUpward fontSize="inherit" />
                        </IconButton>
                        <IconButton
                          size="small"
                          aria-label={`Move ${rule.pattern} later`}
                          disabled={index === rules.length - 1 || moveMutation.isPending}
                          onClick={() => handleMove(rule, 'down')}
                        >
                          <ArrowDownward fontSize="inherit" />
                        </IconButton>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Typography
                          variant="body2"
                          sx={{ fontFamily: rule.matchType === 'regex' ? 'monospace' : undefined }}
                        >
                          {rule.pattern}
                        </Typography>
                        {rule.matchType === 'regex' && (
                          <Tooltip title="A pattern, not literal text — edit with care">
                            <Chip size="small" label="regex" variant="outlined" />
                          </Tooltip>
                        )}
                        {rule.note && (
                          <Tooltip title={rule.note}>
                            <InfoIcon fontSize="inherit" sx={{ color: 'text.secondary' }} />
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>{rule.category}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{DIRECTION_LABEL[rule.type || '']}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        aria-label={`Delete rule for ${rule.pattern}`}
                        onClick={() => handleDelete(rule)}
                        disabled={deleteMutation.isPending}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}

        {/* Retroactive apply — a new rule otherwise only bites on the next import */}
        {rules.length > 0 && (
          <Box sx={{ mt: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Apply to transactions already imported
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
              A new rule only changes what the next statement does. Run it over what you already have to clear the
              backlog it was written for.
            </Typography>
            <FormControlLabel
              control={
                <Checkbox checked={onlyUncategorised} onChange={(e) => setOnlyUncategorised(e.target.checked)} />
              }
              label={<Typography variant="body2">Only touch unsorted rows</Typography>}
            />
            {!onlyUncategorised && (
              <Alert severity="warning" sx={{ mb: 1 }}>
                Unchecked, this also refiles rows you sorted by hand — anything a rule claims will be moved to that
                rule&apos;s category.
              </Alert>
            )}
            <Box>
              <Button startIcon={<ApplyIcon />} onClick={handleApply} disabled={applyMutation.isPending}>
                {applyMutation.isPending ? 'Applying…' : 'Apply now'}
              </Button>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
};

export default CategoryRulesDialog;
