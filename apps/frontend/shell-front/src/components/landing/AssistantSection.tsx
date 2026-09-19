import { useCallback, useState } from 'react';
import { Box, Button, Link, Paper, Tooltip, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import FavoriteIcon from '@mui/icons-material/Favorite';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import AlbumIcon from '@mui/icons-material/PhotoAlbum';
import { SectionHeading } from './SectionHeading';
import { brand, glass, ink } from '@tumbaland/components';

/**
 * How connecting actually works, with the one thing nobody can guess.
 *
 * The real address, the three steps, and what the assistant can do once it is
 * in. The address is shown rather than hidden behind the guide because it is
 * the single detail that turns "sounds nice" into "I could set that up now".
 * Everything else about setup lives in the full guide, which opens over the
 * page rather than leaving it.
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
    body: 'In Claude, or any assistant that takes MCP connectors, add a custom connector and paste the URL above.'
  },
  {
    n: 2,
    title: 'Pick what it can reach',
    body: 'Sign in and approve. You choose the permissions and which journals it may act on.'
  },
  {
    n: 3,
    title: 'Talk to it',
    body: 'Switch the connector on in a chat and say what happened, or ask what you did.'
  }
];

interface Capability {
  key: string;
  name: string;
  color: string;
  icon: React.ComponentType<{ sx?: object }>;
  /** Phrased as things a person says, not as tool names. */
  examples: string[];
}

/** Every line maps to a tool that exists. */
const CAPABILITIES: Capability[] = [
  {
    key: 'relationship',
    name: 'Journal',
    color: '#ef4444',
    icon: FavoriteIcon,
    examples: ['“we cooked and watched a film last night”', '“when did we last go out for dinner?”']
  },
  {
    key: 'finance',
    name: 'Money',
    color: '#22c55e',
    icon: AttachMoneyIcon,
    examples: ['“what did we spend at Selver this year?”', '“which subscriptions are we still paying for?”']
  },
  {
    key: 'album',
    name: 'Photos',
    color: '#3b82f6',
    icon: AlbumIcon,
    examples: ['“what did we photograph this day last year?”', '“tag these ones as Spain”']
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
        subtitle="Tumbaland is a standard MCP server, so a connector is all it takes. Nothing to install and nothing to run yourself. Claude is the one we have tested end to end."
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

      {/* A row you swipe on a phone, three across on a desktop. Stacked, the
          three cards were a screen of scrolling to reach the privacy section. */}
      <Box
        sx={{
          display: 'grid',
          gridAutoFlow: { xs: 'column', md: 'row' },
          gridAutoColumns: { xs: 'minmax(240px, 78%)', md: 'auto' },
          gridTemplateColumns: { md: 'repeat(3, minmax(0, 1fr))' },
          gap: { xs: 1.25, md: 2 },
          maxWidth: 940,
          mx: { xs: -2, md: 'auto' },
          px: { xs: 2, md: 0 },
          mt: { xs: 2, md: 4 },
          pb: { xs: 0.5, md: 0 },
          overflowX: { xs: 'auto', md: 'visible' },
          scrollSnapType: { xs: 'x mandatory', md: 'none' },
          scrollPaddingLeft: 16,
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' }
        }}
      >
        {CAPABILITIES.map((capability) => {
          const Icon = capability.icon;
          return (
            <Paper
              key={capability.key}
              elevation={0}
              sx={{
                ...glass,
                p: { xs: 1.75, md: 2.25 },
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                scrollSnapAlign: 'start'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: 2,
                    display: 'grid',
                    placeItems: 'center',
                    backgroundColor: `${capability.color}18`,
                    color: capability.color,
                    flexShrink: 0
                  }}
                >
                  <Icon sx={{ fontSize: 16 }} />
                </Box>
                <Typography
                  sx={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.11em',
                    textTransform: 'uppercase',
                    color: capability.color
                  }}
                >
                  {capability.name}
                </Typography>
              </Box>

              <Box component="ul" sx={{ m: 0, pl: 0, listStyle: 'none', display: 'grid', gap: 0.6 }}>
                {capability.examples.map((example) => (
                  <Box
                    key={example}
                    component="li"
                    sx={{ color: ink.body, fontSize: { xs: '0.88rem', md: '0.93rem' }, lineHeight: 1.45 }}
                  >
                    {example}
                  </Box>
                ))}
              </Box>
            </Paper>
          );
        })}
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
