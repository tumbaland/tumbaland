import { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import type { Breakpoint } from '@mui/material/styles';
import { surface } from '../../theme/tokens';

export interface AppLayoutProps {
  children: ReactNode;
  /** The app's own header, drawn above the content and inside the same column. */
  header?: ReactNode;
  /** Content width cap. Default `xl`; a single-column app (sign-in) wants `sm`. */
  maxWidth?: Breakpoint | false;
  /** Let the page own its horizontal padding — for a full-bleed map or gallery. */
  disableGutters?: boolean;
}

/**
 * The frame every front's pages sit in.
 *
 * There were five near-identical copies of this, one per app, and they had
 * drifted: three different background gradients (two sky-blue, one indigo)
 * against a pink product, two of them missing the `minWidth: 0` that stops a
 * wide row dragging the whole page sideways on a phone, and each with its own
 * idea of vertical padding. Opening a module from the shell changed the
 * backdrop under it, which is the one thing the iframe seam needed hidden.
 *
 * The safe-area insets are no-ops while a module runs inside the shell's frame
 * — the shell's own container already holds them, and `env()` resolves to zero
 * in an iframe — and are what keeps a module opened directly on a phone clear
 * of the notch and the home indicator.
 */
export function AppLayout({ children, header, maxWidth = 'xl', disableGutters = false }: AppLayoutProps) {
  return (
    <Box
      sx={{
        minHeight: '100dvh',
        background: surface.page,
        backgroundAttachment: 'fixed',
        display: 'flex',
        // A flex item otherwise grows to fit its widest content, so one wide
        // row anywhere on a page widened the app past the edge of the screen.
        '& > *': { minWidth: 0 }
      }}
    >
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          pt: 'env(safe-area-inset-top)',
          pb: 'env(safe-area-inset-bottom)',
          pl: 'env(safe-area-inset-left)',
          pr: 'env(safe-area-inset-right)'
        }}
      >
        {header}
        <Container
          maxWidth={maxWidth}
          disableGutters={disableGutters}
          sx={{
            flex: 1,
            minWidth: 0,
            // Pages set their own vertical rhythm. 32px here on top of theirs
            // was dead space above every page on a phone.
            py: { xs: 1.5, sm: 3 }
          }}
        >
          {children}
        </Container>
      </Box>
    </Box>
  );
}
