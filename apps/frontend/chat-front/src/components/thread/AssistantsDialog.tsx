import { useEffect, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import PauseIcon from '@mui/icons-material/PauseCircleOutlined';
import PlayIcon from '@mui/icons-material/PlayCircleOutlined';
import { ink } from '@tumbaland/frontend-core';
import type { AssistantSettingsChange, AssistantsView, Bot, BotChange, BotInput } from '../../types';
import { AllowanceBar } from './AllowanceBar';
import { BotAvatar } from './BotAvatar';
import { BotEditorDialog } from './BotEditorDialog';

export interface AssistantsDialogProps {
  open: boolean;
  onClose: () => void;
  /** Null until it has loaded. */
  view: AssistantsView | null;
  /** Asks for the view again: on opening, since an allowance moves with every reply. */
  onRefresh: () => void;
  actions: {
    change: (change: AssistantSettingsChange) => Promise<AssistantsView>;
    createBot: (input: BotInput) => Promise<AssistantsView>;
    updateBot: (botId: string, change: BotChange) => Promise<AssistantsView>;
    deleteBot: (botId: string) => Promise<AssistantsView>;
    setCap: (capPercent: number | null) => Promise<void>;
  };
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      component="h3"
      sx={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: ink.muted, mb: 1 }}
    >
      {children}
    </Typography>
  );
}

/** Where things stand, in a sentence. */
const status = (view: AssistantsView): string => {
  if (view.lockedOff) return 'An admin has turned assistants off for this chat.';
  return view.enabled ? 'On for everyone in this chat. Anyone here can turn them off.' : 'Off. Anyone in this chat can turn them on.';
};

/**
 * A text that follows the server until someone edits it here. From then on their
 * words stay, whatever arrives, until the server holds what they wrote (they
 * saved) or the dialog opens again. An assistant can add a note at any moment,
 * and that refresh must not take away what someone is in the middle of typing.
 */
