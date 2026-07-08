
# Curiosity Arena — Multi-View Leaderboards (one unified score)

Keep the single Curiosity Score = XP (`user_stats.total_points`), which already accumulates from quizzes, discoveries, daily challenges, streaks, and achievements. All views below rank the SAME score — only the WHERE/window/GROUP changes.

## 1. Data (one migration)

- **`profiles`** — add `age_band TEXT` (`under_10 | 10_12 | teen | adult`), `favorite_category TEXT`, `leaderboard_opt_out BOOLEAN DEFAULT false`, `hide_from_public BOOLEAN DEFAULT false`.
- **`xp_events`** — new append-only ledger: `id, user_id, source (quiz|discovery|daily|streak|achievement|login), points INT, category TEXT NULL, created_at`. Every place that bumps `total_points` also inserts here (so time-window and category views are possible without changing scoring).
- **Views** (all `security_invoker=true`, filter out opted-out users):
  - `leaderboard_global` — refactor: ranks by `total_points` (unified).
  - `leaderboard_age` — same, exposes `age_band`.
  - `leaderboard_category` — sums `xp_events.points` per `(user_id, category)`.
  - `leaderboard_window` — sums `xp_events.points` per `user_id` with `created_at >= <daily|weekly|monthly>` (single view, filter client-side by param).
  - `leaderboard_activity` — derives: Rising Stars (biggest 7-day delta), Daily Players (active_days_30 desc), Quiz Masters (`quiz_stats.total_score`), Streak Champions (`current_streak`), Weekend Warriors (Sat/Sun XP), New Explorers (created_at < 14 days).
- GRANT SELECT to authenticated on every view.

## 2. Server functions (`src/lib/leaderboard.functions.ts`)

- `getLeaderboard({ view, filter, limit })` — one entry point; `view` = `global|age|category|window|activity`, `filter` = age band / category key / `daily|weekly|monthly` / activity kind. Returns `{ entries, meta: { total_users, window_label } }`.
- `getMyRankings()` — returns the user's rank + percentile in each headline view (global, their age band, their favorite category, rising, weekly). Used on profile.
- `updateLeaderboardPrivacy({ hide_from_public, leaderboard_opt_out, age_band, favorite_category })`.
- Wire `xp_events` inserts into existing points-awarding server fns (discovery, daily challenge, login bonus, quiz finish, mission bonus) — a single helper `awardXp(context, source, points, category?)`.

## 3. UI

- `/arena` (renamed from `/leaderboard` if it exists) — segmented control: **Global · Age · Category · Activity · Weekly**. Second row of chips picks the filter within that tab. Rows show rank, avatar, name, score, delta arrow. Top-3 get medal styling; user's own row is sticky-highlighted with rank change animation.
- `LeaderboardRow` — animated rank number, progress bar to next tier, medal effects for top 3, `motion` slide-in on rank change.
- **Profile `/profile`** — "Your Curiosity Rankings" card listing global / category / age / rising / weekly with emoji + percentile message ("top 5% of Animal Explorers").
- **Settings `/settings`** — privacy: display name, avatar, hide-from-public toggle, opt-out toggle, age band, favorite category picker.
- **Toast** on quiz finish / daily claim: "You moved up 15 places on Rising Stars" (compare pre/post rank returned by `awardXp`).

## 4. Achievements

Add: `top_100_global`, `top_10_category`, `rising_star_top_10`. Unlocked in `checkAchievements` using view queries.

## Technical notes

- No score duplication — leaderboards derive from `total_points` and `xp_events`; deleting `xp_events` rows never affects `total_points`.
- Views use `security_invoker=true` and filter `hide_from_public=false`; owners can always see themselves via `getMyRankings` (bypasses that filter via `requireSupabaseAuth`).
- Rank query uses `RANK() OVER (ORDER BY score DESC)` in SQL; percentile = `rank / total_users`.
- All server fns are `requireSupabaseAuth` (arena is signed-in only — matches existing quiz gating).

## Out of scope (unless you want them in)

- Real-time push updates (poll every 30s instead)
- Friends leaderboard
- Country/region views
- Season resets and historical archives
