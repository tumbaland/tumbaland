import { Box, Container, Divider, Link, Typography } from '@mui/material';

interface DocumentPageProps {
  title: string;
  /** Shown under the title — what this page is for, in one line. */
  intro: string;
  /** When the text was last changed. A policy without one is not much of a policy. */
  updated: string;
  children: React.ReactNode;
}

/**
 * The shell for the pages a visitor reads rather than uses: the privacy policy
 * and the connector guide.
 *
 * Deliberately plain. These exist to be read start to finish by someone who is
 * deciding whether to trust the product with a journal and a photo library, and
 * by a reviewer checking the same thing — neither is served by marketing
 * furniture.
 */
export function DocumentPage({ title, intro, updated, children }: DocumentPageProps) {
  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 4, md: 7 } }}>
      <Container maxWidth="md">
        <Typography variant="h3" component="h1" sx={{ fontWeight: 'bold', mb: 1 }}>
          {title}
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', mb: 1 }}>
          {intro}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          Last updated {updated}
        </Typography>

        <Divider sx={{ my: 4 }} />

        <Box
          sx={{
            '& h2': { fontSize: '1.35rem', fontWeight: 700, mt: 5, mb: 1.5 },
            '& h3': { fontSize: '1.05rem', fontWeight: 600, mt: 3, mb: 1 },
            '& p': { lineHeight: 1.7, mb: 2, color: 'text.primary' },
            '& li': { lineHeight: 1.7, mb: 1 },
            '& ul': { pl: 3, mb: 2 },
            '& table': { width: '100%', borderCollapse: 'collapse', mb: 3, fontSize: '0.92rem' },
            '& th, & td': {
              textAlign: 'left',
              padding: '0.6rem 0.75rem',
              borderBottom: '1px solid',
              borderColor: 'divider',
              verticalAlign: 'top'
            },
            '& th': { fontWeight: 600 },
            '& code': {
              fontFamily: 'monospace',
              fontSize: '0.88em',
              bgcolor: 'action.hover',
              px: 0.6,
              py: 0.2,
              borderRadius: 0.5
            }
          }}
        >
          {children}
        </Box>

        <Divider sx={{ my: 5 }} />

        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Questions about any of this: <Link href="mailto:hello@tumbaland.eu">hello@tumbaland.eu</Link>
          {' · '}
          <Link href="/">Home</Link>
          {' · '}
          <Link href="/privacy">Privacy</Link>
          {' · '}
          <Link href="/connect">Connect an assistant</Link>
          {' · '}
          <Link href="/terms">Terms</Link>
        </Typography>
      </Container>
    </Box>
  );
}

export default DocumentPage;
