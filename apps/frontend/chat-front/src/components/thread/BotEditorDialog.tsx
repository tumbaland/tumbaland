import { useEffect, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { ink } from '@tumbaland/frontend-core';
import type { AssistantSettingsChange, AssistantsView, Bot, BotChange, BotInput, ModelId } from '../../types';

export interface BotEditorDialogProps {
  open: boolean;
  onClose: () => void;
  /** The assistant being looked at; null when making a new one. */
  bot: Bot | null;
  view: AssistantsView;
  onCreate: (input: BotInput) => Promise<unknown>;
  onUpdate: (botId: string, change: BotChange) => Promise<unknown>;
  onDelete: (botId: string) => Promise<unknown>;
  /** Saves what every assistant in the chat knows about the people in it. */
  onChangeSettings: (change: AssistantSettingsChange) => Promise<unknown>;
  /**
   * Opened from the assistant's name in the thread rather than from the
   * Assistants list: a way on to what holds for every assistant in the chat.
   */
  onOpenSettings?: () => void;
}

const NAME_LIMIT = 24;
const TEXT_LIMIT = 1500;

/**
 * A text that follows the server until someone edits it here. From then on their
 * words stay, whatever arrives, until the server holds what they wrote (they
 * saved) or the dialog opens again. An assistant can add a line at any moment,
 * and that refresh must not take away what someone is in the middle of typing.
 */
export function useDraft(server: string | undefined, open: boolean): [string, (value: string) => void] {
  const [draft, setDraft] = useState('');
  // The server's text the draft last started from; unset while the dialog is closed.
  const base = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!open) {
      base.current = undefined;
      return;
    }
    if (server === undefined) return;
    // Read now: the updater runs later, during render, by when the ref has moved on.
    const previous = base.current;
    base.current = server;
    setDraft((current) => (previous === undefined || current === previous ? server : current));
  }, [open, server]);
  return [draft, setDraft];
}

/** What a person is told when a save fails: the server words its refusals for people, anything else is generic. */
const messageOf = (cause: unknown): string => {
  const status = (cause as { status?: number }).status;
  return status === 400 || status === 403 ? (cause as Error).message : 'Could not save that. Try again.';
};

/**
 * Making an assistant, or reading and changing one: everything it is told, in
 * one place.
 *
 * - How it talks: its own. Everyone in the chat can read it; only whoever made
 *   it, and the group's owner and admins, can change it.
 * - About you: its owner's private details. Only they see it, and it is used
 *   only when they ask.
 * - About everyone here: the chat's, shared by every assistant in it. Anyone in
 *   the chat can change it, and assistants add lines when asked to remember.
 *
 * The model is offered as Fast, Balanced or Best, with the one thing that
 * differs for people: how much of their allowance it uses. Pausing is the
 * button beside it in the Assistants list.
 */
