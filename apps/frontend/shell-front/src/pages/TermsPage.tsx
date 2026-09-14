import { Link } from '@mui/material';
import DocumentPage from '../components/DocumentPage';

/**
 * The terms.
 *
 * Lives here, next to the privacy policy and the connector guide, because it is
 * read by the same person at the same moment — someone deciding whether to sign
 * up, who has no account and should not need one. The version this replaced sat
 * inside the billing app behind a link that dead-ended, and stamped itself
 * "last updated" with today's date on every render, so it claimed to have been
 * revised daily and could never be checked against anything.
 *
 * Written to match what is actually offered: everything is free. Copy that
 * describes tiers, subscriptions or entitlements would be describing a product
 * that does not exist.
 */
export const TERMS_DOC = {
  title: 'Terms',
  intro: 'What you can expect from Tumbaland, and what it expects from you.',
  updated: '14 September 2026'
};

/** The terms themselves: the /terms page and the front page's reader both show them. */
export function TermsContent() {
  return (
    <>
      <p>
        Tumbaland is a private journal, photo library and finance tracker, run by an individual
        rather than a company. These terms cover using it. They are short because the arrangement
        is simple.
      </p>

      <h2>The service is free</h2>
      <p>
        Every feature is available at no cost. There is no paid tier holding back the real
        product, nothing to subscribe to and no card to enter.
      </p>

      <h2>Your content is yours</h2>
      <ul>
        <li>
          You keep every right to what you put in. Nothing you upload is used to train anything, is
          sold, or is shown to anyone you did not invite.
        </li>
        <li>
          You are responsible for what you upload. You need the right to it, and it has to be lawful
          where you are.
        </li>
        <li>
          Journal entries and cash flow export as CSV, and photos download at full resolution,
          whenever you like. Ask and the account and everything in it will be deleted.
        </li>
      </ul>

      <h2>Using it reasonably</h2>
      <p>
        Do not use Tumbaland to break the law, to store material you have no right to, or in a way
        that degrades it for other people. Automated bulk traffic, or trying to reach another
        account&apos;s data. An account doing any of those may be suspended.
      </p>
      <p>
        Connecting an AI assistant is covered by the same rule and by one more: what passes through
        the conversation goes to whoever runs that assistant.{' '}
        <Link href="/connect">Connecting an assistant</Link> explains what one can and cannot reach,
        and the <Link href="/privacy">privacy page</Link> covers what it means for your data.
      </p>

      <h2>What is not promised</h2>
      <p>
        This is run by one person on hardware they own. It is looked after carefully and backed up,
        but it comes with no uptime guarantee and no warranty, and the operator&apos;s liability is
        limited to what you have paid, which is nothing. Keep your own copy of
        anything you would be upset to lose; the export tools exist for exactly that.
      </p>

      <h2>Changes and endings</h2>
      <p>
        If these terms change in a way that affects you, the date at the top changes and anyone with
        an account is told before it takes effect. You can stop using Tumbaland whenever you like.
        If the project were ever to shut down, there would be notice and time to export.
      </p>

      <h2>Where this applies</h2>
      <p>
        Tumbaland is operated from Estonia and these terms are governed by Estonian law. Nothing
        here removes rights you have as a consumer where you live.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about any of this: <Link href="mailto:hello@tumbaland.eu">hello@tumbaland.eu</Link>.
      </p>
    </>
  );
}

export function TermsPage() {
  return (
    <DocumentPage {...TERMS_DOC}>
      <TermsContent />
    </DocumentPage>
  );
}

export default TermsPage;
