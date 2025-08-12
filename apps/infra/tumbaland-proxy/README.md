## tumbaland-proxy: Add Domain & Refresh Certificates

### Add a New Domain
1. Add a new `server` block to `conf.d/default.conf` for your domain, with correct `ssl_certificate` and `ssl_certificate_key` paths:
	 - Example:
		 ```nginx
		 server {
			 listen 443 ssl;
			 server_name newsub.tumbaland.eu;
			 ssl_certificate /etc/letsencrypt/live/newsub.tumbaland.eu/fullchain.pem;
			 ssl_certificate_key /etc/letsencrypt/live/newsub.tumbaland.eu/privkey.pem;
			 # ...
		 }
		 ```
2. Add the domain to the `DOMAIN_GROUPS` list in `refresh_certificates.sh` (one per line).

### Refresh Certificates (In-Container)
1. Enter the running proxy container:
	 ```sh
	 docker compose -f apps/infra/tumbaland-proxy/compose.yml exec tumbaland-proxy sh
	 ```
2. Run the refresh script:
	 ```sh
	 sh /app/refresh_certificates.sh
	 ```
	 - To refresh only a specific domain:
		 ```sh
		 sh /app/refresh_certificates.sh newsub.tumbaland.eu
		 ```
3. Nginx will reload automatically after certs are issued/renewed.

### Troubleshooting
- To test challenge path:
	```sh
	echo test > /usr/share/nginx/html/.well-known/acme-challenge/testfile
	curl -I http://newsub.tumbaland.eu/.well-known/acme-challenge/testfile
	```
- To check cert status:
	```sh
	ls -l /etc/letsencrypt/live/newsub.tumbaland.eu
	openssl x509 -in /etc/letsencrypt/live/newsub.tumbaland.eu/fullchain.pem -noout -dates -subject
	```

#### Reset a certificate (remove old files)
If issuance fails with messages like "live directory exists for <domain>", remove existing Let’s Encrypt files for that domain, then re-run the refresh script.

1) Enter the running proxy container:
```sh
docker compose -f apps/infra/tumbaland-proxy/compose.yml exec tumbaland-proxy sh
```

2) Remove the domain-specific files (replace DOMAIN with your subdomain, e.g., `group.tumbaland.eu`):
```sh
rm -rf /etc/letsencrypt/live/DOMAIN
rm -rf /etc/letsencrypt/archive/DOMAIN
rm -f /etc/letsencrypt/renewal/DOMAIN.conf
```

3) Re-issue the cert for that domain:
```sh
sh /app/refresh_certificates.sh DOMAIN
```

Nginx will reload automatically after certs are issued.

---
All certs and webroot are managed inside the container. No host path mapping needed.
