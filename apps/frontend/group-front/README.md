# group-front

A microfrontend for managing family groups: list my groups, create groups, view details, invite members, and accept invites.

## Dev

- Env (Vite):
  - VITE_GROUP_API_URL
  - VITE_AUTH_SERVICE_URL
  - VITE_AUTH_FRONT_URL

- Start:
```
npm run dev --workspace=group-front
```

## Build and Docker
```
npm run build --workspace=group-front
```
Image serves a runtime `/config.json` derived from env via docker-entrypoint.
