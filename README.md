# Tumbaland Monorepo

## Workspace Layout

npm workspaces monorepo with three workspace groups:

- `apps/backend/*` — Express + MongoDB services (auth, album, finance, relationship, payment,
  group, file, public). Each service is a thin `routes → controllers → services → models` stack
  built on `@tumbaland/backend-core`.
- `apps/frontend/*` — Vite + React + MUI single-page apps, one per domain, plus `shell-front` which
  hosts the top-level shell/navigation. Each app owns a `ConfigProvider` (built on
  `@tumbaland/components`'s `createConfigProvider`) and its own domain services (built on
  `@tumbaland/frontend-core`'s `createApiClient`).
- `libs/*` — shared packages published to the other two groups:
  - `@tumbaland/backend-core` — backend: `createBaseApp`, auth/CORS/rate-limit/validation middleware,
    the typed `HttpError` hierarchy + `errorHandler`, `sendSuccess`/`sendError` response helpers,
    logger, metrics, tracing.
  - `@tumbaland/components` — frontend: shared React components (`AuthHeader`, `Loader`,
    `ErrorPage`, …), `createConfigProvider` (per-app dev/prod config loading + monitoring init),
    and the monitoring layer (`logger`, `captureException`/`captureMessage`, correlation IDs).
  - `@tumbaland/frontend-core` — frontend: `createApiClient` (generic authenticated fetch wrapper),
    `createAuthService`, `createGroupService` — factories each frontend instantiates with its own
    config accessor.

## Ports (local dev)

| Frontend | Port | | Backend | Port |
|---|---|---|---|---|
| shell-front | 3000 | | relationship-service | 4001 |
| relationship-front | 3001 | | album-service | 4002 |
| album-front | 3002 | | finance-service | 4003 |
| finance-front | 3003 | | auth-service | 5001 |
| auth-front | 3004 | | file-service | 5002 |
| payment-front | 3005 | | public-service | 5003 |
| group-front | 3006 | | payment-service | 5005 |
| account-front | 3007 | | group-service | 5006 |

AI services (album-front's photo analysis features) run separately: segmentation on `8001`,
object-detection on `8002`. See `.env.example` for the full variable list (`VITE_*` for frontends,
plain names for backend services).

## Quick Start

1. **Copy and configure environment variables:**
   - Copy `.env.example` to `.env` for each app root directory and fill in missing values.

2. **Start local development:**

   ```sh
   npm run dev
   ```

3. **Access the app:**
   - Main site: http://localhost:3000
   - Other services: see Nginx config for subdomains.

4. Enter Server
   ```sh
   ssh tom@192.168.0.131
   ```
