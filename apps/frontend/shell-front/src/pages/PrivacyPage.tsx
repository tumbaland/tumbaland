import { Alert, Link, Typography } from '@mui/material';
import DocumentPage from '../components/DocumentPage';

/**
 * The privacy policy.
 *
 * Written from what the code actually does rather than from a template: the
 * data listed here is the data the services store, and the third parties are
 * the ones they genuinely talk to. Two things get said plainly because they are
 * the ones a reasonable person would be surprised by — that photo files carry
 * GPS coordinates and Tumbaland reads them, and that connecting an AI assistant
 * sends journal content to whoever runs it.
 */
export function PrivacyPage() {
  return (
    <DocumentPage
      title="Privacy"
      intro="What Tumbaland stores, where it lives, and who else can see it."
      updated="4 September 2026"
    >
      <p>
        Tumbaland is a private journal, photo library and finance tracker for one person or a small
        group. It is run by an individual, not a company, and it is built to hold things people do
        not put on the open internet. This page says exactly what that means in practice.
      </p>

      <h2>What is stored</h2>

      <table>
        <thead>
          <tr>
            <th>What</th>
            <th>Where it comes from</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Your email address, name and profile picture</td>
            <td>Google, when you sign in. Tumbaland never sees or stores a password.</td>
          </tr>
          <tr>
            <td>Journal entries — dates, activity types, descriptions, hours, and places</td>
            <td>What you type in.</td>
          </tr>
          <tr>
            <td>
              Photos and videos, plus what the files say about themselves: capture date, camera and
              lens, and <strong>GPS coordinates where the file carries them</strong>
            </td>
            <td>Files you upload. See the note below.</td>
          </tr>
          <tr>
            <td>Finance records — transactions, holdings, and the tickers you track</td>
            <td>What you enter or import.</td>
          </tr>
          <tr>
            <td>Group membership, by email address</td>
            <td>Groups you create or are invited to.</td>
          </tr>
          <tr>
            <td>Server logs: request paths, timestamps, IP addresses and error traces</td>
            <td>Ordinary operation. Kept to run and debug the service.</td>
          </tr>
        </tbody>
      </table>

      <Alert severity="info" sx={{ my: 3 }}>
        <Typography variant="body2">
          <strong>Photos usually contain a location.</strong> Most phones write GPS coordinates into
          the image file, and Tumbaland reads them so photos can appear on a map and be found by
          place. If you would rather that did not happen, turn location off in your camera app, or
          strip it from files before uploading — once a photo is uploaded, its coordinates are
          stored with it.
        </Typography>
      </Alert>

      <h2>Where it lives</h2>
      <ul>
        <li>
          <strong>The database</strong> — journal entries, finance records, accounts and group
          membership — is hosted on MongoDB Atlas.
        </li>
        <li>
          <strong>Photo and video files</strong> are stored on a server the operator runs and
          physically controls, in Estonia. They are not held by a cloud storage provider.
        </li>
        <li>
          <strong>Logs</strong> stay on that same server. Nothing is sent to an external analytics
          or crash-reporting service.
        </li>
      </ul>

      <h2>Who else sees it</h2>
      <p>
        Tumbaland does not sell data, does not run advertising, and does not share anything with
        anyone for their own purposes. These are the only third parties involved, and what each one
        receives:
      </p>

      <table>
        <thead>
          <tr>
            <th>Service</th>
            <th>What it receives</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Google</td>
            <td>Handles sign-in and tells Tumbaland your email, name and picture.</td>
          </tr>
          <tr>
            <td>Stripe</td>
            <td>
              Handles payment if you choose to support the project. Card details go to Stripe
              directly and are never seen or stored by Tumbaland.
            </td>
          </tr>
          <tr>
            <td>OpenStreetMap (Nominatim)</td>
            <td>
              Receives place names you type when searching for a location to attach to an entry.
              Only the search text, not the entry.
            </td>
          </tr>
          <tr>
            <td>Alpha Vantage</td>
            <td>
              Receives the ticker symbols you track, to fetch prices. No personal information.
            </td>
          </tr>
          <tr>
            <td>An AI assistant, if you connect one</td>
            <td>See the section below — this one is worth reading.</td>
          </tr>
        </tbody>
      </table>

      <h2>Connecting an AI assistant</h2>
      <p>
        You can connect an assistant such as Claude, ChatGPT or Gemini so you can add and read
        entries by talking to it. This is off unless you turn it on.
      </p>
      <p>
        <strong>When you use it, the content involved goes to whoever runs that assistant.</strong>{' '}
        If you ask it to log a dinner, the restaurant name is sent to them. If you ask what you did
        last month, the entries it reads are sent to them. Tumbaland cannot see or control what they
        then do with it — their own privacy policy governs that, and it is worth reading.
      </p>
      <p>
        What Tumbaland does control is the size of the opening. When you connect an assistant you
        approve a specific list of permissions and choose whether it acts on your own data or a
        group&apos;s. It gets nothing beyond that, and you can disconnect it at any time from{' '}
        <strong>Account → API keys → Connected apps</strong>. Disconnecting stops it renewing its
        access; anything it already holds expires within an hour.
      </p>

      <h2>Getting your data out, and deleting it</h2>
      <ul>
        <li>
          <strong>Export.</strong> Journal entries and cash flow can be exported as CSV, and photos
          downloaded at full resolution. This works on every plan.
        </li>
        <li>
          <strong>Deletion.</strong> Ask at the address below and the account and everything in it
          will be removed, including photo files. Backups roll over within 30 days.
        </li>
        <li>
          <strong>Correction.</strong> Everything Tumbaland holds about you is editable in the app.
        </li>
      </ul>

      <h2>How long things are kept</h2>
      <p>
        Your content is kept until you delete it or ask for the account to be removed. Server logs
        are kept for a short period for debugging and then rotated away. Some plans apply a
        retention window to older content, which is shown on the pricing section of the home page.
      </p>

      <h2>Security</h2>
      <p>
        Sign-in is Google-only, so there is no password to leak. Traffic is encrypted in transit.
        Access is scoped: nothing is visible to anyone else unless you create a group and invite
        them. Credentials issued to assistants are stored as one-way digests where they do not need
        to be readable, and API keys you can re-read are encrypted with a key held outside the
        database.
      </p>
      <p>
        Tumbaland is{' '}
        <Link href="https://github.com/toomastahves/tumbaland" target="_blank" rel="noreferrer">
          open source
        </Link>
        , so none of this has to be taken on trust — the code that handles your data can be read.
      </p>

      <h2>Children</h2>
      <p>Tumbaland is not intended for use by children under 16.</p>

      <h2>Changes</h2>
      <p>
        If this page changes in a way that affects what happens to your data, the date at the top
        changes and anyone with an account is told before it takes effect.
      </p>

      <h2>Contact</h2>
      <p>
        Tumbaland is operated by an individual in Estonia. For anything on this page — access,
        deletion, or a question — write to{' '}
        <Link href="mailto:hello@tumbaland.eu">hello@tumbaland.eu</Link>.
      </p>
    </DocumentPage>
  );
}

export default PrivacyPage;
