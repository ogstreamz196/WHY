
DO $$ BEGIN
  CREATE TYPE public.quiz_difficulty AS ENUM ('easy','medium','hard','expert');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_id UUID NOT NULL UNIQUE REFERENCES public.facts(id) ON DELETE CASCADE,
  category TEXT,
  difficulty public.quiz_difficulty NOT NULL DEFAULT 'medium',
  correct_answer TEXT NOT NULL,
  distractors TEXT[] NOT NULL CHECK (array_length(distractors,1) = 3),
  explanation TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.quiz_questions TO authenticated;
GRANT ALL ON public.quiz_questions TO service_role;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quiz_questions readable by authenticated"
  ON public.quiz_questions FOR SELECT TO authenticated USING (true);

CREATE TABLE public.quiz_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT,
  difficulty public.quiz_difficulty NOT NULL DEFAULT 'medium',
  question_count INT NOT NULL DEFAULT 0,
  correct_count INT NOT NULL DEFAULT 0,
  score INT NOT NULL DEFAULT 0,
  accuracy NUMERIC(5,2) NOT NULL DEFAULT 0,
  fact_ids UUID[] NOT NULL DEFAULT '{}',
  answer_order INT[] NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX quiz_sessions_user_finished_idx ON public.quiz_sessions(user_id, finished_at DESC);
CREATE INDEX quiz_sessions_finished_score_idx ON public.quiz_sessions(finished_at DESC, score DESC);
GRANT SELECT, INSERT, UPDATE ON public.quiz_sessions TO authenticated;
GRANT ALL ON public.quiz_sessions TO service_role;
ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own quiz sessions read" ON public.quiz_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own quiz sessions write" ON public.quiz_sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own quiz sessions update" ON public.quiz_sessions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.quiz_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.quiz_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fact_id UUID NOT NULL REFERENCES public.facts(id) ON DELETE CASCADE,
  picked_index INT NOT NULL CHECK (picked_index BETWEEN 0 AND 3),
  correct BOOLEAN NOT NULL,
  ms_taken INT NOT NULL DEFAULT 0,
  points_awarded INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, fact_id)
);
CREATE INDEX quiz_answers_user_idx ON public.quiz_answers(user_id, created_at DESC);
GRANT SELECT, INSERT ON public.quiz_answers TO authenticated;
GRANT ALL ON public.quiz_answers TO service_role;
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own quiz answers read" ON public.quiz_answers
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own quiz answers write" ON public.quiz_answers
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.quiz_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_score INT NOT NULL DEFAULT 0,
  best_score INT NOT NULL DEFAULT 0,
  questions_answered INT NOT NULL DEFAULT 0,
  correct_answered INT NOT NULL DEFAULT 0,
  best_streak INT NOT NULL DEFAULT 0,
  current_streak INT NOT NULL DEFAULT 0,
  fast_correct INT NOT NULL DEFAULT 0,
  categories_answered TEXT[] NOT NULL DEFAULT '{}',
  favorite_category TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.quiz_stats TO authenticated;
GRANT ALL ON public.quiz_stats TO service_role;
ALTER TABLE public.quiz_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own quiz stats read" ON public.quiz_stats
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own quiz stats write" ON public.quiz_stats
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own quiz stats update" ON public.quiz_stats
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER quiz_stats_updated_at
  BEFORE UPDATE ON public.quiz_stats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE VIEW public.leaderboard_global
WITH (security_invoker = true) AS
SELECT
  qs.user_id,
  p.username,
  p.display_name,
  p.avatar_id,
  COALESCE(us.total_points, 0) AS xp,
  qs.total_score AS quiz_score,
  qs.best_score,
  qs.questions_answered,
  qs.correct_answered
FROM public.quiz_stats qs
LEFT JOIN public.profiles p    ON p.id = qs.user_id
LEFT JOIN public.user_stats us ON us.user_id = qs.user_id
WHERE qs.total_score > 0
ORDER BY qs.total_score DESC, qs.best_score DESC;
GRANT SELECT ON public.leaderboard_global TO authenticated;

CREATE OR REPLACE VIEW public.leaderboard_weekly
WITH (security_invoker = true) AS
SELECT
  s.user_id,
  p.username,
  p.display_name,
  p.avatar_id,
  SUM(s.score)::int AS week_score,
  COUNT(*)::int     AS quizzes_played,
  MAX(s.score)::int AS best_this_week
FROM public.quiz_sessions s
LEFT JOIN public.profiles p ON p.id = s.user_id
WHERE s.finished_at >= date_trunc('week', now())
GROUP BY s.user_id, p.username, p.display_name, p.avatar_id
ORDER BY week_score DESC;
GRANT SELECT ON public.leaderboard_weekly TO authenticated;

INSERT INTO public.achievements (id, name, description, emoji, category, threshold, sort_order)
VALUES
  ('quiz_first',           'Quiz Rookie',      'Complete your first quiz',                'quiz', 'quiz',  1,   200),
  ('quiz_streak_7',        'On Fire',          '7 correct answers in a row',              '🔥',   'quiz',  7,   201),
  ('quiz_100',             'Century Scholar',  'Answer 100 quiz questions',               '🧠',   'quiz',  100, 202),
  ('quiz_master_explorer', 'Master Explorer',  'Answer quiz questions in every category', '🌎',   'quiz',  8,   203),
  ('quiz_speed_genius',    'Speed Genius',     '10 correct answers under 3 seconds',      '⚡',   'quiz',  10,  204),
  ('quiz_perfect',         'Flawless Victory', 'Get a perfect quiz',                      '💯',   'quiz',  1,   205),
  ('quiz_1000',            'Trivia Titan',     'Reach a total quiz score of 1000',        '🏆',   'quiz',  1000,206),
  ('quiz_5000',            'Curiosity Legend', 'Reach a total quiz score of 5000',        '👑',   'quiz',  5000,207)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  emoji = EXCLUDED.emoji,
  category = EXCLUDED.category,
  threshold = EXCLUDED.threshold,
  sort_order = EXCLUDED.sort_order;
