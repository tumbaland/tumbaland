# Cloudflare DNS Updater

Updates 3 DNS records for tumbaland.eu to your current public IP.

## Setup

1. Get API token from [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
2. Edit `.env`: `CLOUDFLARE_API_TOKEN=your_token_here`

## Usage

```bash
./update_dns.sh
```

## Records Updated

- `*.tumbaland.eu`
- `tumbaland.eu`
- `www.tumbaland.eu`
