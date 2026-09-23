- [ ] **The local MongoDB data lives inside the checkout**
      (`apps/infra/mongodb/data`, gitignored). `git clean -fdX` deletes it. Move it
      outside the repo or into a named Docker volume, and copy the existing data
      across when switching.

- [ ] **Large files, worth splitting when next touched:**
      `album-service/src/services/photoService.ts` (655),
      `mcp-service/src/tools/finance.ts` (649),
      `auth-service/src/controllers/oauthController.ts` (593).
