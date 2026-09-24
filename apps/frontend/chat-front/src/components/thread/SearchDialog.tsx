import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import { brand, ink, surface } from '@tumbaland/frontend-core';
import { chatApi } from '../../services/chatApi';
import { dayLabel } from './DaySeparator';
import type { ConversationMember, Message } from '../../types';

export interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  /** For the sender's current name, as the thread shows it. */
  members: ConversationMember[];
  currentUserId: string;
  /** A result was tapped: the thread opens it. */
  onPick: (message: Message) => void;
}

/** Fewer letters than this match nearly every message, so nothing is asked. */
const MIN_TERM = 2;
const DEBOUNCE_MS = 300;
/** What the server returns at most; a full page means there may be more. */
const RESULT_LIMIT = 50;
/** Characters kept before the match, so a long message shows the part that matched. */
const LEAD = 30;

/**
 * The message text around the match, with the match marked.
 *
 * A long message is cut to start shortly before the match, since the first
 * line of a paragraph is rarely the part someone searched for.
 */
/**
 * Text as search compares it: any case, and ё as е, the way chat-service
 * matches. Keeps the length, so a position found here is a position in the
 * original text.
 */
const fold = (text: string) => text.toLowerCase().replace(/ё/g, 'е');

function Snippet({ body, term }: { body: string; term: string }) {
  const at = fold(body).indexOf(fold(term));
  if (at < 0 || !term) return <>{body}</>;
  const start = at > LEAD + 10 ? at - LEAD : 0;
  return (
    <>
      {start > 0 && '…'}
      {body.slice(start, at)}
      <Box
        component="mark"
        sx={{
          bgcolor: `color-mix(in srgb, ${brand.pinkInk} 22%, transparent)`,
          color: 'inherit',
          borderRadius: 0.5
        }}
      >
        {body.slice(at, at + term.length)}
      </Box>
      {body.slice(at + term.length)}
    </>
  );
}

/**
 * Search in this conversation.
 *
 * Results are the newest first, the way people look for "what she said about
 * the restaurant": usually the last time it came up. Tapping one closes this
 * and the thread scrolls to the message.
 */
export function SearchDialog({ open, onClose, conversationId, members, currentUserId, onPick }: SearchDialogProps) {
  const [term, setTerm] = useState('');
  /** With the term they were found for, which lags what is typed while the next search runs. */
  const [results, setResults] = useState<{ term: string; messages: Message[] } | null>(null);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  /** Only the latest request's answer is shown, whatever order they come back in. */
  const latest = useRef(0);

  useEffect(() => {
    if (!open) return;
    setTerm('');
    setResults(null);
    setFailed(false);
  }, [open]);

  const trimmed = term.trim();
  useEffect(() => {
    const request = ++latest.current;
    if (trimmed.length < MIN_TERM) {
      setResults(null);
      setSearching(false);
      setFailed(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      chatApi
        .search(trimmed, conversationId)
        .then((found) => {
          if (request !== latest.current) return;
          setResults({ term: trimmed, messages: found });
          setFailed(false);
        })
        .catch(() => {
          if (request !== latest.current) return;
          setResults(null);
          setFailed(true);
        })
        .finally(() => request === latest.current && setSearching(false));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [trimmed, conversationId]);

  const nameOf = (message: Message) => {
    if (message.senderId === currentUserId) return 'You';
    const member = members.find((candidate) => candidate.userId === message.senderId);
    return member?.name || message.senderName || member?.email || 'Someone';
  };

  let body: React.ReactNode = null;
  if (failed) {
    body = <Hint>Search is not working right now. Try again in a moment.</Hint>;
  } else if (searching && !results) {
    body = (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  } else if (results && results.messages.length === 0) {
    body = <Hint>No messages with “{results.term}”.</Hint>;
  } else if (results) {
    body = (
      <>
        <List aria-label="Search results" disablePadding>
          {results.messages.map((message) => (
            <ListItemButton
              key={message.id}
              onClick={() => onPick(message)}
              sx={{ display: 'block', py: 1.25, px: 2, borderBottom: `1px solid ${surface.sunken}` }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.25 }}>
                <Typography noWrap sx={{ fontSize: 13, fontWeight: 600, color: ink.strong }}>
                  {nameOf(message)}
                </Typography>
                <Typography sx={{ fontSize: 12.5, color: ink.muted, flexShrink: 0 }}>{dayLabel(message.createdAt)}</Typography>
              </Box>
              <Typography
                sx={{
                  fontSize: 15,
                  color: ink.strong,
                  overflowWrap: 'anywhere',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}
              >
                <Snippet body={message.body} term={results.term} />
              </Typography>
            </ListItemButton>
          ))}
        </List>
        {results.messages.length >= RESULT_LIMIT && <Hint>Showing the {RESULT_LIMIT} newest. Add a word to narrow it down.</Hint>}
      </>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      // A sheet like every other dialog here, as tall as it may be on a phone
      // so the results have room above the keyboard.
      slotProps={{ paper: { sx: { height: { xs: 'calc(100% - 24px)', sm: '70vh' } } } }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1,
          py: 1,
          borderBottom: `1px solid ${surface.sunken}`
        }}
      >
        <IconButton aria-label="Close search" onClick={onClose}>
          <ArrowBackIcon />
        </IconButton>
        <InputBase
          autoFocus
          fullWidth
          placeholder="Search messages"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          inputProps={{ 'aria-label': 'Search messages', enterKeyHint: 'search' }}
          // 16px, or iOS zooms the page when the box takes focus.
          sx={{ fontSize: 16, flex: 1 }}
        />
        {term && (
          <IconButton aria-label="Clear search" onClick={() => setTerm('')}>
            <CloseIcon />
          </IconButton>
        )}
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto' }}>{body}</Box>
    </Dialog>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ color: ink.muted, fontSize: 14, textAlign: 'center', px: 3, py: 4 }}>{children}</Typography>;
}
