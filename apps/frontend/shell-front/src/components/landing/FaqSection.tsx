import { Accordion, AccordionDetails, AccordionSummary, Box, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { CatalogPlan, limitLinesFor } from '../../config/pricing';
import { SectionHeading } from './SectionHeading';

interface Faq {
  q: string;
  a: string;
}

/**
 * The free tier's own numbers, read from the catalog rather than written out.
 *
 * This sentence used to spell them ("one gigabyte, three tracked tickers,
 * ninety days"), which is the same defect as a hardcoded price table with a
 * longer fuse: an admin moving a limit at runtime would leave the FAQ quietly
 * lying. When the catalog has not loaded the sentence simply drops its list —
 * the promise it makes ("no expiry, no card") does not depend on the figures.
 */
function freeTierAnswer(free?: CatalogPlan): string {
  const opening = 'No. The free tier has no expiry and no card';
  const closing = 'It is not a trial that turns into a bill.';
  if (!free) return `${opening}, and every feature in the app. ${closing}`;

  const lines = limitLinesFor(free.effectiveLimits)
    .filter(line => line.key !== 'seats' && line.key !== 'planner')
    .map(line => line.text.toLowerCase());

  return `${opening}: ${lines.join(', ')}, and every feature in the app. ${closing}`;
}

/**
 * The honest-limits explanation, moved below the price table and cut into
 * questions. As three paragraphs above the prices it asked a stranger to read
 * about our GPU bill before they knew what the product was; as an FAQ it
 * answers the same things at the moment someone is actually weighing the cost.
 */
const FAQS: Faq[] = [
  {
    q: 'Why are there limits at all?',
    a: 'Three things cost money per use rather than per user: storing photos, running the AI analysis on a GPU, and market data. That last one is a hard ceiling — our data provider allows a fixed number of price lookups per day across the whole service, so each tracked ticker is a genuinely finite resource. The paid tiers buy more of it.'
  },
  {
    q: 'What happens when I hit a limit?',
    a: 'You stop being able to add more of that one thing. Reading your own data is never behind the paywall, so nothing you already saved disappears or locks — you just cannot add the next photo until you free up space or upgrade.'
  },
  {
    q: 'And if I cancel, or stop paying?',
    a: 'Nothing is deleted, ever. You keep everything you paid for until the end of the period you paid for, and after that the account drops to free limits. Downgrading hides data rather than destroying it, and it all comes back if you upgrade again.'
  },
  {
    q: 'Can I use it on my own?',
    a: 'Yes. Groups are entirely optional and off unless you create one. Plenty of this is worth keeping for one person — the Family plan exists for households that want a shared history rather than two half-histories.'
  },
  {
    q: 'Is it finished?',
    a: 'Mostly. All four modules are in daily use, and the paid tiers are the part still being built — which is why everything is free right now and the prices above are published early rather than charged.'
  }
];

interface FaqSectionProps {
  /** The catalog, so the free-tier answer quotes the limits actually enforced. */
  plans?: CatalogPlan[];
}

export function FaqSection({ plans = [] }: FaqSectionProps) {
  const faqs: Faq[] = [
    { q: 'Do I have to pay anything?', a: freeTierAnswer(plans.find(plan => plan.code === 'free')) },
    ...FAQS
  ];

  return (
    <Box component="section" sx={{ py: { xs: 5, md: 7 }, px: 2 }}>
      <SectionHeading eyebrow="Straight answers" title="Questions worth asking first" />

      <Box sx={{ maxWidth: 760, mx: 'auto' }}>
        {faqs.map((faq) => (
          <Accordion
            key={faq.q}
            disableGutters
            elevation={0}
            sx={{
              background: 'transparent',
              borderBottom: '1px solid rgba(15,23,42,0.09)',
              '&:before': { display: 'none' },
              '&:first-of-type': { borderTop: '1px solid rgba(15,23,42,0.09)' }
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon sx={{ color: '#8b5cf6' }} />}
              sx={{ px: 0.5, py: 1 }}
            >
              <Typography sx={{ fontWeight: 650, color: '#0f172a', fontSize: '1rem' }}>
                {faq.q}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 0.5, pt: 0, pb: 2.5 }}>
              <Typography sx={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.68 }}>
                {faq.a}
              </Typography>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    </Box>
  );
}

export default FaqSection;
