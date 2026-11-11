# VIREX GUARD

**Version 2.3.1**

VIREX GUARD is a Discord-connected access-management portal for distributing Lua source files that you own or are authorized to share. It provides account sign-in, key redemption, expiring entitlements, download permissions, creator limits, Discord administration and audit records. It does **not** execute uploaded code or provide a Roblox executor/loader. There is no payment processing.

## Features

- Discord OAuth sign-in and persistent SQLite sessions.
- Responsive creator dashboard with 3 free / 8 administrator-granted Premium file slots.
- Lua file uploads (1 MiB limit), owner downloads, and entitlement-checked user downloads.
- Single-use keys, time-limited entitlements, extension, whitelist and blacklist commands.
- Discord panel buttons for redeeming, downloading, buyer-role assignment and status.
- Dedicated password-protected Admin Command Center, admin overview, key generation, Premium grants, script enable/disable and audit history.
- SQLite migrations, busy-timeout handling, rate limiting, request-origin checks, upload path validation, Railway Docker deployment and health endpoint.
- Atomic audit records for key redemption and administrator changes.
- Whole-number validation for administrator key batches and Premium grants.
- Discord buyer-role checks for bot permissions, role hierarchy, managed roles and disabled scripts.

## Local setup

1. Use Node.js 20 or newer.
2. Copy `.env.example` to `.env` and configure Discord credentials.
3. Set `SESSION_SECRET` to a unique random value of at least 32 characters. The `.env.example` includes the salted admin password hash for the admin login; keep it in server environment configuration only.
4. Run `npm install`.
5. Run `npm run check` and `npm test`.
6. Run `npm run bot:deploy` to register slash commands. Set `DISCORD_GUILD_ID` for quick test-server registration; omit it for global commands.
7. Run `npm start`.

## Railway deployment

1. Deploy this directory using the included Dockerfile.
2. Add a Railway Volume mounted at `/app/persist`.
3. Set `DB_PATH=/app/persist/virex.sqlite` and `UPLOAD_DIR=/app/persist/scripts`.
4. Configure `BASE_URL`, `SESSION_SECRET`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`, `ADMIN_DISCORD_IDS`, and `DISCORD_BOT_TOKEN`.
5. Set `ADMIN_PASSWORD_HASH` to the current salted scrypt value shown in this build’s `.env.example` in your private Railway variables. Replace any older value from a previous ZIP; old hashes will not authenticate the configured admin password. Keep it server-side; do not add it to frontend code.
6. Set the Discord OAuth redirect to `https://YOUR-DOMAIN/auth/discord/callback`.
7. Invite the bot with `bot` and `applications.commands` scopes. Grant View Channels, Send Messages, Embed Links, and Manage Roles if buyer-role assignment is enabled. Keep the bot role above the buyer role.
8. Slash commands are registered automatically when the bot starts. You can also run `npm run bot:deploy` manually after configuring credentials. Set `DISCORD_GUILD_ID` for fast test-server registration; omit it for global registration (which can take time to appear).
9. Verify `https://YOUR-DOMAIN/health` returns JSON with `ok: true`, `database: "ok"`, and bot status. `bot.status` should be `online` and `bot.commandsRegistered` should be `true` after successful Discord startup. This endpoint reports configuration booleans only; it never exposes tokens or secrets.

Use one Railway replica for this SQLite deployment. Do not share a local SQLite database file across multiple replicas. The web process starts the bot as a child process when `DISCORD_BOT_TOKEN` is configured. The bot registers its slash commands after login and retries failed registration every minute (up to 12 attempts). Check Railway logs for `Registered 12 VIREX GUARD slash commands`. If it reports a missing application ID, set `DISCORD_CLIENT_ID` to the Application ID from the Discord Developer Portal. If it reports 401/403, verify the bot token and application access. Global commands can take time to appear; use `DISCORD_GUILD_ID` for test-server registration.

## Discord commands

- `/createpanel` publishes an access panel for a file ID or slug.
- `/catalog` lists currently enabled scripts.
- `/myaccess` shows the caller’s active entitlements.
- `/accesscheck` checks a member’s access (administrator only).
- `/whitelist` grants a user access and issues a record of the grant.
- `/extendscript` extends an existing entitlement (or grants access if none exists).
- `/blacklist` revokes access and removes any mapped buyer roles that the bot can reach.
- `/setbuyerrole` maps an active entitlement to a Discord role.
- `/generatekey` creates private single-use keys.
- `/keydrop` posts generated keys in the current channel; use a private channel if keys should not be public.
- `/freemode` grants Premium dashboard capacity for a selected number of days.
- `/info` shows service status.

Only IDs listed in `ADMIN_DISCORD_IDS` can run Discord management commands. The web Admin Command Center is available at `/admin.html` and uses the server-side `ADMIN_PASSWORD_HASH` setting. Discord server Administrator permission alone does not grant global VIREX GUARD administrator access.

## Access model

Users redeem a key in the dashboard. After redemption, they can download the file from their active access list while the entitlement is active and the file is enabled. Owners can download their own files, including disabled ones. Downloads are authenticated through the Discord login session. This service deliberately does not generate `loadstring` launchers, execute Lua remotely, collect device fingerprints, or bypass platform security.

## Security and operational notes

- Use HTTPS in production and keep all Discord credentials and session secrets private.
- Back up the SQLite database and persistent upload directory together.
- Set `ADMIN_DISCORD_IDS` to trusted Discord user IDs only.
- The app checks upload extension and size, uses random storage filenames, restricts downloads to stored upload paths, and applies request rate limits.
- Uploaded Lua files are still untrusted content. Only distribute code you own or are authorized to share.
- Buyer-role assignment requires the bot to have Manage Roles and a suitable role hierarchy. The bot removes mapped buyer roles when an administrator blacklists a user; expired roles are not automatically reconciled, so remove them manually if an entitlement expires.
- No payments, checkout, billing or payment-provider integration is included.

## Validation

- `npm run check` performs JavaScript syntax checks. `node --test test/admin-password.test.js` independently tests correct-password, wrong-password and malformed-hash behavior without needing the database dependency.
- `npm test` covers SQLite schema, one-time key claims, entitlement updates, unique slugs and additive legacy migrations. Run it after `npm install`. The source JavaScript syntax check was run successfully for this build. A separate SQLite smoke check also passed for fresh schema creation, one-time key redemption, entitlement upsert and legacy additive migration. Full Node tests, live Discord OAuth, role assignment and Railway deployment still require dependencies and configured credentials.
- A passing local test suite does not replace live OAuth, Discord permission and Railway deployment tests with configured credentials.
