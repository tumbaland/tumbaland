## Collage together

Two people edit one collage at the same time and see each other's changes as
they happen. Desktop first; phone support added as we go.

**How it works.** The editor keeps a whole collage in memory as now, but it is
saved as small changes (put this photo, remove that text, new layer order, new
background) rather than as the whole thing. The server applies each batch and
bumps the collage's `revision`. Two edits to the same photo: the later one wins
for that photo, nothing else is lost. Live updates reuse the SSE pattern from
chat-service rather than a WebSocket server or a CRDT library.

### Phase 1: autosave (one person at a time)

- [x] album-service: `revision` on the collage, `POST /collages/:id/changes`
      applying put / remove / order / settings ops, with a revision check so two
      writes cannot overwrite each other
- [x] album-front: diff the doc against what was last saved and send only the
      changes, a moment after each edit (not during a drag)
- [x] Undo and redo record what changed, not whole copies, so undo only ever
      reverses your own action
- [x] Save button gone: "Saved" / "Saving…" / "Not saved, retrying" in the toolbar;
      Back and closing the tab wait for, or warn about, unsaved changes
- [x] Older (v1) collages get item ids written once, on first open

### Phase 2: see each other

- [x] A live stream per collage in album-service (`GET /collages/:id/live`),
      mounted ahead of the rate limiter, with its own nginx location
- [x] Changes from the other person appear straight away; your own unsent
      changes stay on top of them until the server has them
- [x] Faces of who is in the collage now, in the toolbar
- [x] The other person's selection outlined in their colour, with their name
- [x] Reconnect checks the revision and fetches the collage if anything was missed
- [x] Collage title/subtitle edit (CollageEditModal) no longer sends the whole
      config; the subtitle goes as a small change
- [ ] Move the SSE plumbing (album-service `collageLive.ts`, chat-service
      `streamHub.ts`) into backend-core. Needs a backend-core release first,
      since services install it from npm
- [ ] Try it for real: two browsers on one collage, after deploying album-service,
      album-front and the proxy config

### Phase 3: see each other's movements

- [x] While someone drags, resizes or rotates, the other screen follows smoothly
      (positions ten times a second over `POST /collages/:id/moving`, not saved,
      eased between updates); a let-go item stays put until its save arrives
- [x] "Irja is moving this" on a photo someone else is holding
- [x] A drag's save goes out as soon as it is let go, not after the usual pause
- [x] Live editing requests (changes, presence, moving) have rate limits of
      their own, ahead of the general 300 per 15 minutes per address

### Phase 4: with the chat

- [ ] "Make a collage together" from a chat posts a card with a Join link
- [ ] Photos sent in the chat show up in the collage's photo tray
- [ ] Push notification: "Tom is working on your collage"

### Phone support (as we go)

- [ ] Toolbar and dialogs usable on a phone screen
- [ ] Pinch to resize and two-finger rotate on the canvas
