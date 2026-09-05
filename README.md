# Sentinel-Discord-Bot

Self-hosted Discord bot that gives each paying Sentinel client their own
private channel to review and approve/reject AI strategy proposals,
without needing to open the Sentinel desktop app.

## How it works

- Runs as a normal persistent Node process on your server, connected to
  Discord's gateway (WebSocket) — no public HTTPS endpoint required.
- You (an admin) run `/onboard` after a client signs up: it creates a
  private channel visible only to them, and stores their Sentinel base
  URL + `X-Sentinel-Token` (see Sentinel's own `require_proposal_token`
  gate on `/ai/proposals*`) in a local SQLite DB.
- A poller checks every configured interval for each active client's
  pending proposals and posts them into their channel with
  Approve/Reject buttons.
- Clicking a button calls that client's own Sentinel instance and reports
  back honestly what happened (including the `applied: false` case for
  proposal types with no automatic apply path).
- Every approve/reject is written to a local audit log (Discord user id +
  username + timestamp), independent of Discord's own message history.
- Repeated poll failures for a client escalate to your own admin alert
  channel instead of only `console.error`, and auto-clear once the client
  recovers.

## Setup

```bash
npm install
cp .env.example .env   # fill in DISCORD_TOKEN, DISCORD_CLIENT_ID, GUILD_ID, etc.
npm start
```

## Commands

- `/onboard name:"Acme Trading" sentinel_url:https://... sentinel_token:...` —
  admin-only (see `ADMIN_USER_IDS`). Two modes:
  - Omit `client:` — self-serve. Creates a locked channel and a one-time,
    128-bit activation code (only its SHA-256 hash is stored, 7-day
    expiry). Hand the code to the client; they run `/activate` to claim
    the channel themselves.
  - Pass `client:@user` — activates immediately for a Discord account you
    already know, skipping `/activate`.
- `/activate code:<code>` — a client claims their pending channel. Rate
  limited: 5 failed attempts per Discord user in 15 minutes locks out
  further tries (checked before the code is even looked up), and every
  attempt (success or failure) is logged to `activation_attempts`.
- `/status` — run inside a client channel to check connection health (last poll
  time/result, consecutive failures, active/paused).
- `/pending` — poll Sentinel right now for that channel instead of waiting for
  the next scheduled cycle; reports how many new proposals it posted.
- `/history` — the client's 5 most recently approved/rejected proposals, pulled
  live from their own Sentinel instance (not cached locally).
- `/audit` — the bot's own local record of who approved/rejected what in this
  channel and when, independent of both Sentinel and Discord's message history.
- `/pause` / `/resume` — stop or restart new proposals posting to this channel
  without deleting the channel or its history; `/resume` also clears any
  stale failure-alert state left over from before the pause.
- `/clients` — admin-only. One-line status per onboarded client (channel,
  activation state, active/paused, current failure count) without querying
  the DB by hand.
- `/help` — usage summary for the client.

All of `/pending`, `/history`, `/audit`, `/pause`, and `/resume` are restricted
to the channel's own client (or an admin) — the same ownership check the
Approve/Reject buttons use (`src/authz.js`).

## Visual design

Every reply the bot sends is a Discord embed (`src/embeds.js`), not plain
text, so the whole bot reads as one consistent product:

- **Proposal cards** — the main artifact clients see. Strategy-specific
  emoji + title (📈 Momentum, 🔄 Mean-Reversion, 💡 New Strategy), a
  status-colored left bar (amber = pending, green = approved, grey =
  rejected), proposed params rendered as a monospaced, column-aligned
  table instead of a raw JSON dump, a 10-segment confidence bar
  (`▰▰▰▰▰▰▰▱▱▱ 68%`), and a `Sentinel · Proposal #abcd1234` footer with
  the real timestamp — never a raw UUID or a bare params object shown to
  a client.
- **Approve/Reject buttons** carry their own ✅/⛔ emoji, and clicking one
  appends a small result embed under the original proposal card (rather
  than replacing it), so the full context stays visible after a decision.
- **Every other command** (`/status`, `/history`, `/audit`, `/clients`,
  `/help`, onboarding/activation confirmations) shares the same
  `infoEmbed()` builder and color palette (green = success, amber =
  caution, red = error/unauthorized, grey = neutral/paused), so a client
  never sees a mix of rich cards and flat text.

## Testing

- `npm test` — unit tests (embed truncation, HTTP retry/backoff, the
  activation/lockout logic) run against a real temp SQLite file, no
  Discord or network involved.
- `node test/live-integration-manual.js` — opt-in, not part of `npm test`.
  Runs the bot's real, unmocked `SentinelClient` and embed builder
  against an actually-running Sentinel backend: a live `X-Sentinel-Token`
  401/success round trip, a genuine large-`proposed_params` proposal
  through the real embed builder (proving the 1024-char truncation holds
  against real API JSON, not a synthetic fixture), and a real
  approve → already-approved 400. Requires a running Sentinel instance
  with at least one pending proposal:
  ```bash
  SENTINEL_URL=http://127.0.0.1:8765 SENTINEL_TOKEN=... node test/live-integration-manual.js
  ```

## Known gaps (tracked, not yet done)

- No fully live end-to-end run yet against a *real Discord* server (a
  real bot token + guild) — only unit tests plus the real-Sentinel-HTTP
  integration script above. Discord's gateway/REST behavior (rate
  limiting, permission scopes, button interactions) is exercised by
  discord.js's own tested code paths but hasn't been verified live in
  this environment, since that requires a Discord bot token and test
  server this environment doesn't have.
- Test coverage doesn't yet reach the poller loop, button-click handler,
  or any of the new commands' `execute()` bodies directly — all depend
  on a live discord.js `Client`/`Interaction`; the logic they call
  (`SentinelClient`, `embeds`, `activation`, `authz`) is covered.