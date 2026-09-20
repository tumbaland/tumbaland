import { useCallback, useState } from 'react';
import { Box, Button, Link, Tooltip, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { SectionHeading } from './SectionHeading';
import { brand, glass, ink } from '@tumbaland/frontend-core';

/**
 * How connecting actually works, with the one thing nobody can guess.
 *
 * The real address and the three steps, and nothing else. The address is shown
 * rather than hidden behind the guide because it is the single detail that
 * turns "sounds nice" into "I could set that up now"; everything else about
 * setup lives in the full guide, which opens over the page rather than leaving
 * it.
 *
 * It used to carry three cards of example questions as well. The exchange in
 * the hero now plays every one of them against the real tools, so the cards
 * were the same claim a second time, in text.
 */

/** The MCP endpoint, exactly as it is pasted into a connector settings box. */
const MCP_URL = 'https://mcp.tumbaland.eu/mcp';

interface Step {
  n: number;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    n: 1,
    title: 'Add the address',
    body: 'In Claude, or any assistant that takes MCP connectors.'
  },
  {
    n: 2,
    title: 'Pick what it can reach',
    body: 'Sign in and approve. You choose what it may touch.'
  },
  {
    n: 3,
    title: 'Talk to it',
    body: 'Say what happened, or ask what you did.'
  }
];

interface AssistantSectionProps {
  /** Opens the full setup guide over the page. */
  onOpenGuide: () => void;
}

export function AssistantSection({ onOpenGuide }: AssistantSectionProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(MCP_URL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access is denied in plenty of ordinary situations: an
      // insecure origin, a locked-down browser. The address is on screen and
      // selectable either way, so there is nothing to report and nothing to fix.
    }
  }, []);

  return (
    <Box component="section" id="assistant" sx={{ maxWidth: 1120, mx: 'auto', px: 2, py: { xs: 4, md: 7 }, scrollMarginTop: 72 }}>
      <SectionHeading
        eyebrow="How it connects"
        title="One address, and it is connected"
        subtitle="Tumbaland is a standard MCP server, so a connector is all it takes. Claude is the one we have tested end to end."
      />

      <Box sx={{ ...glass, maxWidth: 820, mx: 'auto', p: { xs: 1.75, md: 3 } }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: 0.5,
            pl: { xs: 1.25, md: 1.75 },
            borderRadius: 2.5,
            background: 'rgba(255,255,255,0.78)',
            border: '1px solid rgba(15,23,42,0.06)'
          }}
        >
          <Box
            component="code"
            sx={{
              flexGrow: 1,
              minWidth: 0,
              fontFamily: '"SFMono-Regular", Menlo, Consolas, monospace',
              fontSize: { xs: '0.84rem', md: '1rem' },
              color: ink.strong,
              overflowX: 'auto',
              whiteSpace: 'nowrap'
            }}
          >
            {MCP_URL}
          </Box>
          <Tooltip title={copied ? 'Copied' : 'Copy address'}>
            <Button
              onClick={handleCopy}
              startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: 2,
                flexShrink: 0,
                color: copied ? '#15803d' : brand.purple,
                '&:hover': { backgroundColor: `${brand.purple}12` }
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </Tooltip>
        </Box>

        <Box
          component="ol"
          sx={{
            listStyle: 'none',
            m: 0,
            p: 0,
            mt: { xs: 2, md: 3 },
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' },
            gap: { xs: 1.5, md: 2.5 }
          }}
        >
          {STEPS.map((step) => (
            <Box component="li" key={step.n} sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
              <Box
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: brand.purple,
                  backgroundColor: `${brand.purple}18`
                }}
              >
                {step.n}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, color: ink.strong, fontSize: { xs: '0.93rem', md: '0.98rem' }, mb: 0.25 }}>
                  {step.title}
                </Typography>
                <Typography sx={{ color: ink.body, fontSize: { xs: '0.86rem', md: '0.92rem' }, lineHeight: 1.45 }}>
                  {step.body}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      <Typography
        sx={{
          textAlign: 'center',
          mt: { xs: 2.5, md: 4 },
          fontSize: { xs: '0.9rem', md: '0.95rem' },
          color: ink.muted,
          maxWidth: 620,
          mx: 'auto'
        }}
      >
        It only ever sees what you tick, and you can disconnect it from your account page.{' '}
        {/* A real address, so it still works opened in a new tab; a plain click
            opens the guide over the page instead. Kept on one line: broken
            across two it reads as two links. */}
        <Link
          href="/connect"
          onClick={(event) => {
            event.preventDefault();
            onOpenGuide();
          }}
          sx={{ color: brand.purple, fontWeight: 600, whiteSpace: 'nowrap' }}
        >
          Full setup guide
        </Link>
      </Typography>
    </Box>
  );
}

export default AssistantSection;
