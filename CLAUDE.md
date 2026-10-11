# Working in Tumbaland

The README covers the layout and local setup. This is how a change gets from a
branch to production here, because most of that is automatic and the parts that
are not are easy to miss.

## Getting a change onto `main`

Nothing is pushed to `main`, even where nothing would stop you. Every change is
a pull request:

1. Branch from an up to date `main`: `type/short-name` (`fix/chat-badge`).
2. Commit as conventional commits. The history inside a branch does not matter,
   it is squashed.
3. Before pushing, run the checks for what you touched, so CI is not the first
   place it fails:
   `npm run typecheck --workspace=<name>` and `npm test --workspace=<name>`
   (`shell-front`, `chat-service`, `@tumbaland/frontend-core`, ...). `npm run lint`
   is repo-wide.
4. Push and open the PR with `gh pr create --title "<conventional title>" --body "..."`.

**The PR title becomes the commit on `main`**, and the version bump and
`CHANGELOG.md` are built from it: `type(scope): description`, with `feat`, `fix`,
`docs`, `style`, `refactor`, `test`, `chore` or `perf`. The CI title check rejects
anything else. Write it as what the change does, not what you did.

### What happens next, without anyone clicking

- The `merge` job in `ci.yml` waits for `ci-passed` and then squash merges the PR. That
  check includes the title.
- **That job is the only gate.** The repository is private on a plan with no branch
  protection, so GitHub will not stop a merge by itself, from the button or from
  `gh pr merge`. Never merge while CI is still running, and never use
  `gh pr merge --auto` here: with nothing required it merges at once.
- A merge to `main` starts `release.yml`: it publishes changed libraries, cuts the
  version, builds the changed services and deploys them to the Pi.

So **a merged PR is a production deploy.** Do not open a PR for something that is
not meant to ship yet.

### Holding a change back

- **Draft PR.** GitHub will not merge a draft by any route. This is the pause for
  one change. CI runs on a draft's pushes, so it is tested while it waits, and
  marking it ready does not run the suites again: it reuses that run for the
  same commit and goes straight to the merge. (A PR opened ready, or one whose
  last run failed, still runs them.) Do not toggle draft and ready to "retest":
  every push is a full run, and the toggle itself starts a job.
- **Infrastructure and breaking changes are not merged by the job**: a PR touching
  `apps/infra`, or with `type!:` in the title or a `BREAKING CHANGE` footer. They
  are left for the owner, because they may need something done on the Pi first.
  Say so when you open one, and say what has to happen in what order.
- Infrastructure is never deployed by a merge. `deploy-infrastructure.yml` is run
  by hand and can be pointed at the PR's branch, which is how it goes first.

After opening a PR, watch it (`gh pr checks <number> --watch`), and after it
merges, watch the release (`gh run list --workflow release.yml --limit 1`, then
`gh run watch`). Report what shipped, as a version number, or what failed and
where. A green merge is not the end of the job.

If a deploy fails, **re-run the failed jobs** of that run: same version, no
rebuild. If the change itself is broken and fixing it will take long, use the
**Rollback** workflow, and then revert the commit on `main` with a PR. See
`.github/DEPLOYMENT.md`.

## Release notes for the people who use the app

Whatever your partner would notice gets one file in
`apps/frontend/shell-front/src/release-notes/`, added **in the same PR** as the
change: `YYYY-MM-DD-short-slug.json`, dated the day you open the PR.

```json
{ "date": "2026-10-11", "items": ["Collages can be zoomed"] }
```

- Visible change, new or fixed: add one. Refactor, tooling, tests, dependency
  upgrade, anything nobody would notice: add none.
- Write it as a person would say it to them: short, plain, no em dashes, no
  marketing words. "You can send documents in a chat", not "Introduces document
  upload capabilities". Describe what changed for them, not how.
- One line per thing. Never edit an existing file to add to it; a new change is a
  new file. That is what keeps two open PRs from conflicting.
- Do not copy the commit subject. `CHANGELOG.md` is the developer log, this is
  not.

The Account menu shows them under "What's new", and the dot on Account says there
is something unseen.

## Libraries

`libs/backend-core`, `libs/frontend-core` and `libs/collage-core` are npm packages that every image
installs from the registry. Change them in a PR like anything else. Merging
publishes them and re-pins their consumers; that is what the `chore(release)`
commits are. Never edit a library's `package.json` version or run `npm publish`.

## More

- `README.md`: layout, ports, local setup, and the same flow in more detail.
- `.github/DEPLOYMENT.md`: the Pi, deploys, pausing, retry and rollback.
- `.github/rulesets/main.json`: what is required to merge.
- `.github/workflows/ci.yml`: everything that runs on a PR is a job in this one
  workflow, on purpose, so a PR is one row per event in the Actions list.
