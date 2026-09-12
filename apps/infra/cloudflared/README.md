# cloudflared (Cloudflare Tunnel)

Public ingress for tumbaland.eu that needs no forwarded router port and no public
home IP. cloudflared connects outbound to Cloudflare; Cloudflare proxies requests
for the tunnel's hostnames down those connections to `tumbaland-proxy`, which
routes by `Host` exactly as it does for direct traffic.

```
browser ──https──> Cloudflare edge ──tunnel──> cloudflared ──https──> tumbaland-proxy ──> service
         (CF cert)                  (outbound)  (host systemd)  (LE wildcard cert)
```

TLS terminates twice: once at Cloudflare's edge (their cert, on the proxied
hostname) and again at tumbaland-proxy (the existing Let's Encrypt wildcard). Keep
certbot — it renews over DNS-01 and never needed an open port 80.

**The connector is not deployed from this repo.** It runs on the Pi as the
`cloudflared` apt package under systemd, and its routing lives in the Cloudflare
dashboard, so there is no compose file here — this README is the record of how it
is configured. The host package needs no working deploy pipeline, which matters
when the reason for wanting a tunnel is that nothing can reach the Pi at all.

## Setup

1. **Create the tunnel.** Cloudflare dashboard > Zero Trust > Networks > Tunnels >
   Create a tunnel > Cloudflared, name it `tumbaland`, and copy the token out of
   the install command it shows (the long string after `--token`). This is a
   separate tunnel from visin's — one connector per host.
2. **Add public hostnames** on the tunnel's Configure > Public Hostnames tab. For
   each: subdomain + domain `tumbaland.eu`, service type **HTTPS**, URL
   `localhost:443`, then under Additional application settings > TLS enable
   **No TLS Verify** — the origin cert is valid for `*.tumbaland.eu` but the tunnel
   connects to the name `localhost`, so verification cannot match. Skipping this is
   the one mistake that looks like a healthy tunnel serving 502s; cloudflared logs
   `x509: certificate is valid for *.tumbaland.eu, tumbaland.eu, not localhost`.

   One entry per `server_name` in `apps/infra/tumbaland-proxy/conf.d/default.conf`:

   | Hostname | | |
   | --- | --- | --- |
   | `tumbaland.eu` (empty subdomain) | `auth.tumbaland.eu` | `payment.tumbaland.eu` |
   | `album.tumbaland.eu` | `auth-api.tumbaland.eu` | `payment-api.tumbaland.eu` |
   | `album-api.tumbaland.eu` | `account.tumbaland.eu` | `group.tumbaland.eu` |
   | `relationship.tumbaland.eu` | `file-service.tumbaland.eu` | `group-api.tumbaland.eu` |
   | `relationship-api.tumbaland.eu` | `api.tumbaland.eu` | `rabbitmq.tumbaland.eu` |
   | `finance.tumbaland.eu` | `mcp.tumbaland.eu` | `rabbitmq-metrics.tumbaland.eu` |
   | `finance-api.tumbaland.eu` | | `beszel.tumbaland.eu` |

   Saving a hostname replaces its DNS record with a proxied CNAME to
   `<tunnel-id>.cfargotunnel.com`. A subdomain you forget falls through to the
   tunnel's catch-all and answers 404 — while its stale A record keeps pointing at
   an unreachable home IP, which reads as "site down", not as a 404.

3. **Install the connector** on the Pi:

   ```sh
   sudo mkdir -p --mode=0755 /usr/share/keyrings
   curl -fsSL https://pkg.cloudflare.com/cloudflare-public-v2.gpg \
     | sudo tee /usr/share/keyrings/cloudflare-public-v2.gpg >/dev/null
   echo 'deb [signed-by=/usr/share/keyrings/cloudflare-public-v2.gpg] https://pkg.cloudflare.com/cloudflared any main' \
     | sudo tee /etc/apt/sources.list.d/cloudflared.list
   sudo apt-get update && sudo apt-get install cloudflared

   # Registers the tunnel as a systemd service and starts it
   sudo cloudflared service install <TOKEN>
   systemctl status cloudflared
   ```

   The token is a credential, not an identifier — anyone holding it can serve these
   hostnames. It lives only in the systemd unit; rotate it with "Refresh token" on
   the tunnel's configure page.

4. **Verify**: `dig +short album.tumbaland.eu` returns Cloudflare anycast IPs (not
   the home IP), the tunnel shows *Healthy*, a login round-trip works, and the
   RabbitMQ management UI still streams (websockets).
5. **Retire the ddns updater.** `apps/infra/cron` rewrites the `@`, `*` and `www` A
   records to the home IP on a short interval, which actively fights the tunnel:
   stop it (`docker compose -f ~/tumbaland/apps/infra/cron/compose.yml down`) before
   adding hostnames, then delete those three stale A records. Keep MX, TXT
   (SPF/DKIM/DMARC and verification), CAA — deleting those breaks email.
6. **Close the router ports** (80, 443). Rollback is: re-point the hostnames' DNS
   at the home IP (A records) and re-forward the ports.

## Edge limits that now apply

- **Request bodies are capped at 100 MB** (Free/Pro; 200 MB Business). Every host
  here is configured at or below `client_max_body_size 50M`
  (`file-service`; the rest inherit nginx's 1 MB default), so nothing needs chunking today. A future feature that
  raises a limit past 100 MB would have to upload in `Content-Range` chunks
  instead — the visin repo has a worked example of that.
- **Cloudflare returns 524 if the origin takes longer than 100 s** to start
  responding, and that is not raisable below Enterprise. Two hosts allow 300 s
  upstream reads — `file-service` and `mcp`. A request that runs past 100 s will
  surface as a 524 through the tunnel even though it works directly on the LAN. If that happens, the fix is async: return a
  job id immediately and poll, rather than holding the request open.
- **Stripe webhooks arrive through Cloudflare now** (`payment-api.tumbaland.eu`).
  Check that Bot Fight Mode is off, or add a WAF skip rule for the webhook path —
  a challenged webhook looks to Stripe like a failed delivery, and Cloudflare's bot
  heuristics have no reason to like a server-to-server POST. Signature verification
  is unaffected: Cloudflare does not rewrite request bodies.
- **Websockets work unchanged** — RabbitMQ's management UI and Beszel both stream
  fine through a tunnel.

## Notes

- `rabbitmq.tumbaland.eu`, `rabbitmq-metrics.tumbaland.eu` and
  `beszel.tumbaland.eu` are admin UIs on public hostnames. Gating them with
  Cloudflare Access (Zero Trust > Access > Applications, one-time PIN to your
  email) is a few clicks and removes them from the public internet entirely.
- Cloudflare's edge is now the source of the client IP: it sets `CF-Connecting-IP`
  and appends to `X-Forwarded-For`, and the tunnel adds a hop, so anything deriving
  a client address from `X-Real-IP` or a single-hop `trust proxy` setting now sees
  the connector rather than the user. That matters for per-IP rate limiting, which
  otherwise collapses into one shared bucket for all external traffic.
- The connector holds no state; reinstalling it is safe. Routing lives in the
  dashboard, so adding a hostname needs no deploy.
