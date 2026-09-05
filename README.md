# Sentinel-Discord-Bot

Self-hosted Discord bot that gives each paying Sentinel client their own
private channel to review and approve/reject AI strategy proposals,
without needing to open the Sentinel desktop app.

Open `preview.html` in a browser (or `git checkout` this repo and double-click
it) for an interactive, click-through mockup of what a client's channel
looks like and how each command runs — built from the bot's real
embed-rendering code, not hand-drawn.

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

### Admin commands

Beyond `/onboard` and `/clients` above:

- `/client-info channel:#...` — full single-client dossier: config, Sentinel
  URL, token-configured flag, activation state, failure count, proposal/audit
  counts, created date.
- `/update-client channel:#... [name] [sentinel_url] [sentinel_token]` — edit
  a client's config in place, no re-onboarding required.
- `/revoke channel:#... [reason]` — fully deactivates a client: stops
  polling, pulls their channel access, invalidates any outstanding
  activation code. Reversible via `/regenerate-code` or `/transfer-client`.
- `/regenerate-code channel:#...` — re-locks a channel and issues a fresh
  one-time activation code (lost/expired code, or moving the client to a
  new Discord account via self-serve claim).
- `/transfer-client channel:#... new_owner:@user` — reassigns an already-
  activated channel to a different Discord account directly (no code
  needed), swapping the permission overwrite.
- `/broadcast message:"..."` — sends an announcement embed to every
  activated client's channel at once; reports delivered/failed counts.
- `/poll-all` — forces an immediate full-fleet poll instead of waiting for
  the schedule; reports how many clients were checked and proposals posted.
- `/global-audit` — the last 15 approve/reject actions across *every*
  client, not just one channel — cross-client oversight.
- `/settings [poll_interval_seconds] [failure_threshold]` — view or change
  the poll interval and failure-alert threshold at runtime; takes effect on
  the very next poll tick, no restart (`src/runtimeSettings.js`).
- `/maintenance mode:<on|off> [reason]` — globally pauses (or resumes) all
  polling and automatically announces it to every active client's channel.
- `/admins action:<add|remove|list> [user]` — grants or revokes admin
  access at runtime, on top of the fixed `.env`-seeded `ADMIN_USER_IDS`
  list (which can only be changed by editing `.env` and restarting).
- `/security-log` — the last 20 security-relevant events: denied admin
  attempts, admin grants/revocations, client revoke/transfer/token-rotate/
  code-regenerate, maintenance toggles. See "Security" below.

### Moderation commands

Standard Discord server-administration tools, unrelated to the Sentinel
side of the bot entirely — gated on the invoker's actual Discord server
permissions (via `setDefaultMemberPermissions` so Discord hides them from
members without the permission, plus a runtime check in `authz.hasPermission`
as a backstop), not on `ADMIN_USER_IDS`/`/admins`. A server's own Moderator
role can use these without being a Sentinel admin, and vice versa.

- `/purge amount:<1-100> [user]` — bulk-delete recent messages in the
  current channel, optionally only one user's. *Manage Messages.*
- `/timeout user:@... minutes:<1-40320> [reason]` / `/untimeout user:@...` —
  mute/un-mute via Discord's native timeout. *Moderate Members.*
- `/kick user:@... [reason]` — remove a member; they can rejoin with an
  invite. *Kick Members.*
- `/ban user:@... [reason] [delete_message_days]` / `/unban user_id:<id>` —
  ban/unban; unban takes a raw ID since banned users aren't guild members
  anymore. *Ban Members.*
- `/warn user:@... reason:"..."` / `/warnings user:@...` — logs a warning
  to a local `warnings` table and DMs the target (failure to DM, e.g.
  closed DMs, doesn't block the warning being recorded), then lets a
  moderator review a member's history. *Moderate Members.*
- `/lock` / `/unlock` — stop (or restore) `@everyone` sending messages in
  the current channel. *Manage Channels.*
- `/slowmode seconds:<0-21600>` — set or clear the channel's slowmode
  delay. *Manage Channels.*

All of these check `member.moderatable`/`kickable`/`bannable` before
acting and report a clear "role hierarchy" error instead of letting
Discord's own API call fail opaquely.

## Security

- **Tokens encrypted at rest (optional).** Set `ENCRYPTION_KEY` (a 32-byte
  hex value) and every client's `sentinel_token` is AES-256-GCM encrypted
  before it's written to SQLite (`src/secretCrypto.js`), and transparently
  decrypted via `SentinelClient.forCustomer(customer)` — no call site
  needs to know or care whether encryption is configured. A random IV per
  write means two clients with the same token never produce the same
  ciphertext. Unset by default (tokens stored as given) so upgrading
  doesn't break an existing deployment; old plaintext values keep working
  once a key is later configured.
- **Security event log** (`src/securityLog.js`, a `security_events`
  table, viewable with `/security-log`) — distinct from the
  proposal-decision `audit_log`: every Sentinel-admin-gated command
  (`/onboard`, `/revoke`, `/admins`, `/maintenance`, `/update-client`,
  `/regenerate-code`, `/transfer-client`, `/settings`, `/broadcast`,
  `/poll-all`, `/clients`, `/client-info`, `/global-audit`) records a
  denied attempt via `authz.checkAdmin()` — the single choke point every
  one of them calls instead of `isAdmin()` directly — and the sensitive
  ones (admin add/remove, client revoke/transfer/token-rotate/
  code-regenerate, maintenance toggle) also log the action itself, not
  just denials.
- **Runtime admin management** (`/admins`) is itself an access-control
  surface worth calling out here: additions/removals take effect
  immediately without a restart, and the fixed `.env` seed list is
  deliberately *not* removable at runtime (only by editing `.env` and
  restarting) — so there's always at least one admin route that can't be
  locked out by a compromised runtime-added account.

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
- Test coverage doesn't yet reach the button-click handler or any
  command's `execute()` body directly — all depend on a live discord.js
  `Client`/`Interaction`; the logic they call (`SentinelClient`, `embeds`,
  `activation`, `authz`, `admins`, `runtimeSettings`, `secretCrypto`) is
  covered, and `pollAll`'s maintenance-mode short-circuit is tested
  directly. The moderation commands (`/purge`, `/timeout`, `/ban`, etc.)
  are new and entirely untested beyond a load/validate smoke check
  (every command's `SlashCommandBuilder` parses and every name is
  unique) — no test exercises their actual Discord-API call paths.
- `/settings`'s poll-interval change is picked up by the poller's
  self-rescheduling loop on the *next* tick, not instantly — the current
  tick (if one is in flight) still runs at the old interval.