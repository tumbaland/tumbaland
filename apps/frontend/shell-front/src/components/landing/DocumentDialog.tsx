import { useState } from 'react';
import { Box, Dialog, DialogContent, IconButton, Typography, useMediaQuery, useTheme } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { documentProse } from '../DocumentPage';
import { CONNECT_DOC, ConnectContent } from '../../pages/ConnectPage';
import { PRIVACY_DOC, PrivacyContent } from '../../pages/PrivacyPage';
import { TERMS_DOC, TermsContent } from '../../pages/TermsPage';
import { ink } from '@tumbaland/components';

/**
 * The connector guide, the privacy policy and the terms, read without leaving
 * the front page.
 *
 * They were three separate pages, so checking the privacy policy on a phone
 * meant leaving the page you were deciding on and finding your way back. Here
 * they open over it: full screen on a phone, a centred sheet on a wider screen.
 * The standalone pages still exist with the same text, for links from elsewhere
 * and for connector-directory reviewers who never see the front page.
 */

export type DocumentKey = 'connect' | 'privacy' | 'terms';

interface DocumentEntry {
  title: string;
  intro: string;
  updated: string;
  /** The standalone page with the same text. */
  path: string;
  Content: React.ComponentType;
}

export const DOCUMENTS: Record<DocumentKey, DocumentEntry> = {
  connect: { ...CONNECT_DOC, path: '/connect', Content: ConnectContent },
  privacy: { ...PRIVACY_DOC, path: '/privacy', Content: PrivacyContent },
  terms: { ...TERMS_DOC, path: '/terms', Content: TermsContent }
};

export const isDocumentKey = (value: string | null | undefined): value is DocumentKey =>
  value === 'connect' || value === 'privacy' || value === 'terms';

interface DocumentDialogProps {
  /** The document to show, or null for none. */
  doc: DocumentKey | null;
  onClose: () => void;
}

export function DocumentDialog({ doc, onClose }: DocumentDialogProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  // Holds on to the last document while the dialog animates closed, so the
  // text does not vanish a moment before the sheet does.
  const [shown, setShown] = useState<DocumentKey | null>(doc);
  if (doc && doc !== shown) {
    setShown(doc);
  }
  const entry = shown ? DOCUMENTS[shown] : null;

  return (
    <Dialog
      open={doc !== null}
      onClose={onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="md"
      scroll="paper"
      aria-labelledby="document-dialog-title"
      slotProps={{ paper: { sx: { borderRadius: fullScreen ? 0 : 4 } } }}
    >
      {entry && (
        <>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: { xs: 2, sm: 3 },
              pb: 1.5,
              // Full screen on a phone, the header sits where the status bar is.
              pt: fullScreen ? 'calc(12px + env(safe-area-inset-top))' : 2,
              borderBottom: '1px solid',
              borderColor: 'divider'
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                id="document-dialog-title"
                component="h2"
                sx={{ fontSize: { xs: '1.25rem', sm: '1.45rem' }, fontWeight: 750, letterSpacing: '-0.02em', color: ink.strong }}
              >
                {entry.title}
              </Typography>
              <Typography sx={{ fontSize: 12.5, color: ink.muted }}>Last updated {entry.updated}</Typography>
            </Box>
            <IconButton aria-label="Close" onClick={onClose} edge="end">
              <CloseIcon />
            </IconButton>
          </Box>

          <DialogContent
            sx={{
              ...documentProse,
              px: { xs: 2, sm: 3 },
              pt: 2.5,
              pb: 'calc(24px + env(safe-area-inset-bottom))'
            }}
          >
            <Typography sx={{ color: ink.body, fontSize: '1rem', lineHeight: 1.6 }}>{entry.intro}</Typography>
            <entry.Content />
          </DialogContent>
        </>
      )}
    </Dialog>
  );
}

export default DocumentDialog;
