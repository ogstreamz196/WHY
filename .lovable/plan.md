# Curiosity Challenge — Quiz, Scoring & Leaderboards

Sign-in required. Questions reuse existing `facts`; AI generates 3 distractors per fact and caches them so quizzes are fast and fair. Scoring is server-authoritative.

## Database (one migration)

```text
quiz_questions
  fact_id (FK facts, unique) · category · difficulty (easy|medium|hard|expert)
  correct_answer · distractors (text[3]) · explanation
  generated_at

quiz_sessions
  user_id · category (nullable → random) · difficulty
  score · correct_count · question_count · accuracy · started_at · finished_at

quiz_answers
  session_id · fact_id · picked_index · correct · ms_taken · points_awarded

quiz_stats  (1 row per user)
  total_score · best_score · questions_answered · correct_answered
  best_streak · current_streak · favorite_category

quiz_leaderboard_weekly  (materialized-ish view or table refreshed on write)
  user_id · week_start · score · rank
```

- RLS: users read/write only their own sessions/answers/stats; leaderboards readable to `authenticated`; `quiz_questions` readable to `authenticated` (correct answer stripped in the API layer).
- GRANTs for `authenticated` + `service_role` on every table.

## Server functions (`src/lib/quiz.functions.ts`, protected)

- `startQuiz({ category?, difficulty, length=5 })` — picks N facts, ensures each has a cached `quiz_questions` row (generates via Lovable AI `openai/gpt-5.5` if missing: 3 plausible wrong answers + short explanation), shuffles answer order per-user per-question, returns sanitized payload (no correct index).
- `submitAnswer({ sessionId, factId, pickedIndex, msTaken })` — server checks correctness against `quiz_questions.correct_answer`, computes points:
  - base +10 correct
  - +5 speed bonus if `msTaken < 5000`
  - difficulty multiplier (easy ×1, medium ×1.25, hard ×1.5, expert ×2)
  - updates streaks, `quiz_stats`, weekly leaderboard row
  - rate limit: max 1 answer / 500ms / user (reject faster)
- `finishQuiz({ sessionId })` — perfect-quiz bonus (×1.5 total), returns summary + XP delta, calls `checkAchievements`.
- `getGlobalLeaderboard({ limit=50 })`, `getWeeklyLeaderboard({ limit=50 })`, `getMyRank()`.

Anti-cheat: correct answer never leaves server until `submitAnswer` resolves; question + answer order shuffled server-side per session; server times each answer using `session.started_at + submitted_at`, ignores client `msTaken` for scoring beyond the speed bonus check clamp.

## UI

New authenticated routes:

- `/_authenticated/quiz` — category + difficulty picker, "Random mode", CTA to start. Guests hitting `/quiz` see upgrade toast + redirect.
- `/_authenticated/quiz/$sessionId` — game screen:
  - Progress bar (question k/N) · optional countdown timer (15s easy → 8s expert)
  - Animated question card, 4 answer buttons, correct/incorrect flash (green/red pulse + haptic via `navigator.vibrate`)
  - After answer: explanation + related fact link + "Follow the Why chain" link
  - Final screen: score, accuracy, streak, perfect-bonus celebration (reuses `<Celebration/>` + `<LevelUpCelebration/>`), share button
- `/_authenticated/leaderboard` — tabs: Global · Weekly · Friends (Friends shows "Coming soon" placeholder). Row: rank, avatar, username, XP, quiz score. Highlight current user.

Home screen: add a "Curiosity Challenge" card linking to `/quiz` alongside Daily Mission.
Profile: new "Quiz stats" section (level, total points, best streak, accuracy %, favorite category, quiz badges).

## Achievements (added to `achievements` catalog via migration)

- `quiz_first` First Quiz Completed
- `quiz_streak_7` 7 Correct in a Row
- `quiz_100` 100 Questions Answered
- `quiz_master_explorer` Answered in every category
- `quiz_speed_genius` 10 correct answers under 3s
- `quiz_perfect` Perfect quiz
- `quiz_weekly_top3` Top 3 weekly

Wired into `checkAchievements` (already invoked on quiz completion).

## Design

Reuses existing tokens (`--gradient-primary`, `glass-strong`, `text-gradient`). No new colors. Framer Motion for card enter/exit + correct/incorrect pulse; confetti via existing `<Celebration/>`. Countdown ring reuses the mission `ProgressRing` pattern.

## Out of scope (this pass)

- Real friends system (leaderboard tab shows placeholder + waitlist button).
- Sound effects (haptic only; can add later).
- Question reporting UI.

## Files

- Migration: `supabase/migrations/*_quiz_system.sql`
- Server: `src/lib/quiz.functions.ts`
- Components: `src/components/QuizCard.tsx`, `QuizResult.tsx`, `LeaderboardRow.tsx`, `QuizStatsCard.tsx`
- Routes: `src/routes/_authenticated/quiz.tsx`, `quiz.$sessionId.tsx`, `leaderboard.tsx`
- Edits: `src/routes/index.tsx` (home card), `src/routes/profile.tsx` (stats section), `src/lib/account.functions.ts` (new achievement rules)
