# Sentinel Discord Bot

Approve or reject Sentinel's AI strategy proposals with a button click in Discord,
instead of only in the Sentinel desktop app.

## How it works

- The bot polls Sentinel's `GET /ai/proposals?status=pending` on an interval and
  posts a message with **Approve**/**Reject** buttons for any proposal it hasn't
  posted about yet.
- It connects to Discord over the gateway (WebSocket), the same way any bot does —
  there is **no public HTTPS endpoint to expose**, so this works fine running
  alongside Sentinel on your desktop with no tunnel required.
- When you click a button, the bot checks that the click came from your configured
  Discord user id, then calls Sentinel's `approve`/`reject` API and reports back
  honestly what happened — including when `applied: false` (approved but no
  automatic change exists yet for that proposal type).
- Buttons are disabled after use so a double-click can't double-review.

## Setup

### 1. Create a Discord Application

1. Go to https://discord.com/developers/applications and create a new application.
2. Under **Bot**, add a bot user and copy the **bot token**.
3. Under **OAuth2 → URL Generator**, select the `bot` scope and permissions
   `Send Messages`, `Embed Links`, `Read Message History`, then use the generated
   URL to invite the bot to your server.
4. In your server, find the channel you want proposals posted to and copy its
   channel id (enable Developer Mode in Discord settings, then right-click the
   channel → Copy Channel ID).
5. Copy your own Discord user id the same way (right-click your name → Copy User ID).

### 2. Configure

```bash
cp .env.example .env
```

Fill in `.env`:

- `DISCORD_BOT_TOKEN` — from step 1.2
- `DISCORD_CHANNEL_ID` — from step 1.4
- `DISCORD_ALLOWED_USER_ID` — your Discord user id from step 1.5; only clicks from
  this user are honored
- `SENTINEL_BASE_URL` — defaults to `http://127.0.0.1:8765` (Sentinel running on
  the same machine). Change this if you later move the bot or Sentinel elsewhere —
  see the "Running elsewhere" note below.
- `POLL_INTERVAL_SECONDS` — how often to check for new pending proposals (default 60)

### 3. Run

```bash
npm install
npm start
```

Make sure Sentinel's desktop app is running (so its API is listening on
`127.0.0.1:8765`) before starting the bot.

## Running the bot somewhere other than your desktop

This build assumes the bot runs on the same machine as Sentinel and reaches it at
`127.0.0.1:8765` directly. If you later want the bot on a VPS instead:

- Sentinel's backend needs to be reachable from wherever the bot runs — either
  deploy Sentinel itself to a VPS, or reach your desktop's Sentinel instance
  through a tunnel (Cloudflare Tunnel, ngrok, Tailscale) and point
  `SENTINEL_BASE_URL` at that tunnel's URL.
- The Discord side (gateway connection) doesn't change either way — it makes an
  outbound connection to Discord regardless of where it's hosted.

## Security notes

- Proposal ids are never accepted from anywhere except Sentinel's own API
  responses — the bot only ever acts on an id it read back from
  `GET /ai/proposals`, encoded in a button it posted itself.
- Only your configured `DISCORD_ALLOWED_USER_ID` can trigger an approve/reject;
  anyone else's click gets an ephemeral "not authorized" reply and is ignored.
- Approving does not guarantee a change was applied — the bot reports Sentinel's
  actual `applied` value rather than assuming success.