function useDraft(server: string | undefined, open: boolean): [string, (value: string) => void] {
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

/**
 * Assistants in this chat, in one place: whether they are on, who has added
 * one, what everyone has told them, and how much of your allowance is left.
 *
 * One switch for the whole chat, which anyone in it may flip; the thread says
 * who did. A message that mentions an assistant is sent to Anthropic to be answered, which
 * is said here, where the choice is made.
 */
export function AssistantsDialog({ open, onClose, view, onRefresh, actions }: AssistantsDialogProps) {
  const [editing, setEditing] = useState<Bot | 'new' | null>(null);
  const [aboutUs, setAboutUs] = useDraft(view?.aboutUs, open);
  const [memory, setMemory] = useDraft(view?.memory, open);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) onRefresh();
    // Once per opening.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (cause) {
      const status = (cause as { status?: number }).status;
      setError(status === 400 || status === 403 ? (cause as Error).message : 'Could not save that. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const editedBot = editing && editing !== 'new' ? (view?.bots.find((bot) => bot.id === editing.id) ?? editing) : null;

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="assistants-title">
        <DialogTitle id="assistants-title">Assistants</DialogTitle>
        <DialogContent>
          {!view ? (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}>
              <CircularProgress size={28} aria-label="Loading assistants" />
            </Box>
          ) : (
            <>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                  {error}
                </Alert>
              )}

              <Heading>In this chat</Heading>
              <FormControlLabel
                control={
                  <Switch
                    checked={view.enabled}
                    disabled={busy || view.lockedOff}
                    onChange={(event) => void run(() => actions.change({ enabled: event.target.checked }))}
                  />
                }
                label="Allow assistants in this chat"
              />
              <Typography variant="body2" sx={{ color: ink.muted, mb: 1 }}>
                {status(view)}
              </Typography>
              <Typography variant="caption" sx={{ color: ink.muted, display: 'block' }}>
                When someone mentions an assistant, that message and the recent ones around it are sent to Anthropic to
                write the reply.
              </Typography>

              <Divider sx={{ my: 2.5 }} />
              <Heading>Assistants</Heading>
              {view.bots.length === 0 ? (
                <Typography variant="body2" sx={{ color: ink.muted, mb: 1 }}>
                  Nobody has added one yet.
                </Typography>
              ) : (
                <Typography variant="body2" sx={{ color: ink.muted, mb: 1 }}>
                  Ask one with @ and its name, or reply to something it said.
                </Typography>
              )}
              {view.bots.map((bot) => (
                <Box key={bot.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 0.75 }}>
                  <BotAvatar color={bot.color} size={32} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600 }} noWrap>
                      {bot.name}
                      {bot.paused && <Chip label="Paused" size="small" sx={{ ml: 1 }} />}
                    </Typography>
                    <Typography variant="caption" sx={{ color: ink.muted }}>
                      {bot.mine ? 'Yours' : `${bot.ownerName || 'Someone'}'s`} · {bot.modelLabel}
                    </Typography>
                  </Box>
                  {bot.canManage && (
                    <IconButton
                      aria-label={bot.paused ? `Resume ${bot.name}` : `Pause ${bot.name}`}
                      disabled={busy}
                      onClick={() => void run(() => actions.updateBot(bot.id, { paused: !bot.paused }))}
                    >
                      {bot.paused ? <PlayIcon /> : <PauseIcon />}
                    </IconButton>
                  )}
                  <Button size="small" onClick={() => setEditing(bot)}>
                    {bot.canManage ? 'Edit' : 'View'}
                  </Button>
                </Box>
              ))}
              {view.canAdd && (
                <Button variant="outlined" sx={{ mt: 1 }} onClick={() => setEditing('new')}>
                  Add your assistant
                </Button>
              )}
              {!view.canAdd && view.whoCanAdd === 'admins' && !view.isManager && (
                <Typography variant="caption" sx={{ color: ink.muted, display: 'block', mt: 1 }}>
                  Only the group owner and admins can add assistants here.
                </Typography>
              )}

              <Divider sx={{ my: 2.5 }} />
              <Heading>About you both</Heading>
              <TextField
                value={aboutUs}
                onChange={(event) => setAboutUs(event.target.value)}
                disabled={busy}
                fullWidth
                multiline
                minRows={2}
                maxRows={6}
                placeholder="We live in Tallinn. Our anniversary is 21 October."
                slotProps={{ htmlInput: { maxLength: 1500, 'aria-label': 'About you both' } }}
                helperText="Every assistant in this chat keeps this in mind. Anyone here can change it."
              />
              <Button
                sx={{ mt: 1 }}
                disabled={busy || aboutUs === view.aboutUs}
                onClick={() => void run(() => actions.change({ aboutUs }))}
              >
                Save
              </Button>

              <Divider sx={{ my: 2.5 }} />
              <Heading>What the assistants have noted</Heading>
              <TextField
                value={memory}
                onChange={(event) => setMemory(event.target.value)}
                disabled={busy}
                fullWidth
                multiline
                minRows={2}
                maxRows={8}
                placeholder="Nothing yet. Assistants add a line when you ask them to remember something."
                slotProps={{ htmlInput: { maxLength: 1500, 'aria-label': 'What the assistants have noted' } }}
                helperText="One note to a line. Anyone here can edit or delete them."
              />
              <Button sx={{ mt: 1 }} disabled={busy || memory === view.memory} onClick={() => void run(() => actions.change({ memory }))}>
                Save
              </Button>
              <FormControlLabel
                sx={{ display: 'block', mt: 1 }}
                control={
                  <Switch checked={view.memoryOn} disabled={busy} onChange={(event) => void run(() => actions.change({ memoryOn: event.target.checked }))} />
                }
                label="Let assistants add notes"
              />

              {view.isManager && (
                <>
                  <Divider sx={{ my: 2.5 }} />
                  <Heading>For admins</Heading>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={view.lockedOff}
                        disabled={busy}
                        onChange={(event) => void run(() => actions.change({ lockedOff: event.target.checked }))}
                      />
                    }
                    label="Turn assistants off in this chat"
                  />
                  <TextField
                    select
                    size="small"
                    label="Who can add assistants"
                    value={view.whoCanAdd}
                    disabled={busy}
                    onChange={(event) => void run(() => actions.change({ whoCanAdd: event.target.value as 'everyone' | 'admins' }))}
                    sx={{ display: 'flex', mt: 1.5, maxWidth: 280 }}
                  >
                    <MenuItem value="everyone">Everyone</MenuItem>
                    <MenuItem value="admins">Admins only</MenuItem>
                  </TextField>
                </>
              )}

              <Divider sx={{ my: 2.5 }} />
              <Heading>Your allowance</Heading>
              <AllowanceBar allowance={view.allowance} onCap={actions.setCap} />
            </>
          )}
        </DialogContent>
      </Dialog>

      {view && (
        <BotEditorDialog
          open={editing !== null}
          onClose={() => setEditing(null)}
          bot={editedBot}
          view={view}
          onCreate={actions.createBot}
          onUpdate={actions.updateBot}
          onDelete={actions.deleteBot}
        />
      )}
    </>
  );
}
