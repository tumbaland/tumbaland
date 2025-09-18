# Update Server Host

Updates the `SERVER_HOST` GitHub repository variable with the current public IP.

## Prerequisites

- `GITHUB_TOKEN` in `.env` file with `repo` or `actions` scope

## Usage

```bash
./update-server-host.sh
```

## What it does

1. Gets public IP from ipify.org
2. Updates GitHub repo variable `SERVER_HOST` via API
3. Uses token from `.env` for authentication