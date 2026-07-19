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

## Preview hosting (CI/CD)

Deployments run automatically via GitHub Actions (`.github/workflows/deploy.yml`):

- **Pull requests** publish a live **preview deployment** to a branch-scoped
  `*.blitz-leaderboard.pages.dev` URL — review changes on real Cloudflare
  infrastructure before merging. The preview URL appears in the run's summary
  and on the PR's deployment status.
- **Pushes to `main`** publish the **production deployment**.

One-time setup — add these repository secrets under
**Settings → Secrets and variables → Actions**:

| Secret | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | A token with the **Cloudflare Pages: Edit** permission |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |

The Pages project (`blitz-leaderboard`) and its D1 binding must already exist
(see **Deploy** above). Preview deployments share the same D1 database as
production, so treat preview data as real.

## How it works

- **Public leaderboard:** Everyone sees the current session and all-time rankings—read-only, no login.
- **Sessions:** Each meetup is a session with a date, optional notes, and games logged during play.
- **Games:** Recorded for stats and glory. Doubles or singles. Winners logged but scoring is flexible.
- **Points:** Freeform per player per session. Rules change every meetup. The admin edits everything—add sessions, log games, award points—via the hidden admin URL.
- **Privacy:** Admin key protects the edit panel. Game results are public.
