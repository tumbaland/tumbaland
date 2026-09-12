import { Accordion, AccordionDetails, AccordionSummary, Box, Typography } from '@mui/material';
import { brand, ink } from '../../theme/tokens';
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
  const opening = 'No. Nothing here is behind a payment, and there is no card and no expiry';
  const closing = 'It is not a trial that turns into a bill.';
  if (!free) return `${opening}, and every feature in the app. ${closing}`;

  const lines = limitLinesFor(free.effectiveLimits)
    .filter(line => line.key !== 'seats' && line.key !== 'planner')
    .map(line => line.text.toLowerCase());

  return `${opening}: ${lines.join(', ')}, and every feature in the app. ${closing}`;
}

/**
 * The honest-limits explanation, cut into questions.
 *
 * As three paragraphs it asked a stranger to read about our storage bill before
 * they knew what the product was. As an FAQ it answers the same things at the
 * point someone is deciding whether to sign up — and since the support section
 * now sits *below* this one, these answers are what a visitor has read before
 * they are asked for anything.
 *
 * **Five questions, not nine.** It grew a question per objection until it read
 * as a page-long defence of charging money, which is a strange thing to put
 * under a free product. What is left is the four a stranger actually has —
 * does this cost anything, why are there limits, what happens at one, and why
 * would I support — plus the state of the project.
 */
const FAQS: Faq[] = [
  {
    q: 'Why are there limits at all?',
    a: 'Two things cost money every time they are used: storing photos and market data. Our data provider allows a fixed number of price lookups per day for the whole service, so each tracked ticker is genuinely finite. The limits are what keep this free for everyone. Without them the first heavy account closes it for the rest.'
  },
  {
    q: 'What happens when I hit a limit?',
    a: 'You stop being able to add more of that one thing. Reading your own data is never behind a payment, so nothing you already saved disappears or locks. That holds if you support and later stop. Every account sees its own meters on the home page, so the ceiling is visible long before you reach it.'
  },
  {
    q: 'Why would I support, then?',
    a: 'Because it costs money to run and you would like it to keep running. This is a small project, not a company with a funding round behind it. A handful of people covering the storage and data bills is the difference between it being here in two years and not. Supporters also get a lot more room.'
  },
  {
    q: 'Is it finished?',
    a: 'Mostly. All four modules are in daily use. Supporting is the part still being built, which is why nothing is charged today and the figures below are published early. The site itself is not waiting on any of it.'
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
    <Box component="section" id="faq" sx={{ py: { xs: 5, md: 7 }, px: 2, scrollMarginTop: 80 }}>
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
              expandIcon={<ExpandMoreIcon sx={{ color: brand.violet }} />}
              sx={{ px: 0.5, py: 1 }}
            >
              <Typography sx={{ fontWeight: 650, color: ink.strong, fontSize: '1rem' }}>
                {faq.q}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 0.5, pt: 0, pb: 2.5 }}>
              <Typography sx={{ color: ink.body, fontSize: '0.95rem', lineHeight: 1.68 }}>
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
