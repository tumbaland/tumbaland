import { useCallback, useState } from 'react';
import { Box, Button, Link, Paper, Tooltip, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import FavoriteIcon from '@mui/icons-material/Favorite';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import AlbumIcon from '@mui/icons-material/PhotoAlbum';
import { SectionHeading } from './SectionHeading';
import { brand, glass, ink } from '../../theme/tokens';

/**
 * How connecting actually works, with the one thing nobody can guess.
 *
 * This section used to be a staged conversation and a link. The conversation
 * has moved into the hero, where it belongs as the pitch, and what is left here
 * is the part a visitor needs in order to believe the pitch: the real address,
 * the three steps, and a plain list of what the assistant can do once it is in.
 *
 * The address is shown rather than hidden behind the guide because it is the
 * single detail that turns "sounds nice" into "I could set that up now", and
 * because a person evaluating this wants to see that it is an ordinary MCP
 * endpoint rather than something proprietary.
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

/**
 * What it can do, grouped the way the tools are.
 *
 * Written as sentences somebody would actually say rather than as the tool
 * names behind them — `search_transactions` is accurate and tells a visitor
 * nothing. Every line here maps to a tool that exists.
 */
const CAPABILITIES: Capability[] = [
  {
    key: 'relationship',
    name: 'Journal',
    color: '#ef4444',
    icon: FavoriteIcon,
    examples: [
      '“we cooked and watched a film last night”',
      '“when did we last go out for dinner?”',
      '“how have we been doing this month?”'
    ]
  },
  {
    key: 'finance',
    name: 'Finance',
    color: '#22c55e',
    icon: AttachMoneyIcon,
    examples: [
      '“what are we worth right now?”',
      '“what did we spend at Selver this year?”',
      '“which subscriptions are we still paying for?”'
    ]
  },
  {
    key: 'album',
    name: 'Photos',
    color: '#3b82f6',
    icon: AlbumIcon,
    examples: [
      '“what albums do I have?”',
      '“what did we photograph this day last year?”',
      '“tag these ones as Spain”'
    ]
  }
];

export function AssistantSection() {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(MCP_URL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access is denied in plenty of ordinary situations — an
      // insecure origin, a locked-down browser. The address is on screen and
      // selectable either way, so there is nothing to report and nothing to fix.
    }
  }, []);

  return (
    <Box component="section" id="assistant" sx={{ px: 2, py: { xs: 5, md: 7 }, scrollMarginTop: 80 }}>
      <SectionHeading
        eyebrow="How it works"
        title="One address, and it is connected"
        subtitle="Tumbaland is a standard MCP server, so a connector is all it takes. Nothing to install and nothing to run yourself. Claude is the one we have tested end to end."
      />

      <Box
        sx={{
          ...glass,
          maxWidth: 760,
          mx: 'auto',
          p: { xs: 2, md: 2.5 },
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          flexWrap: { xs: 'wrap', sm: 'nowrap' }
        }}
      >
        <Box
          component="code"
          sx={{
            flexGrow: 1,
            minWidth: 0,
            fontFamily: '"SFMono-Regular", Menlo, Consolas, monospace',
            fontSize: { xs: '0.86rem', md: '1rem' },
            color: ink.strong,
            overflowX: 'auto',
            whiteSpace: 'nowrap',
            px: 1
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
              borderRadius: 2.5,
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
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
          gap: 2,
          maxWidth: 940,
          mx: 'auto',
          mt: 3
        }}
      >
        {STEPS.map((step) => (
          <Box key={step.n} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', px: 0.5 }}>
            <Box
              sx={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                fontSize: 13,
                fontWeight: 700,
                color: brand.purple,
                backgroundColor: `${brand.purple}18`
              }}
            >
              {step.n}
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, color: ink.strong, fontSize: '0.98rem', mb: 0.4 }}>
                {step.title}
              </Typography>
              <Typography sx={{ color: ink.body, fontSize: '0.92rem', lineHeight: 1.5 }}>
                {step.body}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
          gap: 2,
          maxWidth: 940,
          mx: 'auto',
          mt: { xs: 5, md: 6 }
        }}
      >
        {CAPABILITIES.map((capability) => {
          const Icon = capability.icon;
          return (
            <Paper
              key={capability.key}
              elevation={0}
              sx={{ ...glass, p: { xs: 2.25, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: 1.25 }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 2,
                    display: 'grid',
                    placeItems: 'center',
                    backgroundColor: `${capability.color}18`,
                    color: capability.color,
                    flexShrink: 0
                  }}
                >
                  <Icon sx={{ fontSize: 18 }} />
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

              <Box component="ul" sx={{ m: 0, pl: 0, listStyle: 'none', display: 'grid', gap: 0.9 }}>
                {capability.examples.map((example) => (
                  <Box
                    key={example}
                    component="li"
                    sx={{ color: ink.body, fontSize: '0.93rem', lineHeight: 1.5 }}
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
        sx={{ textAlign: 'center', mt: 4, fontSize: '0.95rem', color: ink.muted, maxWidth: 620, mx: 'auto' }}
      >
        It only ever sees what you tick, and you can disconnect it from your account page.{' '}
        {/* Kept on one line: broken across two it reads as two links. */}
        <Link href="/connect" sx={{ color: brand.purple, fontWeight: 600, whiteSpace: 'nowrap' }}>
          Full setup guide
        </Link>
      </Typography>
    </Box>
  );
}

export default AssistantSection;
