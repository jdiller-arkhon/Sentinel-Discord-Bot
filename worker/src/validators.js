export function validationErrors(fields) {
  const errors = [];

  if (!/^\d{17,20}$/.test(fields.discordApplicationId || '')) {
    errors.push('`application_id` should be a 17-20 digit Discord snowflake (from your app\'s General Information page).');
  }
  if (!/^[0-9a-f]{64}$/i.test(fields.discordPublicKey || '')) {
    errors.push('`public_key` should be a 64-character hex string (also on General Information).');
  }
  if (!/^\d{17,20}$/.test(fields.discordChannelId || '')) {
    errors.push('`channel_id` should be a 17-20 digit Discord snowflake (right-click the channel → Copy Channel ID).');
  }
  if (!/^\d{17,20}$/.test(fields.discordAllowedUserId || '')) {
    errors.push('`allowed_user_id` should be a 17-20 digit Discord snowflake (right-click the user → Copy User ID).');
  }
  if (!/^https:\/\/.+/.test(fields.sentinelBaseUrl || '')) {
    errors.push('`sentinel_base_url` should start with `https://` (a Cloudflare Tunnel / ngrok URL, not `http://127.0.0.1:...`).');
  }

  return errors;
}

export function botTokenLooksValid(token) {
  // Real Discord bot tokens are three dot-separated base64url-ish segments.
  return /^[\w-]{20,}\.[\w-]{5,}\.[\w-]{20,}$/.test(token || '');
}
