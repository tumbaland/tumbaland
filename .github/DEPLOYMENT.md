# Deployment

## Releases

A merge to `main` is the release: `release.yml` runs on push, builds an image for
every service that changed and deploys them to the Pi. It runs no tests, because
`main` only takes pull requests that passed `ci.yml`. See the README's "Commits &
Releases" for the whole flow, and `release.yml` for the stages.

Run by hand (Actions → Release) it does the same, with an optional version and a
`skip-deploy` switch. It only runs from `main`, and it always cuts a new version,
even when no commit is new.

### Pausing

A merge deploys the apps and never the infrastructure (`apps/infra` is not in the
release plan, and `deploy-infrastructure.yml` is run by hand). So the case to plan
for is an app change that needs an infrastructure change first, or after. Three
ways to pause, from narrowest to widest:

| To hold                                  | Do this                                                                                                   |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| One pull request                         | Make it a draft, or convert an open one to a draft. GitHub will not merge a draft by any route. Mark it ready to go on: CI runs again, and the `merge` job with it. |
| Infra or breaking changes, automatically | Nothing. The `merge` job in `ci.yml` does not merge a PR that touches `apps/infra` or is a `type!:` change. You merge it. |
| Everything that is already merged        | Actions → **Release** → ⋯ → **Disable workflow**. Merges still land, nothing deploys.                    |

**An infrastructure change that the apps depend on:**

1. Open the PR. It is not auto-merged.
2. Run **Deploy Infrastructure** (Actions → Run workflow) and pick the PR's *branch*,
   not `main`. Look at the result on the Pi.
3. Merge the PR. The release deploys the apps, now against the infrastructure they
   expect.

**The other order** (the apps first, then infrastructure): merge, let the release
finish, then run Deploy Infrastructure from `main`.

**Disabling Release** is the wide switch, for a maintenance window or when several
merges must land before anything ships. It is the Actions UI's own switch, so there
is no variable to forget to flip back, and the Actions tab shows it as disabled.
Enable it again and run **Release** by hand: it diffs against the last
`app-deployed-v` tag, so everything merged in the meantime goes out as one release.
Nothing is lost, and nothing deploys until you do that. Because a disabled workflow
fails silently, do not leave it that way: merged changes are not live.

### When a deploy fails

Every release is built from its own `app-vX.Y.Z` tag and pushes immutable images
tagged `X.Y.Z`, so the deploy can be repeated without building again.

| What happened                                  | What to do                                                                                      |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Runner offline, Pi unreachable, one-off hiccup | Open the failed run → **Re-run failed jobs**. Same version, no rebuild, no new tag.             |
| One image failed to build                      | Same: re-running failed jobs rebuilds only that image, then deploys.                            |
| The new image itself is broken                 | Fix forward with a PR. The next release builds everything since the last `app-deployed-v` tag.  |
| It must be back to the old version now         | **Rollback** workflow, below.                                                                   |

A deploy goes one service at a time and stops at the first one that does not reach
`running`. Services before it are already on the new version, those after are not,
so a failed deploy leaves a mixed state until it is re-run. The release has no
`app-deployed-v` tag until the deploy finishes, which is what makes the next run
carry it forward.

Not caught: a container that reaches `running` and falls over a minute later. Look
at the Pi, or the service's own health, after a deploy that touched something
important.

### Rolling back

Actions → **Rollback** → Run workflow:

- **version**: the release to return to, as it appears in `CHANGELOG.md` (`0.0.521`).
- **services**: `changed` (the default), a list such as `chat-service,chat-front`, or `all`.

`changed` is what you want almost every time: only the services whose code differs
between that release and the newest one are touched. `all` goes through every
service, and a service whose tag differs from the one it was started with can be
restarted for nothing.

It builds nothing and cuts no version. For each service it finds the newest image
tagged at or before that version and puts the service back on it. The step summary
lists what it chose before anything on the Pi is touched.

That "at or before" matters: a release only builds the services that changed, so a
service has a tag for a version only if that release rebuilt it. Going back to
`0.0.521` puts a service last rebuilt at `0.0.517` on its `0.0.517` image, which is
the code it had at `0.0.521`.

What to know before using it:

- **Roll back together.** A change that touched a service and its frontend needs both
  put back, or they disagree about the API. `changed` does that: it takes everything
  that differs, not just the service you suspect.
