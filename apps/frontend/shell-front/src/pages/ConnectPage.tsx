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
          Claude, ChatGPT or Gemini. Anything that supports connectors, sometimes called MCP
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
          Approve the permissions screen. It shows exactly what the assistant is asking for, and
          lets you tick which journals it may act on: your own data, any group you belong to, or
          several. You also pick which one to use when you do not say.
        </li>
        <li>
          <strong>Turn it on in the conversation.</strong> In a chat, press <strong>+</strong> →{' '}
          <strong>Connectors</strong> and switch Tumbaland on. This is per conversation. Adding the
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
      <p>
        Sixteen things, and nothing else. Which of them it gets depends on what you approved. Grant
        the journal only and it never learns the money tools exist.
      </p>

      <h3>Your journal</h3>

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
              Reads the kinds of thing your account records: Dining, Movies, Together and so on.
              Entries have to be filed under one of these, so it checks first.
            </td>
          </tr>
          <tr>
            <td>
              <code>get_day</code>
            </td>
            <td>
              Reads back everything logged on one day. Also how it finds the entry you mean when you
              ask it to change something.
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
              <code>edit_activity</code>
            </td>
            <td>
              Changes one entry: a description, the hours, the day, the type. Only the parts you
              ask about change, and it tells you what it changed and what it was before.
            </td>
          </tr>
          <tr>
            <td>
              <code>delete_activity</code>
            </td>
            <td>
              Removes one entry, and says what it removed. There is no undo, so it should only ever
              happen when you asked for it.
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

      <h3>Your money</h3>
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
              <code>get_net_worth</code>
            </td>
            <td>
              What everything adds up to, how it has moved over the last month and year, and how it
              is split across asset classes.
            </td>
          </tr>
          <tr>
            <td>
              <code>get_spending</code>
            </td>
            <td>
              Month-by-month income, spending and what was saved, plus the categories the money
              went to.
            </td>
          </tr>
          <tr>
            <td>
              <code>search_transactions</code>
            </td>
            <td>
              Individual payments, narrowed by date, category, direction or text. The text search
              covers the statement line, so searching a shop name finds it.
            </td>
          </tr>
          <tr>
            <td>
              <code>list_recurring_payments</code>
            </td>
            <td>What is paid on a schedule: subscriptions, rent, insurance.</td>
          </tr>
          <tr>
            <td>
              <code>get_spending_trends</code>
            </td>
            <td>
              Income and spending by year, which categories moved, and how much went into savings
              rather than out the door.
            </td>
          </tr>
          <tr>
            <td>
              <code>get_portfolio</code>
            </td>
            <td>
              Every position held, valued at the latest price: what it cost, what it is worth now,
              and the gain.
            </td>
          </tr>
          <tr>
            <td>
              <code>log_trade</code>
            </td>
            <td>Records a buy, sell, dividend or fee.</td>
          </tr>
          <tr>
            <td>
              <code>recategorise_transactions</code>
            </td>
            <td>
              Moves every transaction in one category to another. Changes many rows at once, so it
              should tell you how many before doing it.
            </td>
          </tr>
        </tbody>
      </table>

      <Alert severity="info" sx={{ my: 3 }}>
        <Typography variant="body2">
          <strong>It cannot record a one-off expense.</strong> Transactions come from importing a
          bank statement, and there is no way to type one in. Not through an assistant, and not in
          the app. Ask it to log a trade and it can; ask it to log a coffee and it should tell you
          it cannot rather than inventing something.
        </Typography>
      </Alert>

      <h2>What it cannot do</h2>
      <ul>
        <li>
          <strong>Reach anything you did not approve.</strong> Permissions are granted per
          connection, and the assistant is only shown the tools those permissions cover. If you
          grant reading but not writing, the tools that write are not offered to it at all.
        </li>
        <li>
          <strong>Reach anything you did not tick.</strong> When you connect, you choose which
          journals it may act on: your own, a group&apos;s, or both. One of them becomes the
          default. It cannot reach any other, and asking for one by name fails rather than quietly
          falling back.
        </li>
        <li>
          <strong>Touch anything you did not grant.</strong> Photos have no tools at all yet, and
          the journal and money permissions are separate. An assistant granted one is never shown
          the other's tools. Billing and account settings are not reachable by any assistant.
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
        inherent to using an assistant, not something Tumbaland can prevent. The{' '}
        <Link href="/privacy">privacy page</Link> covers it, and their own policy governs what they
        do with it.
      </p>

      <h2>If something is not working</h2>
      <ul>
        <li>
          <strong>&quot;No matching tools found&quot;.</strong> The connector is not switched on for
          that conversation. See step 5.
        </li>
        <li>
          <strong>It says a type does not exist.</strong> It can only use the activity types your
          account has. It will list the real ones; pick from those, or add a new type in the app.
        </li>
        <li>
          <strong>It writes to the wrong journal.</strong> If you granted more than one, say which
          one you mean (&quot;log this in Irja &amp; Tom&quot;). It uses the default you picked
          otherwise.
        </li>
        <li>
          <strong>It says it lacks permission.</strong> Disconnect and reconnect, granting the
          permission it needs. Retrying will not help.
        </li>
        <li>
          <strong>It offers to rewrite a whole day to fix one entry.</strong> It should not need
          to. Ask it to read the day first, then change just that entry.
        </li>
      </ul>
    </DocumentPage>
  );
}

export default ConnectPage;
