# Issue 30 Messaging

## Status

Implementation in progress for issue #30, "social, isn't it?".

## Decisions

- Messaging uses existing authenticated users and session cookies.
- Inbox is conversation-oriented, not a flat message-only list.
- Drafts are persisted server-side and can be edited, deleted, or sent later.
- Shared book, review, and wishlist content stores a snapshot so later local edits do not rewrite old messages.
- "Review" maps to the current notes feature until a dedicated reviews model exists.
- No websocket or push notification support in this phase.

## Implementation Notes

- Backend adds `message_threads`, `messages`, and `message_drafts` tables in SQLite initialization.
- Backend adds `/api/messages` routes behind `requireAuth` for listing threads, reading a thread, sending messages, managing drafts, sending drafts, and marking received messages read.
- Frontend adds message types/API helpers, a Messages page, a reusable compose modal, sidebar navigation, and share actions from reader profile, book detail, notes, and wishlist.
- Access control must keep every thread, message, and draft scoped to the current authenticated user.

## Verification

- Run `npm run build`.
- Smoke test two-user flow: user A sends, user B reads/replies, drafts persist, send/delete draft works.
- Confirm inactive/deleted recipients cannot receive new messages.
- Confirm users cannot access another user's drafts or conversations.