- **The database is not rolled back.** Older code runs against whatever the newer
  code wrote. A change that migrated or reshaped data may not run on the old image.
- **It is only half the fix.** The commit that broke things is still on `main`, and
  the next change to that service builds it into a new release and ships it over the
  rollback. Revert it with a pull request straight away: the revert releases like any
  other change, and that is what makes the rollback permanent.
- **It is not recorded.** No tag, no version. The release plan still thinks the last
  release is what runs, which is why a service you rolled back is not redeployed
  until it changes.
- **Only what Docker Hub still has.** The newest 10 release tags per service are kept
  (`DOCKERHUB_RETAIN` in `release.yml`). A service that has no image that old makes
  the run fail before it touches anything, with the service named.
- **It queues behind a running release or deploy**, on the same lock. Cancel the
  release first if the point is to stop it shipping.

By hand, if the workflow itself is unavailable, on the Pi in `$DEPLOY_ROOT`
(default `~/tumbaland`), with a tag that exists for **that service**
(`docker manifest inspect` or Docker Hub will tell you):

```sh
IMAGE_TAG=0.0.517 docker compose --env-file .env.app \
  -f apps/backend/chat-service/compose.yml up -d
```

`IMAGE_TAG` is not remembered. A later `docker compose up -d` without it falls back
to `latest`, which silently undoes this.

### Deploying by hand, without a release

`deploy-single-service.yml` and `deploy-all.yml` (Actions → Run workflow) build
the chosen branch and deploy it as `:latest`. They share the `tumbaland-deployment`
lock with the release deploy, so they queue behind it.

They do not run the release plan, cut a version, tag anything or write
`app-deployed-v`. They also build whichever branch is selected, so they are a way
around the pull request gate on purpose: use them for a service the release left
alone, or for an emergency, and not as the usual path.

### The ruleset

**Not active today.** Branch protection and rulesets on a private repository need a paid
plan (GitHub Team for an organization, Pro for a personal account) or a public repository,
and GitHub refuses to create one otherwise. Until then the `merge` job in `ci.yml` is the
only gate: it merges only after `ci-passed`, and nothing stops a person merging by hand
earlier. This file is what to import once that changes.

`.github/rulesets/main.json` is what makes `main` take only pull requests. It
requires the `ci-passed` check (the title check is part of it), allows squash merges only, and
blocks deleting or force-pushing the branch. Import it once under
**Settings → Rules → Rulesets → New ruleset → Import a ruleset**.

The release workflows push to `main` themselves, for the version bump, the
changelog and the re-pinned library consumers. The ruleset lists the GitHub
Actions app as a bypass actor for exactly that. If a release ever fails on
`git push` with a "protected branch" or "required status checks" error, the
bypass is not applying: either add the app under the ruleset's bypass list by
hand, or give the workflow a token that can bypass (a GitHub App installation
token), which is the supported route when the first does not take.

## Manual deploys

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
`${FILE_DATA_PATH:-./data}` bind, tumbaland-proxy's `./certs`, prometheus'
`./data`.

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
prometheus' `./data`, beszel's `./data` and `./socket`, file-service's
`${FILE_DATA_PATH:-./data}`. Those resolve against the
compose file's own directory, so running compose out of the runner workspace would
point every one of them at `_work/`, which the runner wipes between jobs:
certificates regenerated, datastores starting empty. The deploy job therefore
copies the compose file into `$DEPLOY_ROOT/<same relative path>` — exactly where
scp used to put it, beside the live data — and runs compose from there.

Note what is **not** copied, matching the old scp behaviour: sidecar config files
(`prometheus/prometheus.yml`, `redis/redis.conf`) live on the
server and are not managed by the deploy. Editing one in the repo does not ship it.

## Security: never run untrusted code on this runner

A self-hosted runner executes workflow code on your home network. The manual
deploy workflows are `workflow_dispatch`-only, and `release.yml` runs on a push
to `main` or a dispatch: both need write access to start, and a push to `main`
only happens by merging a pull request that passed CI. `ci.yml` (which runs on
`pull_request`) is GitHub-hosted throughout.

Keep it that way. **Do not** add `pull_request` — or any other trigger a fork can
reach — to a workflow whose job runs on `[self-hosted, tumbaland-pi]`. On a public
repo that is a remote shell on the Pi for anyone who opens a PR. The same goes
for loosening the ruleset: a push to `main` is what starts a deploy.
