# Chat: what is left

Built and tested: `chat-service` (181 tests), `chat-front` (175 tests), and the shell's
service worker and push (286 tests). All three lint clean, typecheck clean and building.

What works: live send and receive, idempotent send with retry, photos and video with
thumbnails and a full-screen viewer, reactions with a searchable emoji picker, typing
indicators, unread counts and an app-icon badge, paging back through history, and Web Push
notifications on an installed phone.

This file is now only the work that remains, in the order it matters for two people using
it every day.

---

## 1. The first week of real use

Each of these is something that will be wanted within days, roughly in the order it will
come up.

### 1.1 Unsend a message

The backend and `useChatThread` both support editing and deleting. No UI calls either, so
a message sent to the wrong person or with the wrong word stays.

- [ ] Long press (or hover, on a desktop) opens a small menu on your own messages: Edit,
      Delete, Copy. The long-press handler already exists in `MessageBubble` for
      reactions; this shares it.
- [ ] Editing puts the text back in the composer with a "save" state rather than opening a
      dialog.

### 1.2 The read receipt is wrong

`readBy` in `useChatThread` accumulates names and is never cleared, so once she has read
anything it says "Read by Irja" under everything, including messages she has not seen. A
receipt that is always on is worse than none.

- [ ] Track the read cursor per person (`lastReadMessageId` is already in the `read`
      event) and show the tick on the newest message at or before it, rather than a line
      under the whole thread.

### 1.3 Replying to a specific message

`replyTo` works end to end in the API, the model and the stream. Nothing in the UI sets or
shows it. With two people this matters more than it sounds: answering something from an
hour ago is otherwise ambiguous.

- [ ] Swipe right on a bubble (or the same long-press menu) sets a reply.
- [ ] A preview strip above the composer, dismissible.
- [ ] The quoted line inside the bubble, tapping which scrolls to the original.

### 1.4 Messages typed with no signal

Nothing is queued. A message composed on the underground is marked failed and is lost on
reload, because the outbox is in memory.

- [ ] Persist the outbox (`useChatThread`'s `outbox` ref) to IndexedDB and flush it on
      reconnect. The `clientId` already makes a replay safe, so this is storage rather
      than new protocol.

### 1.5 Searching your own history

`chatApi.search` and the service route exist, with a text index. No UI.

- [ ] A search field in the conversation header, results as a list, tapping one jumps to
      that message in context.

---

## 2. Worth doing once it is in daily use

- [ ] **Share to Tumbaland from the phone's share sheet** (the old Phase 8). Android only:
      Safari does not implement Web Share Target, so on iOS the in-app picker stays the
      way in. Needs `share_target` in the manifest, a `fetch` handler in `sw.js` to catch
      the POST, and a `/chat/share` route that shows a preview and sends on confirm.
- [ ] **Hide message text in notifications**, per device. The natural home is the
      `PushSubscription` row, since a phone on the kitchen table and a laptop want
      different answers.
- [ ] **A chat card on the home page.** Check it against the daily-visit test first: it
      earns a place only if it shows something worth opening the app for, not just that
      messages exist.
- [ ] **Day grouping in the conversation list**, and a "you" prefix on a preview of your
      own last message. Small, and it is what makes a list scannable.

---

## 3. Known limits, written down rather than fixed

- **Single replica.** The SSE subscriber set lives in memory, so chat-service cannot run
  two containers without a pub/sub bus in front of `publishToGroup`. Every service here is
  already single-replica, so this changes nothing today.
- **Push is a nudge, not delivery.** Both platforms drop notifications for a backgrounded
  PWA under memory pressure, iOS more than Android. The unread count in the app is the
  source of truth, and nothing is built to assume a notification arrived.
- **iOS needs the app installed.** Web Push does not work in a Safari tab. The settings
  toggle says so rather than claiming the browser is unsupported.
- **No end-to-end encryption**, deliberately. It would rule out server-side search, push
  previews, and adding a device without a key transfer. The privacy page should say so
  plainly rather than leaving it implied.
- **A stream holds its group membership for up to 30 minutes.** Membership is re-read on
  every ordinary request, but an open SSE connection keeps the set it authenticated with;
  the connection is recycled on that interval to bound it.

---

## 4. Two things owed to the rest of the repo

Both are deferred for the same reason: a Docker build installs `@tumbaland/*` from the
registry, so anything added to a library's source only reaches production after that
library is released.

- [ ] **Move the file-service client into `@tumbaland/backend-core`.** chat-service has its
      own lean version built on the global `fetch`; album-service has an older one on the
      `http` module. Two copies is one too many, and the lift belongs in the same batch as
      the next backend-core release.
- [ ] **Move Chat's accent colour into `moduleAccent`.** It sits in
      `shell-front/src/config/apps.ts` as `CHAT_ACCENT` with a comment, and belongs in
      `@tumbaland/frontend-core`'s tokens with every other module's, on the next release.
