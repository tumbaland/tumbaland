import { Alert, Box, Link, Typography } from '@mui/material';
import DocumentPage from '../components/DocumentPage';

/**
 * How to connect an assistant, and what it can do once connected.
 *
 * Two audiences with the same needs. Someone setting this up for the first time
 * needs the URL and the steps in order — the URL in particular is the one thing
 * they cannot guess. A directory reviewer needs to know what every tool does and
 * what it can reach. Both are served by saying it plainly once.
 */
export function ConnectPage() {
  return (
    <DocumentPage
      title="Connect an assistant"
      intro="Talk to Claude, ChatGPT or Gemini and have it write to your Tumbaland journal."
      updated="4 September 2026"
    >
      <p>
        Once connected you can say <em>&quot;we went to Kolm Sõsarat on Saturday&quot;</em> and it
        lands as a proper journal entry, or ask <em>&quot;when did we last see a film?&quot;</em> and
        get an answer from your own history. Nothing is sent anywhere until you connect it, and you
        choose what it may touch.
      </p>

      <h2>What you need</h2>
      <ul>
        <li>A Tumbaland account.</li>
        <li>
          Claude, ChatGPT or Gemini — anything that supports connectors, sometimes called MCP
          servers.
        </li>
      </ul>

      <h2>Connecting</h2>

      <h3>Claude (phone, web or desktop)</h3>
      <ol>
        <li>
          Open <strong>Settings → Connectors → Add custom connector</strong>.
        </li>
        <li>
          Paste this address:
          <Box
            component="code"
            sx={{ display: 'block', my: 1.5, p: 1.5, fontSize: '0.95rem !important' }}
          >
            https://mcp.tumbaland.eu/mcp
          </Box>
        </li>
        <li>Sign in with the Google account you use for Tumbaland.</li>
        <li>
          Approve the permissions screen. It shows exactly what the assistant is asking for and
          which data it will act on.
        </li>
        <li>
          <strong>Turn it on in the conversation.</strong> In a chat, press <strong>+</strong> →{' '}
          <strong>Connectors</strong> and switch Tumbaland on. This is per conversation — adding the
          connector in settings only makes it available.
        </li>
      </ol>

      <Alert severity="warning" sx={{ my: 3 }}>
        <Typography variant="body2">
          Step 5 is the one people miss. If the assistant says it has no matching tools, the
          connector is almost certainly connected but not switched on for that chat.
        </Typography>
      </Alert>

      <h3>Claude Code</h3>
      <Box component="code" sx={{ display: 'block', my: 1.5, p: 1.5, fontSize: '0.9rem !important' }}>
        claude mcp add --transport http tumbaland https://mcp.tumbaland.eu/mcp
        <br />
        claude mcp login tumbaland
      </Box>

      <h3>ChatGPT and Gemini</h3>
      <p>
        Both support remote connectors and take the same address. Add it wherever that product lists
        connectors or MCP servers, then authorise it in the browser window that opens.
      </p>

      <h2>What it can do</h2>
      <p>Five things, and nothing else:</p>

      <table>
        <thead>
          <tr>
            <th>Tool</th>
            <th>What it does</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>list_activity_types</code>
            </td>
            <td>
              Reads the kinds of thing your account records — Dining, Movies, Together and so on.
              Entries have to be filed under one of these, so it checks first.
            </td>
          </tr>
          <tr>
            <td>
              <code>log_day</code>
            </td>
            <td>
              Records what happened on a day. Adds to whatever is already there, so asking it to add
              one thing never removes another.
            </td>
          </tr>
          <tr>
            <td>
              <code>log_activity</code>
            </td>
            <td>Records a single entry on a date.</td>
          </tr>
          <tr>
            <td>
              <code>search_activities</code>
            </td>
            <td>
              Looks back through what you have logged, optionally narrowed to dates or one activity
              type.
            </td>
          </tr>
          <tr>
            <td>
              <code>get_stats</code>
            </td>
            <td>Totals, and whether each activity is picking up or tailing off.</td>
          </tr>
        </tbody>
      </table>

      <h2>What it cannot do</h2>
      <ul>
        <li>
          <strong>Reach anything you did not approve.</strong> Permissions are granted per
          connection, and the assistant is only shown the tools those permissions cover. If you
          grant reading but not writing, the tools that write are not offered to it at all.
        </li>
        <li>
          <strong>Move between your data and a group&apos;s.</strong> You pick one when you connect,
          and the connection is fixed to it.
        </li>
        <li>
          <strong>Touch your photos, your finances, or your account.</strong> Those are separate
          permissions the journal connection does not carry, and billing and account settings are
          not reachable by any assistant.
        </li>
      </ul>

      <h2>Turning it off</h2>
      <p>
        Go to <strong>Account → API keys → Connected apps</strong> and press{' '}
        <strong>Disconnect</strong>. The assistant immediately loses the ability to renew its access;
        anything it is already holding expires within the hour. You can reconnect later, and
        reconnecting replaces the old permission rather than adding a second one.
      </p>

      <h2>What the assistant&apos;s maker sees</h2>
      <p>
        Whatever passes through the conversation. If you ask it to log a restaurant, that name goes
        to them; if you ask what you did last month, the entries it reads go to them. That is
        inherent to using an assistant rather than something Tumbaland can prevent — the{' '}
        <Link href="/privacy">privacy page</Link> covers it, and their own policy governs what they
        do with it.
      </p>

      <h2>If something is not working</h2>
      <ul>
        <li>
          <strong>&quot;No matching tools found&quot;</strong> — the connector is not switched on for
          that conversation. See step 5.
        </li>
        <li>
          <strong>It says a type does not exist</strong> — it can only use the activity types your
          account has. It will list the real ones; pick from those, or add a new type in the app.
        </li>
        <li>
          <strong>It says it lacks permission</strong> — disconnect and reconnect, granting the
          permission it needs. Retrying will not help.
        </li>
      </ul>
    </DocumentPage>
  );
}

export default ConnectPage;
