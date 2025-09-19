## tumbaland-proxy: Wildcard SSL Certificate Management

This proxy now uses a **single wildcard certificate** (`*.tumbaland.eu`) for all subdomains, generated using Cloudflare DNS challenge.

### Certificate Management

#### Refresh Wildcard Certificate
The system now generates one wildcard certificate that covers all `*.tumbaland.eu` subdomains.

1. **Set Environment Variable**:
   ```bash
   export CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
   ```

2. **Run Certificate Generation**:
   ```bash
   docker compose exec tumbaland-proxy sh /app/refresh_certificates.sh
   ```

3. **Automatic Renewal**: The certificate will auto-renew before expiration.

#### GitHub Actions Deployment
Set the `CLOUDFLARE_API_TOKEN` as a repository secret in GitHub, and the compose file will automatically use it. The credentials file is created dynamically at runtime.

### Add a New Subdomain
1. Add a new `server` block to `conf.d/default.conf`:
   ```nginx
   server {
       listen 443 ssl;
       server_name newsub.tumbaland.eu;
       ssl_certificate /etc/letsencrypt/live/tumbaland-wildcard/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/tumbaland-wildcard/privkey.pem;
       # ... proxy configuration ...
   }
   ```

2. **No certificate changes needed** - the wildcard certificate covers all subdomains automatically!

### Troubleshooting

#### Check Certificate Status
```bash
docker compose exec tumbaland-proxy sh
openssl x509 -in /etc/letsencrypt/live/tumbaland-wildcard/fullchain.pem -noout -dates -subject
```

#### Reset Wildcard Certificate
If issuance fails, remove existing certificate files:
```bash
docker compose exec tumbaland-proxy sh
rm -rf /etc/letsencrypt/live/tumbaland-wildcard
rm -rf /etc/letsencrypt/archive/tumbaland-wildcard
rm -f /etc/letsencrypt/renewal/tumbaland-wildcard.conf
# Then re-run: sh /app/refresh_certificates.sh
```

#### Environment Variable Issues
- Ensure `CLOUDFLARE_API_TOKEN` is set in your environment
- The token must have DNS edit permissions for the `tumbaland.eu` zone
- Check Cloudflare dashboard for API token permissions

---
**Migration Note**: This setup replaced individual certificates for each subdomain with a single wildcard certificate, reducing rate limit usage from 17 certificates to 1.
