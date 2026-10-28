import Link from '@mui/material/Link';
import { chatColors } from './themes';
import { linkify } from './linkify';

/**
 * The text, with its web addresses as links. They open in a new tab, so a
 * conversation is never navigated away from, and send no referrer: the page
 * on the other end has no business knowing which chat it was shared in.
 */
export function MessageText({ text, mine }: { text: string; mine: boolean }) {
  return (
    <>
      {linkify(text).map((part, index) =>
        part.kind === 'text' ? (
          part.text
        ) : (
          <Link
            key={index}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            // A long press on a bubble opens the reaction picker. On a link
            // the browser's own long press (preview, copy) is the one wanted.
            onTouchStart={(event) => event.stopPropagation()}
            sx={{
              color: mine ? 'inherit' : chatColors.link,
              textDecorationColor: 'currentColor',
              textUnderlineOffset: '2px',
              // A long address with nowhere to break would widen the bubble
              // past the screen.
              overflowWrap: 'anywhere'
            }}
          >
            {part.text}
          </Link>
        )
      )}
    </>
  );
}
