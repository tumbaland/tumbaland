import { Box } from '@mui/material';

const PHOTO_TINTS = ['#93c5fd', '#c4b5fd', '#fda4af', '#fcd34d', '#86efac', '#a5b4fc'];

/**
 * Stylised composition of the four modules, shown in the hero so a first-time
 * visitor can see what the product is before reading a word about it. Drawn
 * with CSS and inline SVG rather than a bitmap so it stays sharp, weighs
 * nothing, and cannot go stale against a real screenshot.
 */
export function ProductPreview() {
  return (
    <Box
      aria-hidden
      data-testid="product-preview"
      sx={{
        width: '100%',
        maxWidth: 940,
        mx: 'auto',
        borderRadius: { xs: 3, md: 4 },
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.9)',
        boxShadow: '0 40px 80px -40px rgba(76,29,149,0.45), 0 2px 8px rgba(15,23,42,0.06)'
      }}
    >
      {/* Window chrome */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          px: 2,
          py: 1.25,
          borderBottom: '1px solid rgba(15,23,42,0.06)',
          background: 'rgba(255,255,255,0.5)'
        }}
      >
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
          <Box key={c} sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: c }} />
        ))}
      </Box>

      <Box sx={{ display: 'flex', minHeight: { xs: 260, md: 340 } }}>
        {/* Module rail, mirroring the app's own side menu */}
        <Box
          sx={{
            width: { xs: 44, md: 52 },
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1.5,
            pt: 2.5,
            borderRight: '1px solid rgba(15,23,42,0.06)',
            background: 'rgba(255,255,255,0.4)'
          }}
        >
          {['#ef4444', '#3b82f6', '#22c55e', '#7c3aed'].map((c, i) => (
            <Box
              key={c}
              sx={{
                width: { xs: 22, md: 26 },
                height: { xs: 22, md: 26 },
                borderRadius: 2,
                backgroundColor: i === 1 ? c : `${c}26`,
                border: i === 1 ? 'none' : `1px solid ${c}40`
              }}
            />
          ))}
        </Box>

        <Box
          sx={{
            flex: 1,
            p: { xs: 1.75, md: 2.5 },
            display: 'grid',
            gap: { xs: 1.25, md: 1.75 },
            gridTemplateColumns: { xs: '1fr', sm: '1.15fr 1fr' }
          }}
        >
          {/* Net worth panel */}
          <Panel>
            <Label>Net worth</Label>
            <Box
              sx={{
                fontSize: { xs: 22, md: 27 },
                fontWeight: 800,
                letterSpacing: '-0.03em',
                color: '#0f172a',
                lineHeight: 1.1
              }}
            >
              €48,320
            </Box>
            <Box sx={{ fontSize: 12, fontWeight: 600, color: '#16a34a', mb: 0.5 }}>
              ▲ 4.2% this quarter
            </Box>
            <Box
              component="svg"
              viewBox="0 0 220 56"
              preserveAspectRatio="none"
              sx={{ width: '100%', height: { xs: 42, md: 54 }, display: 'block' }}
            >
              <defs>
                <linearGradient id="tl-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0,44 L24,40 L48,43 L72,32 L96,35 L120,24 L144,26 L168,15 L192,18 L220,6 L220,56 L0,56 Z"
                fill="url(#tl-area)"
              />
              <path
                d="M0,44 L24,40 L48,43 L72,32 L96,35 L120,24 L144,26 L168,15 L192,18 L220,6"
                fill="none"
                stroke="#22c55e"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="220" cy="6" r="3.5" fill="#22c55e" />
            </Box>
          </Panel>

          {/* Album panel */}
          <Panel>
            <Label>Recent album</Label>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 0.75,
                mt: 0.25
              }}
            >
              {PHOTO_TINTS.map((tint, i) => (
                <Box
                  key={tint}
                  sx={{
                    aspectRatio: '1 / 1',
                    borderRadius: 1.5,
                    background: `linear-gradient(135deg, ${tint}, ${tint}88)`,
                    position: 'relative',
                    overflow: 'hidden',
                    '&::after':
                      i === 0
                        ? {
                            content: '""',
                            position: 'absolute',
                            inset: '30% 22% 18% 22%',
                            borderRadius: '50% 50% 44% 44%',
                            background: 'rgba(255,255,255,0.55)'
                          }
                        : undefined
                  }}
                />
              ))}
            </Box>
            <Box sx={{ fontSize: 11, color: '#64748b', mt: 0.75 }}>
              2,418 photos · tagged automatically
            </Box>
          </Panel>

          {/* Activity heatmap panel, spanning both columns */}
          <Panel sx={{ gridColumn: { sm: '1 / -1' } }}>
            <Label>Time together, last 12 weeks</Label>
            <Box sx={{ display: 'flex', gap: '3px', mt: 0.5 }}>
              {Array.from({ length: 12 }).map((_, week) => (
                <Box key={week} sx={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
                  {Array.from({ length: 5 }).map((__, day) => {
                    // Deterministic pseudo-pattern: no randomness, so the
                    // preview renders identically on every visit and in tests.
                    const level = (week * 7 + day * 3) % 4;
                    return (
                      <Box
                        key={day}
                        sx={{
                          height: { xs: 8, md: 11 },
                          borderRadius: '2px',
                          backgroundColor: ['#f1f5f9', '#fecdd3', '#fb7185', '#e11d48'][level]
                        }}
                      />
                    );
                  })}
                </Box>
              ))}
            </Box>
          </Panel>
        </Box>
      </Box>
    </Box>
  );
}

function Panel({ children, sx = {} }: { children: React.ReactNode; sx?: object }) {
  return (
    <Box
      sx={{
        background: 'rgba(255,255,255,0.75)',
        border: '1px solid rgba(15,23,42,0.06)',
        borderRadius: 2.5,
        p: { xs: 1.5, md: 1.75 },
        display: 'flex',
        flexDirection: 'column',
        gap: 0.4,
        ...sx
      }}
    >
      {children}
    </Box>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: '#94a3b8'
      }}
    >
      {children}
    </Box>
  );
}

export default ProductPreview;
