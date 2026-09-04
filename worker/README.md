# Sentinel Discord Bot — Cloudflare Workers edition

A rewrite of the Node/discord.js bot for Cloudflare Workers. No gateway connection,
no discord.js, no always-on process — it's two things instead:

1. An **HTTP Interactions endpoint** (`POST /interactions`) that handles Discord
   button clicks, the `/license` admin command, and its follow-up modal.
2. A **Cron Trigger** (`scheduled` handler) that polls every active customer's
   Sentinel instance for new pending proposals and posts them to Discord.

One Worker serves **every** customer's bot, multiplexed by each interaction's
`application_id` — each customer still creates their own Discord Application (see
"Why customers still need their own Discord app" below), but they all point at the
same Worker URL as their Interactions Endpoint. Your own bot (the "admin" one) is
just another row in the database, distinguished by `is_admin = 1`, with the
`/license` command additionally gated to it.

## Why customers still need their own Discord Application

Same platform limit as the Node version: nothing (not this Worker, not any API) can
programmatically create a new Discord Application, bot user, or token for someone
else. Each customer creates their own at
https://discord.com/developers/applications, gets their bot token + application id
+ public key, and hands you those three plus their channel id and their own Discord
user id. This Worker automates everything after that.

## One-time setup

### 1. Create the D1 database

```bash
npx wrangler d1 create sentinel-bot-db
```

Copy the `database_id` it prints into `wrangler.toml`, then apply the schema:

```bash
npm run db:migrate:remote
```

### 2. Create your own (admin) Discord Application

Same as the Node version's setup: create an Application at
https://discord.com/developers/applications, add a bot user, copy the bot token,
application id, and public key (Application → General Information).

**Do not set the Interactions Endpoint URL yet** — Discord will verify it
immediately on save, and it can't verify anything until your secrets and command
are in place (steps below).

### 3. Set secrets

```bash
npx wrangler secret put ADMIN_APPLICATION_ID
npx wrangler secret put ADMIN_PUBLIC_KEY
npx wrangler secret put ADMIN_BOT_TOKEN
npx wrangler secret put ADMIN_CHANNEL_ID          # channel your own proposals post to
npx wrangler secret put ADMIN_ALLOWED_USER_ID     # your Discord user id (approve/reject)
npx wrangler secret put ADMIN_USER_ID             # your Discord user id (runs /license) — usually same as above
npx wrangler secret put ADMIN_SENTINEL_BASE_URL   # your Sentinel's tunnel URL, e.g. https://sentinel.yourdomain.com
```

If you also want the `/license` command scoped to one server for instant
availability (recommended — global commands take up to ~1 hour to first appear),
add its guild id to `wrangler.toml` as `ADMIN_GUILD_ID` under `[vars]`, or set it as
a secret too.

### 4. Deploy

```bash
npm install
npm run deploy
```

Note the Worker's URL, e.g. `https://sentinel-discord-bot.<your-subdomain>.workers.dev`.

### 5. Point Discord at the Worker

Back in your admin Discord Application's settings, set **Interactions Endpoint
URL** to `https://<your-worker-url>/interactions`. Discord sends a verification
ping immediately — the Worker answers it as soon as your bot's row exists, which
happens automatically the first time it sees a request from `ADMIN_APPLICATION_ID`.

### 6. Register the `/license` command

```bash
curl -X POST "https://<your-worker-url>/setup-admin-commands?key=<your ADMIN_USER_ID>"
```

(This route is a convenience, not a real secret boundary — the "key" is just your
own Discord user id. It only re-registers the command definition, nothing
sensitive; feel free to remove the route after first use if you'd rather not leave
it reachable.)

### 7. Invite your bot and Sentinel Tunnel

Invite your bot to your server with the `bot` scope (`Send Messages`, `Embed
Links`). On the machine running Sentinel, run a Cloudflare Tunnel pointing at
`127.0.0.1:8765` and use that tunnel's public URL as `ADMIN_SENTINEL_BASE_URL`.

## Onboarding a customer

What the customer still has to do manually (unavoidable — see "Why customers
still need their own Discord Application" above):
1. Create a Discord Application + bot user, copy its **application id**,
   **public key**, and **bot token**.
2. Grab a **channel id** (where proposals post) and their own **Discord user id**
   (who's allowed to approve/reject).
3. Have their Sentinel instance reachable over HTTPS (a Cloudflare Tunnel URL).

That's it — everything past that point is automated by `/license create`:

```
/license create
  customer_name: Acme Trading
  application_id: <their Discord Application id>
  public_key: <their Discord Application public key>
  channel_id: <their channel id>
  allowed_user_id: <their Discord user id>
  sentinel_base_url: <their Sentinel tunnel URL>
```

Before anything else, this validates every field's format (snowflake ids, a
64-char hex public key, an `https://` Sentinel URL) and checks the application
isn't already licensed — you get a clear, specific error back immediately instead
of a silently broken license row.

If it passes, it opens a form asking only for their **bot token** — kept out of
the command itself (and so out of channel history) since it's the one truly
sensitive value.

Submitting the form:
1. Validates the token looks like a real Discord bot token.
2. Creates the license and stores everything in D1.
3. **Automatically sets their Discord Application's Interactions Endpoint URL**
   to this Worker, using the token they just gave it — Discord's own API lets you
   set that field on someone else's application as long as you're calling it with
   *their* bot token, and this Worker can already answer the verification PING
   that call triggers, since their license row now exists. The customer never has
   to visit the Developer Portal for this step.
4. **Generates their bot's invite link** for you, built from their application id
   (Send Messages + Embed Links permissions) — no trip to OAuth2 → URL Generator
   needed either.

You get back a single message with the license key, whether the endpoint URL was
set automatically (with a manual fallback URL if that call failed), and a ready-
to-click invite link. The only things left for the customer are clicking that
invite link and making sure their Sentinel tunnel is up.

Their bot starts posting within a minute (next cron tick). `/license list` and
`/license revoke key:<KEY>` manage existing customers the same way as the Node
CLI version did.

## Capability boundary

Same guarantee as the Node version, enforced differently: the Worker only accepts
`/license` commands and the create-modal submission when the interaction's
`application_id` matches `ADMIN_APPLICATION_ID` **and** the invoking user matches
`ADMIN_USER_ID` — checked in `src/index.js` before any command logic runs. A
customer's Discord Application id is never accepted for those code paths, so their
bot cannot manage licenses no matter what a user sends it.

## Local development

```bash
npm run db:migrate   # applies schema.sql to a local D1 replica
npm run dev           # wrangler dev, tunnels a local URL for testing
```

Discord's HTTP Interactions requires a real HTTPS URL, so testing signature
verification end-to-end needs either `wrangler dev --remote` or a deployed Worker;
`wrangler dev`'s local tunnel URL works for that as well.
