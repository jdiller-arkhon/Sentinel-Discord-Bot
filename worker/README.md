# Sentinel Discord Bot — Cloudflare Workers edition

A single shared Discord bot, running on Cloudflare Workers, that gives every
customer a private channel in your Discord server for approving/rejecting their
Sentinel AI strategy proposals. No gateway connection, no discord.js, no
always-on process, and — the point of this version — **no Discord Developer
Portal work for customers at all.**

## Architecture

- **One Discord Application, one bot token, one server (yours).** There is no
  per-customer Discord app, no per-customer bot token, no per-customer invite
  link. Every customer is a member of your server with one private channel only
  they (and the bot) can see.
- **`POST /interactions`** handles button clicks and two slash commands:
  `/license` (admin-only: create/revoke/list) and `/activate` (anyone can run
  it, to redeem their token).
- **A Cron Trigger** polls every activated, non-revoked customer's Sentinel
  instance for new pending proposals and posts them into their private channel.
- **D1** stores one row per customer license, keyed by a generated token that
  doubles as its lookup key both before and after activation.

## How a customer gets set up (their entire onboarding)

1. They join your Discord server via a normal, permanent invite link.
2. You give them an activation token (`SENT-XXXX-XXXX-XXXX-XXXX`), generated
   with `/license create customer_name:<name>` — however you hand it over
   (email, DM, after checkout) is up to you.
3. They run, in your server:
   ```
   /activate token:SENT-XXXX-XXXX-XXXX-XXXX sentinel_url:https://<their tunnel> sentinel_token:<optional>
   ```
4. The bot creates a private channel visible only to them, stores their channel
   id + Discord user id + Sentinel URL (+ token, if given) against their license,
   and starts posting proposals there within a minute.

That's the whole thing. No Developer Portal, no bot token, no public key, no
invite link generation, no waiting on you to invite anything. The only
information they need from outside Discord is their own Sentinel tunnel URL.

They can re-run `/activate` with the same token later to update their Sentinel
URL or token in place — it updates their existing channel rather than making a
new one, as long as they're the same person who originally activated it.

### Sentinel-side authentication (`sentinel_token`)

Sentinel now supports an optional `X-Sentinel-Token` shared secret on all three
endpoints this bot calls (`GET /ai/proposals`, `POST .../approve`, `POST
.../reject`), guarded with a timing-safe comparison — confirmed against the
live server, including that leaving it unset keeps those endpoints exactly as
open as before. Without it, a customer's tunnel URL alone is what stands
between the internet and a live "change my trading parameters" endpoint, so
setting one is worth doing:

- The customer sets their secret via `POST /notifications/settings` (the same
  settings store as their Discord webhook URL) — a new `api_token` field there.
  Reading settings back only ever returns `api_token_set: true/false`, never
  the plaintext value.
- They then pass that same value as `/activate`'s optional `sentinel_token`.
  This Worker sends it as `X-Sentinel-Token` on every request to their
  `sentinel_base_url` (`src/sentinelApi.js`).
- For your own admin bot, set it the same way in your own Sentinel's settings,
  then set the `ADMIN_SENTINEL_TOKEN` secret to match.
- If a customer doesn't set one, the bot still works, but their welcome message
  in their new channel warns them that their tunnel URL alone is unauthenticated.
- A 401 from Sentinel (missing/wrong token) surfaces in Discord as a clear
  `⚠️ Failed to approve/reject: missing or invalid X-Sentinel-Token` message,
  since the bot reads Sentinel's `{"detail": "..."}` error shape directly.

## One-time setup (you, not the customer)

### 1. Create your one Discord Application

https://discord.com/developers/applications → New Application → add a Bot user.
From it, note down:
- **Application id** and **Public Key** (General Information tab)
- **Bot token** (Bot tab)
- **Bot's own user id** — also on the Bot tab, it's just the bot's Discord user
  id (needed so new private channels grant the bot itself access)

Invite this one bot to your server (OAuth2 → URL Generator → `bot` scope,
`Manage Channels`, `Send Messages`, `Embed Links`, `View Channels`) — it needs
`Manage Channels` because it creates each customer's private channel itself.

### 2. Create the D1 database

```bash
npx wrangler d1 create sentinel-bot-db
```

Copy the `database_id` into `wrangler.toml`, then:

```bash
npm run db:migrate:remote
```

### 3. Set secrets

```bash
npx wrangler secret put ADMIN_APPLICATION_ID
npx wrangler secret put ADMIN_PUBLIC_KEY
npx wrangler secret put ADMIN_BOT_TOKEN
npx wrangler secret put ADMIN_BOT_USER_ID
npx wrangler secret put ADMIN_GUILD_ID           # the server customer channels get created in
npx wrangler secret put ADMIN_CHANNEL_ID         # your own channel for your own proposals
npx wrangler secret put ADMIN_ALLOWED_USER_ID    # your Discord user id (approve/reject)
npx wrangler secret put ADMIN_USER_ID            # your Discord user id (runs /license)
npx wrangler secret put ADMIN_SENTINEL_BASE_URL  # your own Sentinel's tunnel URL
```

`ADMIN_CUSTOMER_CATEGORY_ID` is optional — set it if you want customer channels
nested under a specific category instead of loose at the top of the channel list.

### 4. Deploy

```bash
npm install
npm run deploy
```

### 5. Point Discord at the Worker

In your Application's settings, set **Interactions Endpoint URL** to
`https://<your-worker-url>/interactions`. Discord verification-pings it
immediately — this Worker answers as soon as it exists, no dependency on any
license data.

### 6. Register the commands

```bash
curl -X POST "https://<your-worker-url>/setup-commands?key=<your ADMIN_USER_ID>"
```

(Convenience route, not a real secret boundary — feel free to remove it after
first use.)

## Managing customers

```
/license create customer_name:Acme Trading   → generates a token to hand them
/license list                                 → shows status of every customer
/license revoke key:SENT-XXXX-XXXX-XXXX-XXXX  → cuts off access
```

Revoking marks the license inactive, denies that customer's view permission on
their channel (they keep the ability to scroll history but can't be posted to
or interact further), and posts a notice in it — the channel and its history
stay intact for your own reference rather than being deleted.

## Capability boundary

`/license` only responds when the invoking user matches `ADMIN_USER_ID` —
checked in `src/index.js` before any command logic runs. `/activate` is
intentionally open to anyone (that's how customers self-serve), but it can only
ever act on a token that already exists as an unactivated, non-revoked row —
there's no way to activate an arbitrary channel or claim someone else's license.

## Local development

```bash
npm run db:migrate   # applies schema.sql to a local D1 replica
npm run dev           # wrangler dev
```

Discord's HTTP Interactions requires a real HTTPS URL, so testing signature
verification end-to-end needs `wrangler dev --remote` or a deployed Worker.
