# Retention upgrade

Turn one-off visits into a daily habit by giving each day a clear "mission" to finish, a named progression ladder that celebrates level-ups, and a weekly recap that makes the last 7 days feel like a personal report.

Notifications and native mobile push are **out of scope** — the app is a PWA in the browser and cannot silently push. The plan makes the app *ready* for reminders (deterministic daily mission slot, streak state, unfinished chains surfaced) so a push worker can be layered on later.

## 1. Daily Curiosity Mission

A single card on the home screen that appears once per day for both guests and signed-in users. Signed-in users earn XP + streak credit; guests see a nudge.

Four tasks, deterministic per calendar day so notifications later can preview them:
- **Mystery** — the day's featured fact (seeded by date across the `facts` catalog)
- **Surprise fact** — random fresh discovery
- **Why chain** — start a "But… why?" trail of at least 3 steps
- **Category** — explore one fact in a rotating category-of-the-day

Progress is tracked per task; finishing all four unlocks a bonus (+50 XP + confetti). Completion state persists per day (server for accounts, localStorage for guests).

Data:
- New table `daily_missions` — `user_id`, `mission_date`, `mystery_done`, `surprise_done`, `chain_done`, `category_done`, `category_key`, `completed_at`, `bonus_awarded`
- Server fns: `getTodayMission`, `markMissionTask`
- Guest fallback in `store.ts` keyed by date

UI:
- `<DailyMission />` component with 4 checkbox-style task rows, progress ring, animated completion state, "Claim bonus" button when all four are done
- Auto-marks tasks as user completes matching in-app actions

## 2. Named Curiosity Levels

Replace bare "Level N" numbers with named tiers everywhere they appear (home header, profile, celebrations):

| XP | Level | Title |
|---|---|---|
| 0 | 1 | Curious Mind |
| 100 | 2 | Question Seeker |
| 300 | 5 | Question Hunter |
| 800 | 10 | Knowledge Explorer |
| 2000 | 25 | Curiosity Expert |
| 5000 | 50 | Infinite Thinker |

- Add `src/lib/levels.ts` with `levelFor(xp)` returning `{ level, title, xpIntoLevel, xpToNext, nextTitle }`
- New `<LevelUpCelebration />` overlay: full-screen burst with the new title, XP bar filling animation, "Continue exploring" CTA
- Wire into `grantPoints` in `index.tsx` — detect level change and fire the overlay

## 3. Weekly Recap

New route `/recap` (signed-in only) + a "Your week in curiosity" teaser card on `/profile`. Server fn `getWeeklySummary` aggregates the last 7 days from `discoveries`, `user_stats`, `category_interests`, `user_achievements`:

- Facts discovered
- Categories explored (top 3 with % share)
- XP earned this week
- New achievements
- Best streak day
- One "curiosity insight" line ("You leaned into space this week")

Presented as animated scroll-through cards, each with a subtle motion transition. Includes a share-card button (see §4).

## 4. Better share cards

Extend the existing chain-share flow so users can also share:
- Individual facts (already has native share; upgrade the copy + preview text)
- Achievements (new: `/s/achievement/<id>` OG route)
- Weekly recap summary (new: `/s/week/<user>/<iso-week>` OG route with server-rendered head tags)

Each share route sets rich `og:title`, `og:description`, `og:image` for good previews in messaging apps.

## 5. Discovery Timeline (light polish)

Timeline already exists on `/profile`. Add grouping labels ("Today", "Yesterday", "Last week", "Earlier") and a tap-to-revisit action that reopens the fact in the home reader.

## Out of scope (call out for follow-up)
- **Push notifications** — needs a service worker + FCM/APNs pipeline; the mission slot and streak API are the foundation
- **Server-generated OG images** — the share routes will use static Open Graph HTML tags for now; dynamic image rendering can be added later with a satori/resvg worker
- **Sheets/AI/adult mode** — untouched

## Technical notes
- One migration: `daily_missions` table with RLS scoped to `auth.uid()` + service_role grants; append `xp_earned_this_week` view or materialize on-read (chosen: on-read query, no view needed)
- `levels.ts` is pure utility (no server), used in home + profile + celebrations
- Level-up detection guards against double-fire by comparing previous → next level in `grantPoints`
- Weekly recap query bounds by `date_trunc('week', now())` and stays under 4 queries total
- Share cards reuse existing `head()` per route; no new tooling
