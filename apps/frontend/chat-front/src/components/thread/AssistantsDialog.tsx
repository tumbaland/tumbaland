import { useEffect, useState } from 'react';
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
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import PauseIcon from '@mui/icons-material/PauseCircleOutlined';
import PlayIcon from '@mui/icons-material/PlayCircleOutlined';
import ViewIcon from '@mui/icons-material/VisibilityOutlined';
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
 * Assistants in this chat: whether they are on, who has added one, and how
 * much of your allowance is left. Everything an assistant is told, its own and
 * what the chat shares with every assistant, is in its settings.
 *
 * One switch for the whole chat, which anyone in it may flip; the thread says
 * who did. A chat an admin locked off (a lock no longer offered here) can be
 * turned back on only by an admin, and that one switch also lifts the lock. A message that mentions an assistant is sent to Anthropic to be answered, which
 * is said here, where the choice is made.
 */
export function AssistantsDialog({ open, onClose, view, onRefresh, actions }: AssistantsDialogProps) {
  const [editing, setEditing] = useState<Bot | 'new' | null>(null);
  // Asked before removing: what it wrote stays, but the assistant and what it was told go.
  const [removing, setRemoving] = useState<string | null>(null);
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

  // Those that may speak up unasked: the people here should know their messages can go to Anthropic then too.
  const joining = view?.bots.filter((bot) => bot.joinsIn && !bot.paused) ?? [];
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
                    disabled={busy || (view.lockedOff && !view.isManager)}
                    onChange={(event) => {
                      const enabled = event.target.checked;
                      void run(() => actions.change(enabled && view.lockedOff ? { enabled, lockedOff: false } : { enabled }));
                    }}
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
                {joining.length > 0 &&
                  ` ${joining.map((bot) => bot.name).join(' and ')} also ${joining.length === 1 ? 'joins' : 'join'} in now and then without being asked, and then the recent messages are sent too.`}
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
                <Box key={bot.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 0.75 }}>
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
                    <IconButton aria-label={bot.canManage ? `Edit ${bot.name}` : `View ${bot.name}`} disabled={busy} onClick={() => setEditing(bot)}>
                      {bot.canManage ? <EditIcon /> : <ViewIcon />}
                    </IconButton>
                    {bot.canManage && (
                      <IconButton aria-label={`Remove ${bot.name}`} disabled={busy} onClick={() => setRemoving(bot.id)}>
                        <DeleteIcon />
                      </IconButton>
                    )}
                  </Box>
                  {removing === bot.id && (
                    <Alert
                      severity="warning"
                      sx={{ mb: 1 }}
                      action={
                        <>
                          <Button
                            color="error"
                            size="small"
                            disabled={busy}
                            onClick={() => void run(() => actions.deleteBot(bot.id)).then(() => setRemoving(null))}
                          >
                            Yes, remove it
                          </Button>
                          <Button size="small" color="inherit" disabled={busy} onClick={() => setRemoving(null)}>
                            Keep it
                          </Button>
                        </>
                      }
                    >
                      Remove {bot.name}? What it wrote stays in the chat.
                    </Alert>
                  )}
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

              {view.isManager && (
                <>
                  <Divider sx={{ my: 2.5 }} />
                  <Heading>For admins</Heading>
                  <TextField
                    select
                    size="small"
                    label="Who can add assistants"
                    value={view.whoCanAdd}
                    disabled={busy}
                    onChange={(event) => void run(() => actions.change({ whoCanAdd: event.target.value as 'everyone' | 'admins' }))}
                    sx={{ display: 'flex', mt: 0.5, maxWidth: 280 }}
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
          onChangeSettings={actions.change}
        />
      )}
    </>
  );
}
