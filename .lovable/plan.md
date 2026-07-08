## Optimization Plan

Goal: measurable wins in performance, accessibility, and maintainability with **zero behavior change**. Staged so each phase is independently reviewable.

### Phase 1 — Safe quick wins (no risk)

**Accessibility**
- Add `type="button"` to non-submit `<button>` elements across `__root.tsx`, `BottomNav.tsx`, and components that use raw `<button>` (prevents accidental form submits).
- Add a visible-on-focus **skip-to-content** link in `__root.tsx` and wrap route content in a single `<main id="main">` inside `RootComponent` (currently no `<main>` landmark exists).
- Audit icon-only `<Button>` / `<button>` usages in `src/components/` for missing `aria-label`.
- Replace `h-screen` with `h-dvh` where present (mobile viewport fix).
- Replace low-contrast `text-gray-*` / hardcoded whites with `text-foreground` / `text-muted-foreground` tokens where they slipped in.

**Performance**
- Fix duplicate `opacity: 0` inline style in `BottomNav.tsx` (inline overrides the active-state animation).
- Add `loading="lazy"` and `decoding="async"` to non-LCP `<img>` tags.
- Add `defaultPreloadStaleTime` and sane `staleTime`/`gcTime` defaults to the QueryClient in `src/router.tsx` (fewer refetch storms).
- Preload the display font subset via a `<link rel="preload">` in root `head().links`.

**Maintainability**
- Extract shared route-error/not-found UI into `src/components/RouteBoundary.tsx` so each route with a loader can wire boundaries in 1 line.

### Phase 2 — Route-file decomposition (medium risk, review each)

`src/routes/index.tsx` is 1187 lines and `_authenticated/leaderboard.tsx` is 435. Split into cohesive pieces, keeping the route file as thin orchestration:

- `index.tsx` → extract `CategoryBubbles`, `FactCard`, `HomeHeader`, `DailyChallengeSection` into `src/components/home/*`.
- `leaderboard.tsx` → extract `LeaderRow`, `CelebrationModal`, `PercentileChip`, tier logic (`src/lib/leaderboard-tiers.ts`).
- Memoize row components with `React.memo` since framer-motion layout animations re-render the list.

### Phase 3 — Bundle / runtime (verify with build output)

- Confirm TanStack auto-code-splitting is producing per-route chunks; if any component functions are `export`ed from route files (breaks splitting), make them local.
- Replace any barrel `lucide-react` re-exports with direct icon imports (already mostly good; verify).
- Move `framer-motion` heavy imports (`AnimatePresence`, `motion`) behind `React.lazy` on rarely-mounted celebration modals.

### Out of scope
- No logic, RLS, data-shape, or visual design changes.
- No new dependencies.
- No changes to `src/integrations/supabase/*` (auto-generated).

### Suggested execution
Do **Phase 1** now in one batch (safe, ~10 min). Then confirm before Phase 2/3.

Reply "go phase 1" (or pick phases) and I'll execute.
