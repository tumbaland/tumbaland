# Deployment

All three deploy workflows (`deploy-single-service`, `deploy-all`,
`deploy-infrastructure`) are `workflow_dispatch`-only and split into two jobs:

| Job      | Runner                        | Does                                                         |
| -------- | ----------------------------- | ------------------------------------------------------------ |
| `build`  | `ubuntu-24.04-arm`            | Builds the arm64 image and pushes it to Docker Hub           |
| `deploy` | `[self-hosted, tumbaland-pi]` | On the Pi: writes the `.env`, `docker compose pull && up -d`  |

The deploy job runs **on the Pi**, because the runner dials out to GitHub. Nothing
at home has to be reachable from the internet — which is the point: the previous
scp/ssh deploy needed an inbound port and stopped working once the public IP was
no longer reachable. Ingress now arrives through a Cloudflare Tunnel
(`apps/infra/cloudflared/README.md`), and that carries HTTP(S) for published
hostnames only — never SSH.

Builds stay on a GitHub-hosted ARM64 runner so the Pi never pays for an image
build.

## Installing the runner on the Pi

Run as **the user that owns the deploy tree** (`~/tumbaland` — the account the old
deploys SSH'd in as, i.e. whatever `SERVER_USER` was) and make sure it is in the
`docker` group: the deploy job shells out to `docker compose` with no sudo.

Getting this wrong is the failure mode to watch for. If the runner runs as a
different user, `$HOME/tumbaland` is a *different, empty* directory, and the
deploy silently comes up against empty data paths — file-service's
`${FILE_DATA_PATH:-./data}` bind, tumbaland-proxy's `./certs`, consul's and
prometheus' `./data`.

1. GitHub → repo **Settings → Actions → Runners → New self-hosted runner**,
   architecture **ARM64**. Copy the registration token (it expires in ~1 hour).
2. On the Pi, as that user:

   ```sh
   mkdir -p ~/actions-runner && cd ~/actions-runner
   curl -o runner.tar.gz -L https://github.com/actions/runner/releases/download/v2.336.0/actions-runner-linux-arm64-2.336.0.tar.gz
   tar xzf runner.tar.gz
   ./config.sh --url https://github.com/toomastahves/tumbaland \
     --token <TOKEN> --labels tumbaland-pi --name tumbaland-pi --unattended
   id -nG        # must include docker
   ```

   The `tumbaland-pi` label is what `runs-on: [self-hosted, tumbaland-pi]`
   selects; it must differ from the visin Pi's label so jobs can't cross hosts.
3. Install it as a service, from an account with sudo (the deploy account may have
   no password — `svc.sh install` takes the target user as an argument precisely
   so it can be installed on its behalf):

   ```sh
   cd /home/<deploy-user>/actions-runner
   sudo ./svc.sh install <deploy-user>
   sudo ./svc.sh start
   sudo ./svc.sh status
   ```

   Don't use `./run.sh` for anything but a quick test — it dies with the SSH
   session and does not survive reboot.

The runner should show **Idle** on the Runners page. Logs:
`sudo journalctl -u 'actions.runner.*' -f`.

## Configuration

Still used:

- Secrets: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, and every application and
  infrastructure secret the `.env` steps write (`MONGODB_URI`, `JWT_SECRET`,
  `STRIPE_SECRET_KEY`, `ELASTIC_PASSWORD`, `CLOUDFLARE_API_TOKEN` — certbot's
  DNS-01 credential — …).
- Variables: the `*_URL` / `GOOGLE_*` / `COOKIE_DOMAIN` / `CORS_ORIGIN` set, and
  optionally `DEPLOY_ROOT` (defaults to `$HOME/tumbaland`).

No longer used, safe to delete once the first deploy succeeds: `SERVER_HOST`,
`SERVER_USER`, `SERVER_SSH_KEY`.

## Why compose is copied instead of run from the workspace

Compose files bind-mount **relative** paths — tumbaland-proxy's `./certs`,
consul's `./data` and `./server.json`, prometheus' `./data`, beszel's `./data` and
`./socket`, file-service's `${FILE_DATA_PATH:-./data}`. Those resolve against the
compose file's own directory, so running compose out of the runner workspace would
point every one of them at `_work/`, which the runner wipes between jobs:
certificates regenerated, datastores starting empty. The deploy job therefore
copies the compose file into `$DEPLOY_ROOT/<same relative path>` — exactly where
scp used to put it, beside the live data — and runs compose from there.

Note what is **not** copied, matching the old scp behaviour: sidecar config files
(`consul/server.json`, `prometheus/prometheus.yml`, `redis/redis.conf`) live on the
server and are not managed by the deploy. Editing one in the repo does not ship it.

## Security: never run untrusted code on this runner

A self-hosted runner executes workflow code on your home network. The deploy
workflows are `workflow_dispatch`-only, so only someone with write access can start
them, and `ci.yml` (which runs on `pull_request`) is GitHub-hosted throughout.

Keep it that way. **Do not** add `pull_request` — or any other trigger a fork can
reach — to a workflow whose job runs on `[self-hosted, tumbaland-pi]`. On a public
repo that is a remote shell on the Pi for anyone who opens a PR.
