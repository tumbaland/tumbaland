import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { ink } from '@tumbaland/frontend-core';
import type { AssistantsView, Bot, BotChange, BotInput, ModelId } from '../../types';

export interface BotEditorDialogProps {
  open: boolean;
  onClose: () => void;
  /** The assistant being looked at; null when making a new one. */
  bot: Bot | null;
  view: AssistantsView;
  onCreate: (input: BotInput) => Promise<unknown>;
  onUpdate: (botId: string, change: BotChange) => Promise<unknown>;
  onDelete: (botId: string) => Promise<unknown>;
}

const NAME_LIMIT = 24;
const TEXT_LIMIT = 1500;

/** What a person is told when a save fails: the server words its refusals for people, anything else is generic. */
const messageOf = (cause: unknown): string => {
  const status = (cause as { status?: number }).status;
  return status === 400 || status === 403 ? (cause as Error).message : 'Could not save that. Try again.';
};

/**
 * Making an assistant, or reading and changing one.
 *
 * Everyone in the chat can open any assistant and read what it was told, since
 * it reads a chat they share. Only whoever made it, and the group's owner and
 * admins, can change it. The model is offered as Fast, Balanced or Best, with
 * the one thing that differs for people: how much of their allowance it uses.
 */
export function BotEditorDialog({ open, onClose, bot, view, onCreate, onUpdate, onDelete }: BotEditorDialogProps) {
  const [name, setName] = useState('');
  const [personality, setPersonality] = useState('');
  const [aboutOwner, setAboutOwner] = useState('');
  const [color, setColor] = useState('');
  const [model, setModel] = useState<ModelId>(view.models.default);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const creating = bot === null;
  const readOnly = !creating && !bot.canManage;
  const botId = bot?.id;

  // Fresh each time it opens, from the assistant it is about.
  useEffect(() => {
    if (!open) return;
    setName(bot?.name ?? '');
    setPersonality(bot?.personality ?? '');
    setAboutOwner(bot?.aboutOwner ?? '');
    setColor(bot?.color ?? view.colors.find((candidate) => !view.bots.some((other) => other.color === candidate)) ?? view.colors[0] ?? '');
    setModel(bot?.model ?? view.models.default);
    setError(null);
    setConfirmRemove(false);
    // Only on opening or switching bot: a live update must not overwrite what is being typed.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [open, botId]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const fields = { name: name.trim(), personality, aboutOwner, color, model };
      if (creating) await onCreate(fields);
      else await onUpdate(bot.id, fields);
      onClose();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!bot) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete(bot.id);
      onClose();
    } catch (cause) {
      setError(messageOf(cause));
      setConfirmRemove(false);
    } finally {
      setBusy(false);
    }
  };

  // A model admin has since turned off is shown as what it will answer with, so the list never lacks the current value.
  const options = view.models.options;
  const shownModel = options.some((option) => option.id === model) ? model : view.models.default;
  const hint = options.find((option) => option.id === shownModel)?.hint;

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="bot-editor-title">
      <DialogTitle id="bot-editor-title">{creating ? 'Add your assistant' : readOnly ? bot.name : `Edit ${bot.name}`}</DialogTitle>
      <DialogContent>
        {readOnly && (
          <Typography variant="body2" sx={{ color: ink.muted, mb: 2 }}>
            {bot.ownerName ? `${bot.ownerName} made this assistant. ` : ''}You can read what it was told, but only they and the group admins can change it.
          </Typography>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={readOnly || busy}
          fullWidth
          margin="dense"
          slotProps={{ htmlInput: { maxLength: NAME_LIMIT } }}
          helperText={`You will type @${name.trim() || 'Name'} to ask it something.`}
        />

        {!readOnly && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1.5, mb: 0.5 }} role="group" aria-label="Starting points">
            {view.presets.map((preset) => (
              <Chip key={preset.id} label={preset.name} size="small" variant="outlined" onClick={() => setPersonality(preset.personality)} />
            ))}
          </Box>
        )}
        <TextField
          label="How it talks"
          value={personality}
          onChange={(event) => setPersonality(event.target.value)}
          disabled={readOnly || busy}
          fullWidth
          multiline
          minRows={2}
          maxRows={6}
          margin="dense"
          slotProps={{ htmlInput: { maxLength: TEXT_LIMIT } }}
          helperText="Everyone in this chat can read this."
        />
        <TextField
          label={`About ${bot?.ownerName || 'you'}`}
          value={aboutOwner}
          onChange={(event) => setAboutOwner(event.target.value)}
          disabled={readOnly || busy}
          fullWidth
          multiline
          minRows={2}
          maxRows={6}
          margin="dense"
          slotProps={{ htmlInput: { maxLength: TEXT_LIMIT } }}
          helperText="What it should keep in mind, like what you like or what you are working on."
        />

        <TextField
          select
          label="Model"
          value={shownModel}
          onChange={(event) => setModel(event.target.value as ModelId)}
          disabled={readOnly || busy}
          fullWidth
          margin="dense"
          helperText={hint}
        >
          {options.map((option) => (
            <MenuItem key={option.id} value={option.id}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>

        <Box sx={{ mt: 1.5 }}>
          <Typography id="bot-color-label" variant="caption" sx={{ color: ink.muted }}>
            Colour
          </Typography>
          <Box role="radiogroup" aria-labelledby="bot-color-label" sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
            {view.colors.map((candidate) => (
              <Box
                key={candidate}
                component="button"
                type="button"
                role="radio"
                aria-checked={color === candidate}
                aria-label={candidate}
                disabled={readOnly || busy}
                onClick={() => setColor(candidate)}
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  bgcolor: candidate,
                  border: color === candidate ? `3px solid ${ink.strong}` : '3px solid transparent',
                  cursor: readOnly ? 'default' : 'pointer',
                  p: 0
                }}
              />
            ))}
          </Box>
        </Box>

        {confirmRemove && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Remove {bot?.name}? What it wrote stays in the chat.
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
        <Box>
          {!creating && bot.canManage && !confirmRemove && (
            <Button color="error" onClick={() => setConfirmRemove(true)} disabled={busy}>
              Remove
            </Button>
          )}
          {confirmRemove && (
            <>
              <Button color="error" variant="contained" onClick={() => void remove()} disabled={busy}>
                Yes, remove it
              </Button>
              <Button onClick={() => setConfirmRemove(false)} disabled={busy} sx={{ ml: 1 }}>
                Keep it
              </Button>
            </>
          )}
        </Box>
        <Box>
          <Button onClick={onClose} disabled={busy}>
            {readOnly ? 'Close' : 'Cancel'}
          </Button>
          {!readOnly && (
            <Button variant="contained" onClick={() => void save()} disabled={busy || !name.trim()}>
              {creating ? 'Add' : 'Save'}
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
}
