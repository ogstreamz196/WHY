
-- ================================================
-- USER ACCOUNTS + PERSONALIZATION
-- ================================================

-- ---------- profiles ----------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  username TEXT UNIQUE,
  avatar_id TEXT NOT NULL DEFAULT 'avatar-sprout',
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ---------- user_stats ----------
CREATE TABLE public.user_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_points INT NOT NULL DEFAULT 0,
  current_streak INT NOT NULL DEFAULT 0,
  longest_streak INT NOT NULL DEFAULT 0,
  facts_seen INT NOT NULL DEFAULT 0,
  last_active_day DATE,
  last_daily_challenge_day DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_stats TO authenticated;
GRANT ALL ON public.user_stats TO service_role;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own stats" ON public.user_stats
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own stats" ON public.user_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own stats" ON public.user_stats
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------- user_settings ----------
CREATE TABLE public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  child_mode BOOLEAN NOT NULL DEFAULT true,
  dark_mode BOOLEAN NOT NULL DEFAULT false,
  sound BOOLEAN NOT NULL DEFAULT true,
  reading_level TEXT NOT NULL DEFAULT 'standard',
  theme_id TEXT NOT NULL DEFAULT 'theme-cosmos',
  avatar_id TEXT NOT NULL DEFAULT 'avatar-sprout',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own settings" ON public.user_settings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own settings" ON public.user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own settings" ON public.user_settings
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------- favorites ----------
CREATE TABLE public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fact_id UUID NOT NULL REFERENCES public.facts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, fact_id)
);
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own favorites" ON public.favorites
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------- discoveries ----------
CREATE TABLE public.discoveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fact_id UUID NOT NULL REFERENCES public.facts(id) ON DELETE CASCADE,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX discoveries_user_day_idx ON public.discoveries (user_id, seen_at DESC);
GRANT SELECT, INSERT ON public.discoveries TO authenticated;
GRANT ALL ON public.discoveries TO service_role;
ALTER TABLE public.discoveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own discoveries" ON public.discoveries
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own discoveries" ON public.discoveries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ---------- generated_questions ----------
CREATE TABLE public.generated_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT,
  category TEXT,
  fun_fact TEXT,
  fact_id UUID REFERENCES public.facts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX generated_questions_user_idx ON public.generated_questions (user_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.generated_questions TO authenticated;
GRANT ALL ON public.generated_questions TO service_role;
ALTER TABLE public.generated_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own generated_questions" ON public.generated_questions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------- why_chains ----------
CREATE TABLE public.why_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  root_fact_id UUID REFERENCES public.facts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.why_chains TO authenticated;
GRANT ALL ON public.why_chains TO service_role;
ALTER TABLE public.why_chains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own why_chains" ON public.why_chains
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.why_chain_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id UUID NOT NULL REFERENCES public.why_chains(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fact_id UUID REFERENCES public.facts(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  answer TEXT,
  position INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chain_id, position)
);
CREATE INDEX why_chain_steps_chain_idx ON public.why_chain_steps (chain_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.why_chain_steps TO authenticated;
GRANT ALL ON public.why_chain_steps TO service_role;
ALTER TABLE public.why_chain_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own chain steps" ON public.why_chain_steps
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------- achievements catalog ----------
CREATE TABLE public.achievements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  emoji TEXT NOT NULL,
  threshold INT,
  category TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.achievements TO authenticated, anon;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Achievements are public" ON public.achievements
  FOR SELECT USING (true);

INSERT INTO public.achievements (id, name, description, emoji, threshold, category, sort_order) VALUES
  ('first_question',    'First Question Asked',   'You asked your very first Why?',              '🌱', 1,   'discovery', 10),
  ('ten_facts',         '10 Facts Discovered',    'Explored ten curious corners of the world.',  '🔟', 10,  'discovery', 20),
  ('hundred_questions', '100 Questions Explored', 'A hundred whys and counting.',                '💯', 100, 'discovery', 30),
  ('why_chain_master',  'Why Chain Master',       'Built a chain of at least 5 linked whys.',    '🔗', 5,   'chain',     40),
  ('streak_3',          '3 Day Curiosity Streak', 'Showed up three days in a row.',              '🔥', 3,   'streak',    50),
  ('streak_7',          '7 Day Curiosity Streak', 'A full week of daily wonder.',                '📅', 7,   'streak',    60),
  ('streak_30',         '30 Day Explorer',        'A whole month of curiosity.',                 '🏆', 30,  'streak',    70),
  ('points_100',        '100 Curiosity Points',   'Earned your first 100 Y-Coins.',              '⭐', 100, 'points',    80),
  ('points_500',        '500 Curiosity Points',   'Halfway to legend status.',                   '🌟', 500, 'points',    90);

-- ---------- user_achievements ----------
CREATE TABLE public.user_achievements (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);
GRANT SELECT, INSERT ON public.user_achievements TO authenticated;
GRANT ALL ON public.user_achievements TO service_role;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own achievements" ON public.user_achievements
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own achievements" ON public.user_achievements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ---------- triggers ----------

-- Auto-create profile / stats / settings on signup.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_stats (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at maintenance triggers (reuse existing update_updated_at_column)
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_stats_updated_at BEFORE UPDATE ON public.user_stats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_why_chains_updated_at BEFORE UPDATE ON public.why_chains
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
