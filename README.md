# Rolax Weembledon Championships '95 (powered by Blitz Academy)

A Windows-95-themed tennis site for casual games between friends, built as one Cloudflare Worker (static pages + a small API) with a D1 database. Anyone with the link can watch live. Umpires log in with a shared password to keep score and start events.

## What's in it

- **Centre Court** (`/`): what's on court now, and the **Roll of Champions** listing who won each finished event.
- **Quick scoreboard** (`/scoreboard?id=N`): add players and tap **+** / **-** as points happen.
  - **Score entry** keeps everyone in the order they joined, so the button you're tapping never moves.
  - **Standings** is a separate tab. Hit **Tabulate standings** when you want the order.
  - Tap a score to type an exact value. **Finish** crowns the leader(s).
- **Tournaments** (`/tournament?new=1` to build, `?id=N` to view): type in names, choose singles or doubles, and pick a format.

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

One D1 table, `events` (see `schema.sql`). Each scoreboard or tournament is one row, and its players, scores and matches are stored as JSON in `data`. The Worker creates the table on first use, so there's no manual schema step. The scheduling and standings logic is in `public/js/formats.js`, which has tests:

```bash
node test/formats.test.mjs
```

## Layout

- `public/`: the pages, styles and browser scripts, served as Worker static assets.
- `src/index.js`: the Worker. It routes `/api/*` and enforces the umpire login on writes.
- `src/api/`: the API handlers (login, logout, me, events).

## Local dev

```bash
npm install
npx wrangler dev           # http://localhost:8787  (umpire password: Blitzy)
npx wrangler d1 execute tennis-leaderboard --local --file=seed.sql   # optional sample champion, after the first page load
```

## Going live

The repo is connected to **Cloudflare Workers Builds** as the Worker `tennis-leaderboard`:

- Every push builds automatically.
- `main` deploys to production at `https://tennis-leaderboard.<your-subdomain>.workers.dev`.
- Other branches get preview URLs on the PR's "Workers Builds" check.
- The first deploy creates the D1 database on its own (Wrangler provisions bindings that have no `database_id`), and the Worker creates its table on first use.

`package.json` pins Wrangler 4, which Workers Builds uses for the build. No GitHub secrets or manual database steps are needed. To use a custom domain, add it under the Worker's **Settings → Domains & Routes** in the Cloudflare dashboard.
