# Beszel

Host and container monitoring for the tumbaland Raspberry Pi. Two containers, ~15 MB of
RAM for the agent — chosen over the `apps/infra/{prometheus,grafana}` stack, which idles at
500–800 MB and on Pi-class hardware can burn more CPU than the containers it measures.

- **Hub** — web UI and metrics history, at <https://beszel.tumbaland.eu>
- **Agent** — reads Pi host stats plus per-container Docker stats

This is a separate hub from the visin Pi's — each Pi monitors itself and keeps its own
history. (The alternative, one hub watching both, would need the agent to listen on a LAN
TCP port instead of a unix socket.)

The agent has no listening TCP port: the hub reaches it over a unix socket shared
through `./socket`. Port 8090 is bound to `127.0.0.1` only, so the UI is reachable
exclusively through `tumbaland-proxy`.

`beszel.tumbaland.eu` needs no DNS or certificate work — it's covered by the existing
`*.tumbaland.eu` wildcard A record (`apps/infra/cron/update_dns.sh`) and wildcard cert.

## First deploy (one-time bootstrap)

> **Deploy beszel before tumbaland-proxy.** The proxy config now declares a
> `beszel-hub` upstream, and nginx refuses to start if it can't resolve an upstream
> host at boot — deploying the proxy first would take the whole site down until beszel
> exists.

The agent's `KEY` and `TOKEN` are issued by the hub, so the hub has to be running
before they exist. Until step 5 the agent won't be healthy, and the symptom differs:

- **Missing or malformed `KEY`** → the agent exits and restart-loops, logging
  `Failed to load public keys: ... ssh: no key found`.
- **Valid `KEY`, wrong `TOKEN`** → the agent runs fine and serves the hub over the
  socket, but logs `WebSocket connection failed err="unexpected status code: 401"`
  every ~10s. Harmless, but it won't stop until the token is correct.

1. Add empty `BESZEL_KEY` and `BESZEL_TOKEN` GitHub secrets (or skip — they'll just
   interpolate to empty), then run **Actions → Deploy Infrastructure Service → beszel**.

2. Deploy `tumbaland-proxy` too — its config gained the `beszel.tumbaland.eu` block.

3. Create the login account. **Beszel has no signup form**: the `users` collection's
   create rule is `null`, so only a PocketBase superuser can add users, and the
   collection's auth rule is `verified=true`. So this is two steps, not one.

   First create a superuser. The hub image is distroless (no shell), so exec the
   binary directly:

   ```sh
   docker exec tumbaland-beszel-hub /beszel superuser upsert you@example.com 'a-strong-password'
   ```

   That account works **only** on the PocketBase dashboard at
   <https://beszel.tumbaland.eu/_/> — not on the Beszel UI at `/`. Log in there, then go
   to **Collections → users → New record** and set:
   - **email** / **password**
   - **verified**: checked — login fails silently without it
   - **role**: `admin`

   Now log in to <https://beszel.tumbaland.eu> with *that* user (not the superuser).

   <details>
   <summary>Same thing without the GUI</summary>

   ```sh
   TOK=$(curl -s -X POST http://127.0.0.1:8090/api/collections/_superusers/auth-with-password \
     -H 'Content-Type: application/json' \
     -d '{"identity":"you@example.com","password":"a-strong-password"}' | jq -r .token)

   curl -s -X POST http://127.0.0.1:8090/api/collections/users/records \
     -H "Authorization: $TOK" -H 'Content-Type: application/json' \
     -d '{"email":"you@example.com","password":"another-strong-password",
          "passwordConfirm":"another-strong-password","verified":true,"role":"admin"}'
   ```

   Run this on the Pi — 8090 is bound to loopback, so it isn't reachable remotely.
   </details>

4. Click **Add System**. Set:
   - **Name**: `tumbaland-pi`
   - **Host / IP**: `/beszel_socket/beszel.sock`
   - **Port**: leave empty

   Copy the **public key** and **token** shown in that dialog.

5. Save them as the `BESZEL_KEY` and `BESZEL_TOKEN` GitHub secrets (repo → Settings →
   Secrets and variables → Actions), then re-run the beszel deploy. The agent picks
   them up and the system goes green in the hub.

   > **A local `.env` here will not work.** It's gitignored so it never reaches the Pi,
   > and the deploy runs `docker compose --env-file .env.infra`, which *replaces* the
   > default `.env` lookup rather than layering on top of it. A var missing from
   > `.env.infra` interpolates to empty — it does not fall back to `.env`. These two
   > values have to be GitHub secrets. A local `.env` is only useful if you run
   > `docker compose up` by hand from this directory with no `--env-file`.

   The secrets are per-repo, so these are *different* values from the visin Pi's
   secrets of the same name — each hub issues its own key and token.

## Troubleshooting

**System shows "down" in the hub.** Check the agent first:

```sh
docker logs --tail 20 tumbaland-beszel-agent
```

- `Failed to load public keys: ... ssh: no key found` → `BESZEL_KEY` is empty or
  malformed. Almost always means the GitHub secrets aren't set yet (step 5).
- `WebSocket connection failed err="unexpected status code: 401"` → `BESZEL_TOKEN`
  doesn't match the system's token. Re-copy it from the hub.
- Agent looks healthy but the hub still says down → confirm the system's **Host / IP**
  is exactly `/beszel_socket/beszel.sock` with **Port** empty, and that the socket
  exists and is shared: `ls -l ~/tumbaland/apps/infra/beszel/socket/` should show
  `beszel.sock`.

## Redeploys

Nothing manual — `Deploy Infrastructure Service → beszel` pulls and restarts both
containers. Metrics history lives in `./data` on the Pi and survives restarts.

## Notes

- **Version pinning**: images are pinned (`0.18.7`) to match the visin Pi's hub and the
  rest of `apps/infra`. Don't use Beszel's in-app updater; it would be undone by the next
  deploy. Bump the tag in `compose.yml` instead.
- **No agent healthcheck** on purpose: `/agent health` exits 0 even when the agent isn't
  listening, so it would always report healthy. Use the hub's system status instead.
- **Extra filesystems**: to chart another disk or partition, mount it read-only under
  `/extra-filesystems/<name>` in the agent service.
- **Alerts** (CPU, memory, disk, container down, system offline) are configured per
  system in the hub UI, not in this compose file.