export function BotEditorDialog({ open, onClose, bot, view, onCreate, onUpdate, onDelete, onChangeSettings, onOpenSettings }: BotEditorDialogProps) {
  const [name, setName] = useState('');
  const [personality, setPersonality] = useState('');
  const [aboutOwner, setAboutOwner] = useState('');
  const [known, setKnown] = useDraft(view.memory, open);
  const [memoryOn, setMemoryOn] = useState(true);
  const [joinsIn, setJoinsIn] = useState(false);
  const [color, setColor] = useState('');
  const [model, setModel] = useState<ModelId>(view.models.default);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const creating = bot === null;
  const readOnly = !creating && !bot.canManage;
  const ownsIt = creating || bot.mine;
  const botId = bot?.id;

  // Fresh each time it opens, from the assistant it is about.
  useEffect(() => {
    if (!open) return;
    setName(bot?.name ?? '');
    setPersonality(bot?.personality ?? '');
    setAboutOwner(bot?.aboutOwner ?? '');
    setMemoryOn(view.memoryOn);
    setJoinsIn(bot?.joinsIn ?? false);
    setColor(bot?.color ?? view.colors.find((candidate) => !view.bots.some((other) => other.color === candidate)) ?? view.colors[0] ?? '');
    setModel(bot?.model ?? view.models.default);
    setError(null);
    setConfirmRemove(false);
    // Only on opening or switching bot: a live update must not overwrite what is being typed.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [open, botId]);

  // The chat's part, changed only if it was: an empty change is refused.
  const settings: AssistantSettingsChange = {
    ...(known !== view.memory ? { memory: known } : {}),
    ...(memoryOn !== view.memoryOn ? { memoryOn } : {})
  };
  const settingsChanged = Object.keys(settings).length > 0;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (settingsChanged) await onChangeSettings(settings);
      if (!readOnly) {
        const fields = { name: name.trim(), personality, color, model, ...(ownsIt ? { aboutOwner } : {}) };
        if (creating) await onCreate(fields);
        else await onUpdate(bot.id, { ...fields, joinsIn });
      }
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
            {bot.ownerName ? `${bot.ownerName} made this assistant. ` : ''}You can read how it talks, but only they and the group admins can change it.
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

        <Box sx={{ mt: 1.5 }}>
          <Typography id="bot-model-label" variant="caption" sx={{ color: ink.muted }}>
            Model
          </Typography>
          <RadioGroup row aria-labelledby="bot-model-label" value={shownModel} onChange={(event) => setModel(event.target.value as ModelId)}>
            {options.map((option) => (
              <FormControlLabel key={option.id} value={option.id} control={<Radio size="small" />} label={option.label} disabled={readOnly || busy} />
            ))}
          </RadioGroup>
          {hint && (
            <Typography variant="caption" sx={{ color: ink.muted, display: 'block' }}>
              {hint}
            </Typography>
          )}
        </Box>

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
          placeholder="Warm and brief, a little cheeky. Answers in the language it is asked in."
          slotProps={{ htmlInput: { maxLength: TEXT_LIMIT } }}
          helperText="Everyone in this chat can read this."
        />

        {ownsIt && (
          <TextField
            label="About you"
            value={aboutOwner}
            onChange={(event) => setAboutOwner(event.target.value)}
            disabled={busy}
            fullWidth
            multiline
            minRows={2}
            maxRows={6}
            margin="dense"
            placeholder="What you like, what you are working on, anything that helps it help you."
            slotProps={{ htmlInput: { maxLength: TEXT_LIMIT } }}
            helperText="Only you can see this. It is used only when you ask, and never repeated in the chat."
          />
        )}

        {!creating && (
          <>
            <FormControlLabel
              sx={{ display: 'block', mt: 1 }}
              control={<Switch checked={joinsIn} disabled={readOnly || busy} onChange={(event) => setJoinsIn(event.target.checked)} />}
              label="Joins in now and then"
            />
            <Typography variant="caption" sx={{ color: ink.muted, display: 'block', mb: 1 }}>
              Without being asked, it sometimes answers a question or adds a line, at most once every two hours. When it does, the recent
              messages are sent to Anthropic, and it uses {bot.mine ? 'your' : `${bot.ownerName || 'its owner'}'s`} allowance.
            </Typography>
          </>
        )}

        <TextField
          label="About everyone in this chat"
          value={known}
          onChange={(event) => setKnown(event.target.value)}
          disabled={busy}
          fullWidth
          multiline
          minRows={2}
          maxRows={8}
          margin="dense"
          placeholder={'We live in Tallinn.\nOur anniversary is 21 October.'}
          slotProps={{ htmlInput: { maxLength: TEXT_LIMIT } }}
          helperText="One thing to a line. Everyone here can read and change it, and every assistant in this chat knows it."
        />
        <FormControlLabel
          sx={{ display: 'block' }}
          control={<Switch checked={memoryOn} disabled={busy} onChange={(event) => setMemoryOn(event.target.checked)} />}
          label="Let assistants add a line when asked to remember something"
        />

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

        {onOpenSettings && (
          <Button size="small" onClick={onOpenSettings} disabled={busy} sx={{ mt: 2, px: 0 }}>
            Settings for all assistants in this chat
          </Button>
        )}

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
          {(!readOnly || settingsChanged) && (
            <Button variant="contained" onClick={() => void save()} disabled={busy || !name.trim()}>
              {creating ? 'Add' : 'Save'}
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
}
