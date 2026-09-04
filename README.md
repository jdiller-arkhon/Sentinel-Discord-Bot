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

- `/onboard client:@user name:"Acme Trading" sentinel_url:https://... sentinel_token:...` —
  admin-only (see `ADMIN_USER_IDS`). Creates the client's private channel.
- `/status` — run inside a client channel to check connection health.
- `/help` — usage summary for the client.

## Known gaps (tracked, not yet done)

- No self-serve `/activate` flow — onboarding is always admin-initiated
  today, which sidesteps needing a public activation-code brute-force
  defense, but means you're a manual step in every signup.
- Never yet run end-to-end against a live Sentinel instance and a real
  Discord server in the same test — only unit-tested (`npm test`) so far.
- Test coverage is limited to the embed-truncation and HTTP-retry logic;
  the poller, onboarding, and button-click paths have no automated tests
  yet.