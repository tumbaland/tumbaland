## Certificate Renewal / Upgrade (tumbaland-proxy)

Minimal steps to (re)issue or renew Let’s Encrypt certificates for all subdomains.

### 1. Preconditions
* DNS A records for every domain point to this server.
* Container running: port 80 serves `/.well-known/acme-challenge/` (already in `default.conf`).
* Volumes mounted: `certs/*` and `html/` as in `compose.yml`.

### 2. Run Renewal (Safe Anytime)
Inside repo root:
```
docker compose -f apps/infra/tumbaland-proxy/compose.yml exec tumbaland-proxy sh /app/refresh_certificates.sh
```
Script is idempotent: unchanged, un‑expired certs are skipped; near‑expiry certs renewed; Nginx reloads.

### 3. First-Time Issue (If No Cert Yet)
Same command as above. Let’s Encrypt rate limits: avoid running repeatedly within minutes.

### 4. Add New Domain
1. Add server block to `conf.d/default.conf` with correct `ssl_certificate` paths (will exist after first run).
2. Append domain to `DOMAIN_GROUPS` in `refresh_certificates.sh` (one per line).
3. Re-run the script.

### 5. Check Status
```
docker compose -f apps/infra/tumbaland-proxy/compose.yml exec tumbaland-proxy ls -1 /etc/letsencrypt/live
```
Inspect expiry:
```
docker compose -f apps/infra/tumbaland-proxy/compose.yml exec tumbaland-proxy certbot certificates
```

### 6. Automate (Host Cron Example – Weekly)
```
0 4 * * 1 docker compose -f /PATH/apps/infra/tumbaland-proxy/compose.yml exec tumbaland-proxy sh /app/refresh_certificates.sh >> /var/log/tumbaland-cert.log 2>&1
```

### 7. Troubleshooting
| Problem | Action |
|---------|--------|
| 404 on challenge | Ensure `/.well-known/acme-challenge/` location intact and `html/` volume exists. |
| Renewal skipped | Not near expiry (<30 days). Force: remove domain dir in `live/` (only if you must) then rerun. |
| Nginx shows old cert | Reload failed? Check container logs. |
| Rate limited | Wait per LE docs or consolidate domains into fewer certs. |

### 8. Optional: Dry Run
```
docker compose -f apps/infra/tumbaland-proxy/compose.yml exec tumbaland-proxy certbot renew --dry-run
```

Done.
