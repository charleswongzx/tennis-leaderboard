# Rolax Weembledon Championships '95 (powered by Blitz Academy)

A Windows-95-themed tennis site for casual games between friends, built on Cloudflare Pages + Functions + D1. Anyone with the link can watch live. Umpires log in with a shared password to keep score and start events.

## What's in it

- **Centre Court** (`/`): what's on court now, and the **Roll of Champions** listing who won each finished event.
- **Quick scoreboard** (`/scoreboard.html?id=N`): add players and tap **+** / **-** as points happen.
  - **Score entry** keeps everyone in the order they joined, so the button you're tapping never moves.
  - **Standings** is a separate tab. Hit **Tabulate standings** when you want the order.
  - Tap a score to type an exact value. **Finish** crowns the leader(s).
- **Tournaments** (`/tournament.html?new=1` to build, `?id=N` to view): type in names, choose singles or doubles, and pick a format.

  | Format | Singles | Doubles | How it works |
  | --- | --- | --- | --- |
  | Round robin | ✔ | ✔ (fixed teams) | Everyone plays everyone once. Ranked by wins, then game difference. |
  | Rotating partners | | ✔ | A new partner every round (an "Americano" mixer). Ranked by total games won. With a multiple of 4 players, everyone partners everyone exactly once. |
  | Knockout | ✔ | ✔ (fixed teams) | Single elimination with automatic byes. Random draw or seeded as listed. |
  | Round robin + playoffs | ✔ | ✔ (fixed teams) | Everyone plays everyone, then the top 2, 4 or 8 go into a knockout. |

  - Courts available splits each round into matches that can run at the same time, and lists who's resting.
  - The builder previews the draw before you start: match count, rounds, matches per player, and coverage (how many opponent and partner pairings actually happen).
  - Results are entered as games won by each side.

## Who can edit

- Visitors can view everything without logging in.
- **Umpire login** (taskbar) asks for the password, which is `EDIT_PASSWORD` in `wrangler.toml` (currently `Blitzy`). It isn't case-sensitive.
  - A correct password sets a signed, HttpOnly cookie for 30 days.
  - Changing the password logs every device out.
- Every write to `/api/*` checks that cookie and must be JSON.
- Edits use version numbers. If two umpires save at once, the second one reloads the latest event and re-applies its change, so taps don't get lost.

## Data

One D1 table, `events` (see `schema.sql`). Each scoreboard or tournament is one row, and its players, scores and matches are stored as JSON in `data`. The scheduling and standings logic is in `public/js/formats.js`, which has tests:

```bash
node test/formats.test.mjs
```

## Local dev

```bash
npx wrangler d1 execute blitz-leaderboard --local --file=schema.sql
npx wrangler d1 execute blitz-leaderboard --local --file=seed.sql   # optional sample champion
npx wrangler pages dev     # http://localhost:8788  (umpire password: Blitzy)
```

## Going live (one-time setup)

Deployments run from GitHub Actions (`.github/workflows/deploy.yml`):

- **Pull requests** get a preview at a `*.blitz-leaderboard.pages.dev` URL.
- **Pushes to `main`** update production at `https://blitz-leaderboard.pages.dev`.

Each run creates the database table if it's missing, then deploys.

1. Create the D1 database and the Pages project (from any machine with `npx wrangler login`):
   ```bash
   npx wrangler d1 create blitz-leaderboard
   npx wrangler pages project create blitz-leaderboard --production-branch main
   ```
   Paste the printed `database_id` into `wrangler.toml` under `[[d1_databases]]` and commit it.
2. Add these repository secrets under **Settings → Secrets and variables → Actions**:

   | Secret | Value |
   | --- | --- |
   | `CLOUDFLARE_API_TOKEN` | A token with **Cloudflare Pages: Edit** and **D1: Edit** |
   | `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |

3. Push to `main`, or re-run the workflow. Previews share the production database, so treat preview data as real.
