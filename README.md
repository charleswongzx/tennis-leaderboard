# Blitz Leaderboard 95

A Windows-95-themed tennis leaderboard for you and your friends, built on Cloudflare Pages + Functions + D1. Track wins, losses, and bragging rights with a retro vibe. No signup, no ads—just pure competitive spirit (and emoji).

## Local dev

Create or update `.dev.vars` with your admin key:
```
ADMIN_KEY=dev-key
```

Then run:
```bash
npx wrangler d1 execute blitz-leaderboard --local --file=schema.sql
npx wrangler d1 execute blitz-leaderboard --local --file=seed.sql
npx wrangler pages dev     # → http://localhost:8788
```

**Admin panel:** http://localhost:8788/admin.html?key=dev-key

## Deploy

1. Login to Cloudflare:
   ```bash
   npx wrangler login
   ```

2. Create the D1 database and capture the database ID:
   ```bash
   npx wrangler d1 create blitz-leaderboard
   ```
   Copy the printed `database_id` and paste it into `wrangler.toml` under `[[d1_databases]]`.

3. Initialize the remote database schema:
   ```bash
   npx wrangler d1 execute blitz-leaderboard --remote --file=schema.sql
   ```

4. Create a Pages project:
   ```bash
   npx wrangler pages project create blitz-leaderboard --production-branch main
   ```

5. Deploy:
   ```bash
   npx wrangler pages deploy
   ```

6. Set the admin secret:
   ```bash
   npx wrangler pages secret put ADMIN_KEY
   # Paste a strong secret (e.g., output from: openssl rand -hex 24)
   ```

7. Redeploy so the secret is live:
   ```bash
   npx wrangler pages deploy
   ```

Bookmark your admin panel: **https://blitz-leaderboard.pages.dev/admin.html?key=YOUR_KEY**

## How it works

- **Public leaderboard:** Everyone sees the current session and all-time rankings—read-only, no login.
- **Sessions:** Each meetup is a session with a date, optional notes, and games logged during play.
- **Games:** Recorded for stats and glory. Doubles or singles. Winners logged but scoring is flexible.
- **Points:** Freeform per player per session. Rules change every meetup. The admin edits everything—add sessions, log games, award points—via the hidden admin URL.
- **Privacy:** Admin key protects the edit panel. Game results are public.
