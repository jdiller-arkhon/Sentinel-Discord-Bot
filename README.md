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
- `/status` — run inside a client channel to check connection health.
- `/help` — usage summary for the client.

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
- Test coverage doesn't yet reach the poller loop or the button-click
  handler directly (both depend on a live discord.js `Client`); the
  logic they call (`SentinelClient`, `embeds`, `activation`) is covered.