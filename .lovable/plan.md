# User Accounts + Curiosity Profiles

Adds a full account system on top of the current guest-first experience. Nothing in today's UI, fact data, Google Sheets sync, or Daily Challenge logic is removed — auth simply *unlocks* cloud sync, real achievements, and a personalised dashboard. Signed-out users keep the app they have today.

## Scope

### 1. Auth (Lovable Cloud managed)
- Email + password signup / login / logout
- Password reset flow with `/reset-password` page
- Email verification (default Lovable auth emails; custom templates optional later)
- Google sign-in via `lovable.auth.signInWithOAuth`
- Persistent sessions, `onAuthStateChange` wired once in `__root.tsx`
- Public `/auth` route (sign in + sign up + forgot password tabs) with animated cosmic welcome

### 2. Database (new migration, RLS on every table)
Existing `facts` table untouched — AI + Sheet facts stay global/public.
New tables, each with `user_id uuid references auth.users on delete cascade`, RLS `auth.uid() = user_id`, and required GRANTs:

- `profiles` — display_name, username, avatar_id, bio, created_at
- `user_stats` — total_points, current_streak, longest_streak, facts_seen, last_active_day
- `favorites` — fact_id → facts
- `discoveries` — fact_id, seen_at (activity history)
- `generated_questions` — question, answer, category, source='user'
- `why_chains` — root_fact_id, title, updated_at + `why_chain_steps` (chain_id, fact_id, position)
- `achievements` catalog table (public read) + `user_achievements` (user_id, achievement_id, unlocked_at)
- `user_settings` — child_mode, reading_level, sound, theme_id, avatar_id
- Trigger: on `auth.users` insert → create `profiles` + `user_stats` + `user_settings` rows
- Trigger: `updated_at` maintenance on mutable tables

### 3. Server functions (`createServerFn` + `requireSupabaseAuth`)
- `getMyProfile`, `updateMyProfile`
- `getMyStats`, `recordDailyChallenge` (server-authoritative streak/points award)
- `toggleFavorite`, `listFavorites`
- `recordDiscovery` (bumps stats, checks achievement unlocks)
- `saveGeneratedQuestion`, `listGeneratedQuestions`
- `createWhyChain`, `appendWhyChainStep`, `listWhyChains`, `getWhyChain`
- `listAchievements` (public catalog + my unlocks)
- `migrateGuestData` — one-shot import of localStorage favorites/points/streak into the account on first login

### 4. Guest mode (unchanged surface, gated writes)
- `useCurrentUser()` hook exposes `{ user, isGuest }`
- Existing local-store helpers stay as the guest backend
- Signed-in users: same helpers become thin wrappers that hit server fns (with optimistic local cache for offline)
- Guest-blocked actions (favorite, permanent points, cross-device sync) open a friendly `SignInPrompt` modal instead of silently failing

### 5. Personalised dashboard
- Signed-in home replaces the anonymous header with:
  - "Welcome back, {name}" + avatar
  - Streak calendar (last 30 days from `discoveries`)
  - XP bar + level tied to `user_stats.total_points`
  - "Resume Why chain" card if a chain has unsaved next step
- Signed-out home = today's experience, plus a soft "Create account to save your streak" banner

### 6. Achievements
Catalog seeded via migration: `first_question`, `ten_facts`, `why_chain_master`, `streak_7`, `hundred_questions`, plus existing badge tiers. Unlock check runs inside `recordDiscovery` / `recordDailyChallenge` / `createWhyChain` and toasts a celebratory card (reusing `<Celebration />`).

### 7. UI
- `/auth` — animated cosmic welcome, tab-switch between Sign in / Sign up / Reset, Google button, guest "Keep exploring" link
- `/reset-password` — public, handles Supabase recovery hash
- `/profile` — avatar, display name, edit form, achievement grid, stats
- `/settings` — restyled with account section (email, sign out, delete) preserving existing preferences + Sheets sync (admin-only stays admin-only)
- `_authenticated` layout stays integration-managed; profile/settings account section live there. Home stays public.

### 8. Offline
- TanStack Query cache persisted via existing PWA service worker (add `persistQueryClient` with localStorage bucket)
- Mutations use `queryClient.setQueryData` optimistic updates
- Offline queue: mutation retry on `online` event, dedup by `(kind, target_id)`

### 9. Security
- RLS on every new table (`auth.uid() = user_id`); GRANTs to `authenticated` only, plus `service_role`
- No `anon` grants on user tables
- Zod validation on every server fn input
- Passwords via Supabase Auth (bcrypt); HIBP check enabled via `configure_auth`
- Google auth uses managed Lovable Cloud client
- Existing `facts` table stays publicly readable (AI + Sheet facts serve everyone)

## Out of scope (call out for follow-ups)
- Custom auth email templates (default Lovable auth emails suffice for launch)
- Social features (follow, share chains publicly)
- Realtime multiplayer

## Technical notes
- Ask for user profile data: **yes** — will create `profiles` + related tables per spec
- Migration is one large approved migration to keep FK order coherent
- No changes to `facts.source` ownership rules; Sheets sync + AI protection preserved
- `configure_social_auth` for Google (keeps email enabled)
- `configure_auth` with `password_hibp_enabled: true`
