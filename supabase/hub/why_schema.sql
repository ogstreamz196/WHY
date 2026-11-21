-- Why? in the OGSTREAMZ HUB Supabase project (ref zqwngcndkxgxuwqyxihi).
--
-- Each app in the hub has its own schema (padel, og_booking, og_bot…); Why?
-- lives in `why`. Accounts (auth.users) are shared across the hub's apps, but
-- no app reads another's data. Why? creates its own rows for an account the
-- first time that account uses Why? (why.ensure_member), never on hub sign-up.
--
-- Copied from the Lovable Cloud database (public schema) on 21 Nov 2026.

CREATE SCHEMA IF NOT EXISTS why;
SET search_path = why, extensions, public;

GRANT USAGE ON SCHEMA why TO anon, authenticated, service_role;

-- -------------------- Types --------------------
CREATE TYPE why.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE why.quiz_difficulty AS ENUM ('easy', 'medium', 'hard', 'expert');
CREATE SEQUENCE why.ai_usage_id_seq;

-- -------------------- Tables --------------------
CREATE TABLE why.achievements (id text NOT NULL, name text NOT NULL, description text NOT NULL, emoji text NOT NULL, threshold integer, category text NOT NULL, sort_order integer DEFAULT 100 NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE why.adult_facts (id uuid DEFAULT gen_random_uuid() NOT NULL, question text NOT NULL, answer text NOT NULL, fun_fact text, category text, created_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE why.ai_usage (id bigint DEFAULT nextval('why.ai_usage_id_seq'::regclass) NOT NULL, user_id uuid NOT NULL, kind text NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL);
ALTER SEQUENCE why.ai_usage_id_seq OWNED BY why.ai_usage.id;
CREATE TABLE why.app_config (key text NOT NULL, value jsonb DEFAULT '{}'::jsonb NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, updated_by uuid);
CREATE TABLE why.boss_audit_log (id uuid DEFAULT gen_random_uuid() NOT NULL, actor_id uuid NOT NULL, target_user_id uuid, action text NOT NULL, details jsonb DEFAULT '{}'::jsonb NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE why.categories (key text NOT NULL, label text NOT NULL, emoji text, sort_order integer DEFAULT 100 NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE why.category_interests (user_id uuid NOT NULL, category text NOT NULL, weight integer DEFAULT 0 NOT NULL, last_engaged_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE why.chain_collection_items (collection_id uuid NOT NULL, chain_id uuid NOT NULL, user_id uuid NOT NULL, added_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE why.chain_collections (id uuid DEFAULT gen_random_uuid() NOT NULL, user_id uuid NOT NULL, name text NOT NULL, description text, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE why.chain_layer_rewards (id uuid DEFAULT gen_random_uuid() NOT NULL, user_id uuid NOT NULL, issued_at timestamp with time zone DEFAULT now() NOT NULL, claimed_at timestamp with time zone);
CREATE TABLE why.champion_title_history (id uuid DEFAULT gen_random_uuid() NOT NULL, title_key text NOT NULL, holder_user_id uuid, previous_holder_user_id uuid, record_value integer NOT NULL, previous_record_value integer DEFAULT 0 NOT NULL, reference_id uuid, claimed_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE why.champion_titles (title_key text NOT NULL, holder_user_id uuid, record_value integer DEFAULT 0 NOT NULL, reference_id uuid, claimed_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE why.daily_missions (id uuid DEFAULT gen_random_uuid() NOT NULL, user_id uuid NOT NULL, mission_date date NOT NULL, mystery_done boolean DEFAULT false NOT NULL, surprise_done boolean DEFAULT false NOT NULL, chain_done boolean DEFAULT false NOT NULL, category_done boolean DEFAULT false NOT NULL, category_key text, bonus_awarded boolean DEFAULT false NOT NULL, completed_at timestamp with time zone, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE why.discoveries (id uuid DEFAULT gen_random_uuid() NOT NULL, user_id uuid NOT NULL, fact_id uuid NOT NULL, seen_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE why.facts (id uuid DEFAULT gen_random_uuid() NOT NULL, question text NOT NULL, answer text NOT NULL, category text, created_at timestamp with time zone DEFAULT now() NOT NULL, fun_fact text, source text DEFAULT 'ai'::text NOT NULL, sheet_id text, updated_at timestamp with time zone DEFAULT now() NOT NULL, is_adult boolean DEFAULT false NOT NULL, code text DEFAULT ('WHY-'::text || upper(substr(md5(((gen_random_uuid())::text || '::why-code-v1'::text)), 1, 6))) NOT NULL, code_seq bigint DEFAULT 0 NOT NULL, original_question text);
CREATE TABLE why.favorites (id uuid DEFAULT gen_random_uuid() NOT NULL, user_id uuid NOT NULL, fact_id uuid NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE why.generated_questions (id uuid DEFAULT gen_random_uuid() NOT NULL, user_id uuid NOT NULL, question text NOT NULL, answer text, category text, fun_fact text, fact_id uuid, created_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE why.plus_entitlements (user_id uuid NOT NULL, product_id text, store text, expires_at timestamp with time zone, will_renew boolean DEFAULT false NOT NULL, billing_issue boolean DEFAULT false NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE why.profiles (id uuid NOT NULL, display_name text, username text, avatar_id text DEFAULT 'avatar-sprout'::text NOT NULL, bio text, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, adult_verified_at timestamp with time zone, adult_provider text, age_band text, favorite_category text, leaderboard_opt_out boolean DEFAULT false NOT NULL, hide_from_public boolean DEFAULT false NOT NULL, status_message text, avatar_url text, avatar_outfit jsonb DEFAULT '{}'::jsonb NOT NULL);
CREATE TABLE why.quiz_answers (id uuid DEFAULT gen_random_uuid() NOT NULL, session_id uuid NOT NULL, user_id uuid NOT NULL, fact_id uuid NOT NULL, picked_index integer NOT NULL, correct boolean NOT NULL, ms_taken integer DEFAULT 0 NOT NULL, points_awarded integer DEFAULT 0 NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE why.quiz_questions (id uuid DEFAULT gen_random_uuid() NOT NULL, fact_id uuid NOT NULL, category text, difficulty why.quiz_difficulty DEFAULT 'medium'::why.quiz_difficulty NOT NULL, correct_answer text NOT NULL, distractors text[] NOT NULL, explanation text, generated_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE why.quiz_sessions (id uuid DEFAULT gen_random_uuid() NOT NULL, user_id uuid NOT NULL, category text, difficulty why.quiz_difficulty DEFAULT 'medium'::why.quiz_difficulty NOT NULL, question_count integer DEFAULT 0 NOT NULL, correct_count integer DEFAULT 0 NOT NULL, score integer DEFAULT 0 NOT NULL, accuracy numeric(5,2) DEFAULT 0 NOT NULL, fact_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL, answer_order integer[] DEFAULT '{}'::integer[] NOT NULL, started_at timestamp with time zone DEFAULT now() NOT NULL, finished_at timestamp with time zone, created_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE why.quiz_stats (user_id uuid NOT NULL, total_score integer DEFAULT 0 NOT NULL, best_score integer DEFAULT 0 NOT NULL, questions_answered integer DEFAULT 0 NOT NULL, correct_answered integer DEFAULT 0 NOT NULL, best_streak integer DEFAULT 0 NOT NULL, current_streak integer DEFAULT 0 NOT NULL, fast_correct integer DEFAULT 0 NOT NULL, categories_answered text[] DEFAULT '{}'::text[] NOT NULL, favorite_category text, updated_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE why.subscriptions (id uuid DEFAULT gen_random_uuid() NOT NULL, user_id uuid NOT NULL, paddle_subscription_id text NOT NULL, paddle_customer_id text NOT NULL, product_id text NOT NULL, price_id text NOT NULL, status text DEFAULT 'active'::text NOT NULL, current_period_start timestamp with time zone, current_period_end timestamp with time zone, cancel_at_period_end boolean DEFAULT false, environment text DEFAULT 'sandbox'::text NOT NULL, signup_bonus_awarded boolean DEFAULT false NOT NULL, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now());
CREATE TABLE why.ui_overrides (key text NOT NULL, value jsonb NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, updated_by uuid);
CREATE TABLE why.user_achievements (user_id uuid NOT NULL, achievement_id text NOT NULL, unlocked_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE why.user_inventory (user_id uuid NOT NULL, item_id text NOT NULL, cost integer DEFAULT 0 NOT NULL, acquired_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE why.user_roles (id uuid DEFAULT gen_random_uuid() NOT NULL, user_id uuid NOT NULL, role why.app_role NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE why.user_settings (user_id uuid NOT NULL, child_mode boolean DEFAULT true NOT NULL, dark_mode boolean DEFAULT false NOT NULL, sound boolean DEFAULT true NOT NULL, reading_level text DEFAULT 'standard'::text NOT NULL, theme_id text DEFAULT 'theme-cosmos'::text NOT NULL, avatar_id text DEFAULT 'avatar-sprout'::text NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, adult_mode_enabled boolean DEFAULT false NOT NULL);
CREATE TABLE why.user_stats (user_id uuid NOT NULL, total_points integer DEFAULT 0 NOT NULL, current_streak integer DEFAULT 0 NOT NULL, longest_streak integer DEFAULT 0 NOT NULL, facts_seen integer DEFAULT 0 NOT NULL, last_active_day date, last_daily_challenge_day date, updated_at timestamp with time zone DEFAULT now() NOT NULL, last_login_bonus_day date, login_streak integer DEFAULT 0 NOT NULL);
CREATE TABLE why.why_chain_steps (id uuid DEFAULT gen_random_uuid() NOT NULL, chain_id uuid NOT NULL, user_id uuid NOT NULL, fact_id uuid, question text NOT NULL, answer text, "position" integer NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE why.why_chains (id uuid DEFAULT gen_random_uuid() NOT NULL, user_id uuid NOT NULL, title text, root_fact_id uuid, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, is_public boolean DEFAULT false NOT NULL, share_slug text, pinned boolean DEFAULT false NOT NULL);
CREATE TABLE why.xp_events (id uuid DEFAULT gen_random_uuid() NOT NULL, user_id uuid NOT NULL, source text NOT NULL, points integer NOT NULL, category text, created_at timestamp with time zone DEFAULT now() NOT NULL);

-- -------------------- Keys and checks --------------------
ALTER TABLE why.achievements ADD CONSTRAINT achievements_pkey PRIMARY KEY (id);
ALTER TABLE why.adult_facts ADD CONSTRAINT adult_facts_pkey PRIMARY KEY (id);
ALTER TABLE why.ai_usage ADD CONSTRAINT ai_usage_pkey PRIMARY KEY (id);
ALTER TABLE why.app_config ADD CONSTRAINT app_config_pkey PRIMARY KEY (key);
ALTER TABLE why.boss_audit_log ADD CONSTRAINT boss_audit_log_pkey PRIMARY KEY (id);
ALTER TABLE why.categories ADD CONSTRAINT categories_pkey PRIMARY KEY (key);
ALTER TABLE why.category_interests ADD CONSTRAINT category_interests_pkey PRIMARY KEY (user_id, category);
ALTER TABLE why.chain_collection_items ADD CONSTRAINT chain_collection_items_pkey PRIMARY KEY (collection_id, chain_id);
ALTER TABLE why.chain_collections ADD CONSTRAINT chain_collections_pkey PRIMARY KEY (id);
ALTER TABLE why.chain_layer_rewards ADD CONSTRAINT chain_layer_rewards_pkey PRIMARY KEY (id);
ALTER TABLE why.champion_title_history ADD CONSTRAINT champion_title_history_pkey PRIMARY KEY (id);
ALTER TABLE why.champion_titles ADD CONSTRAINT champion_titles_pkey PRIMARY KEY (title_key);
ALTER TABLE why.daily_missions ADD CONSTRAINT daily_missions_pkey PRIMARY KEY (id);
ALTER TABLE why.daily_missions ADD CONSTRAINT daily_missions_user_id_mission_date_key UNIQUE (user_id, mission_date);
ALTER TABLE why.discoveries ADD CONSTRAINT discoveries_pkey PRIMARY KEY (id);
ALTER TABLE why.facts ADD CONSTRAINT facts_pkey PRIMARY KEY (id);
ALTER TABLE why.favorites ADD CONSTRAINT favorites_pkey PRIMARY KEY (id);
ALTER TABLE why.favorites ADD CONSTRAINT favorites_user_id_fact_id_key UNIQUE (user_id, fact_id);
ALTER TABLE why.generated_questions ADD CONSTRAINT generated_questions_pkey PRIMARY KEY (id);
ALTER TABLE why.plus_entitlements ADD CONSTRAINT plus_entitlements_pkey PRIMARY KEY (user_id);
ALTER TABLE why.profiles ADD CONSTRAINT profiles_age_band_check CHECK ((age_band = ANY (ARRAY['under_10'::text, '10_12'::text, 'teen'::text, 'adult'::text])));
ALTER TABLE why.profiles ADD CONSTRAINT profiles_avatar_outfit_is_object CHECK (((jsonb_typeof(avatar_outfit) = 'object'::text) AND (pg_column_size(avatar_outfit) < 2048)));
ALTER TABLE why.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE why.profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
ALTER TABLE why.quiz_answers ADD CONSTRAINT quiz_answers_picked_index_check CHECK (((picked_index >= '-1'::integer) AND (picked_index <= 3)));
ALTER TABLE why.quiz_answers ADD CONSTRAINT quiz_answers_pkey PRIMARY KEY (id);
ALTER TABLE why.quiz_answers ADD CONSTRAINT quiz_answers_session_id_fact_id_key UNIQUE (session_id, fact_id);
ALTER TABLE why.quiz_questions ADD CONSTRAINT quiz_questions_distractors_check CHECK ((array_length(distractors, 1) = 3));
ALTER TABLE why.quiz_questions ADD CONSTRAINT quiz_questions_fact_id_key UNIQUE (fact_id);
ALTER TABLE why.quiz_questions ADD CONSTRAINT quiz_questions_pkey PRIMARY KEY (id);
ALTER TABLE why.quiz_sessions ADD CONSTRAINT quiz_sessions_pkey PRIMARY KEY (id);
ALTER TABLE why.quiz_stats ADD CONSTRAINT quiz_stats_pkey PRIMARY KEY (user_id);
ALTER TABLE why.subscriptions ADD CONSTRAINT subscriptions_paddle_subscription_id_key UNIQUE (paddle_subscription_id);
ALTER TABLE why.subscriptions ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);
ALTER TABLE why.ui_overrides ADD CONSTRAINT ui_overrides_pkey PRIMARY KEY (key);
ALTER TABLE why.user_achievements ADD CONSTRAINT user_achievements_pkey PRIMARY KEY (user_id, achievement_id);
ALTER TABLE why.user_inventory ADD CONSTRAINT user_inventory_pkey PRIMARY KEY (user_id, item_id);
ALTER TABLE why.user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);
ALTER TABLE why.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
ALTER TABLE why.user_settings ADD CONSTRAINT user_settings_pkey PRIMARY KEY (user_id);
ALTER TABLE why.user_stats ADD CONSTRAINT user_stats_pkey PRIMARY KEY (user_id);
ALTER TABLE why.why_chain_steps ADD CONSTRAINT why_chain_steps_chain_id_position_key UNIQUE (chain_id, "position");
ALTER TABLE why.why_chain_steps ADD CONSTRAINT why_chain_steps_pkey PRIMARY KEY (id);
ALTER TABLE why.why_chains ADD CONSTRAINT why_chains_pkey PRIMARY KEY (id);
ALTER TABLE why.why_chains ADD CONSTRAINT why_chains_share_slug_key UNIQUE (share_slug);
ALTER TABLE why.xp_events ADD CONSTRAINT xp_events_pkey PRIMARY KEY (id);
ALTER TABLE why.xp_events ADD CONSTRAINT xp_events_source_check CHECK ((source = ANY (ARRAY['quiz'::text, 'discovery'::text, 'daily'::text, 'streak'::text, 'achievement'::text, 'login'::text, 'mission'::text, 'chain'::text])));

-- -------------------- Foreign keys --------------------
ALTER TABLE why.ai_usage ADD CONSTRAINT ai_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE why.category_interests ADD CONSTRAINT category_interests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE why.chain_collection_items ADD CONSTRAINT chain_collection_items_chain_id_fkey FOREIGN KEY (chain_id) REFERENCES why.why_chains(id) ON DELETE CASCADE;
ALTER TABLE why.chain_collection_items ADD CONSTRAINT chain_collection_items_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES why.chain_collections(id) ON DELETE CASCADE;
ALTER TABLE why.chain_collection_items ADD CONSTRAINT chain_collection_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE why.chain_collections ADD CONSTRAINT chain_collections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE why.chain_layer_rewards ADD CONSTRAINT chain_layer_rewards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE why.champion_title_history ADD CONSTRAINT champion_title_history_holder_user_id_fkey FOREIGN KEY (holder_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE why.champion_title_history ADD CONSTRAINT champion_title_history_previous_holder_user_id_fkey FOREIGN KEY (previous_holder_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE why.champion_titles ADD CONSTRAINT champion_titles_holder_user_id_fkey FOREIGN KEY (holder_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE why.daily_missions ADD CONSTRAINT daily_missions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE why.discoveries ADD CONSTRAINT discoveries_fact_id_fkey FOREIGN KEY (fact_id) REFERENCES why.facts(id) ON DELETE CASCADE;
ALTER TABLE why.discoveries ADD CONSTRAINT discoveries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE why.favorites ADD CONSTRAINT favorites_fact_id_fkey FOREIGN KEY (fact_id) REFERENCES why.facts(id) ON DELETE CASCADE;
ALTER TABLE why.favorites ADD CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE why.generated_questions ADD CONSTRAINT generated_questions_fact_id_fkey FOREIGN KEY (fact_id) REFERENCES why.facts(id) ON DELETE SET NULL;
ALTER TABLE why.generated_questions ADD CONSTRAINT generated_questions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE why.plus_entitlements ADD CONSTRAINT plus_entitlements_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE why.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE why.quiz_answers ADD CONSTRAINT quiz_answers_fact_id_fkey FOREIGN KEY (fact_id) REFERENCES why.facts(id) ON DELETE CASCADE;
ALTER TABLE why.quiz_answers ADD CONSTRAINT quiz_answers_session_id_fkey FOREIGN KEY (session_id) REFERENCES why.quiz_sessions(id) ON DELETE CASCADE;
ALTER TABLE why.quiz_answers ADD CONSTRAINT quiz_answers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE why.quiz_questions ADD CONSTRAINT quiz_questions_fact_id_fkey FOREIGN KEY (fact_id) REFERENCES why.facts(id) ON DELETE CASCADE;
ALTER TABLE why.quiz_sessions ADD CONSTRAINT quiz_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE why.quiz_stats ADD CONSTRAINT quiz_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE why.subscriptions ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE why.user_achievements ADD CONSTRAINT user_achievements_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES why.achievements(id) ON DELETE CASCADE;
ALTER TABLE why.user_achievements ADD CONSTRAINT user_achievements_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE why.user_inventory ADD CONSTRAINT user_inventory_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE why.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE why.user_settings ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE why.user_stats ADD CONSTRAINT user_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE why.why_chain_steps ADD CONSTRAINT why_chain_steps_chain_id_fkey FOREIGN KEY (chain_id) REFERENCES why.why_chains(id) ON DELETE CASCADE;
ALTER TABLE why.why_chain_steps ADD CONSTRAINT why_chain_steps_fact_id_fkey FOREIGN KEY (fact_id) REFERENCES why.facts(id) ON DELETE SET NULL;
ALTER TABLE why.why_chain_steps ADD CONSTRAINT why_chain_steps_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE why.why_chains ADD CONSTRAINT why_chains_root_fact_id_fkey FOREIGN KEY (root_fact_id) REFERENCES why.facts(id) ON DELETE SET NULL;
ALTER TABLE why.why_chains ADD CONSTRAINT why_chains_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE why.xp_events ADD CONSTRAINT xp_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- -------------------- Indexes --------------------
CREATE INDEX adult_facts_created_idx ON why.adult_facts USING btree (created_at DESC);
CREATE INDEX ai_usage_user_time_idx ON why.ai_usage USING btree (user_id, created_at DESC);
CREATE INDEX boss_audit_log_created_at_idx ON why.boss_audit_log USING btree (created_at DESC);
CREATE INDEX boss_audit_log_target_idx ON why.boss_audit_log USING btree (target_user_id);
CREATE INDEX chain_layer_rewards_user_claimed_idx ON why.chain_layer_rewards USING btree (user_id, claimed_at DESC);
CREATE INDEX champion_title_history_title_time_idx ON why.champion_title_history USING btree (title_key, claimed_at DESC);
CREATE INDEX daily_missions_user_date_idx ON why.daily_missions USING btree (user_id, mission_date DESC);
CREATE INDEX discoveries_user_day_idx ON why.discoveries USING btree (user_id, seen_at DESC);
CREATE INDEX facts_category_idx ON why.facts USING btree (category);
CREATE INDEX facts_category_seq_idx ON why.facts USING btree (category, code_seq);
CREATE INDEX facts_is_adult_idx ON why.facts USING btree (is_adult);
CREATE INDEX generated_questions_user_idx ON why.generated_questions USING btree (user_id, created_at DESC);
CREATE INDEX idx_subscriptions_paddle_id ON why.subscriptions USING btree (paddle_subscription_id);
CREATE INDEX idx_subscriptions_user_id ON why.subscriptions USING btree (user_id);
CREATE INDEX quiz_answers_user_idx ON why.quiz_answers USING btree (user_id, created_at DESC);
CREATE INDEX quiz_sessions_finished_score_idx ON why.quiz_sessions USING btree (finished_at DESC, score DESC);
CREATE INDEX quiz_sessions_user_finished_idx ON why.quiz_sessions USING btree (user_id, finished_at DESC);
CREATE INDEX why_chain_steps_chain_idx ON why.why_chain_steps USING btree (chain_id, "position");
CREATE INDEX why_chains_user_updated_idx ON why.why_chains USING btree (user_id, updated_at DESC);
CREATE INDEX xp_events_category_idx ON why.xp_events USING btree (category) WHERE (category IS NOT NULL);
CREATE INDEX xp_events_created_idx ON why.xp_events USING btree (created_at DESC);
CREATE INDEX xp_events_user_created_idx ON why.xp_events USING btree (user_id, created_at DESC);
CREATE UNIQUE INDEX adult_facts_question_key ON why.adult_facts USING btree (lower(question));
CREATE UNIQUE INDEX facts_code_unique ON why.facts USING btree (code);
CREATE UNIQUE INDEX facts_question_unique ON why.facts USING btree (lower(question));
CREATE UNIQUE INDEX facts_sheet_id_key ON why.facts USING btree (sheet_id) WHERE (sheet_id IS NOT NULL);
CREATE UNIQUE INDEX profiles_username_lower_key ON why.profiles USING btree (lower(username)) WHERE (username IS NOT NULL);

-- -------------------- Functions --------------------
CREATE OR REPLACE FUNCTION why.update_updated_at_column()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'why'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$;

CREATE OR REPLACE FUNCTION why.has_role(_user_id uuid, _role why.app_role)
 RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'why'
AS $function$
  SELECT EXISTS (SELECT 1 FROM why.user_roles WHERE user_id = _user_id AND role = _role)
$function$;

CREATE OR REPLACE FUNCTION why.is_boss(_uid uuid)
 RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'why'
AS $function$
  SELECT why.has_role(_uid, 'admin'::why.app_role)
$function$;

CREATE OR REPLACE FUNCTION why.is_adult_verified(_uid uuid)
 RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'why'
AS $function$
  SELECT EXISTS (SELECT 1 FROM why.profiles WHERE id = _uid AND adult_verified_at IS NOT NULL);
$function$;

CREATE OR REPLACE FUNCTION why.apply_points(_user uuid, _points integer, _facts_seen integer DEFAULT 0)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'why'
AS $function$
DECLARE
  new_total integer;
BEGIN
  INSERT INTO why.user_stats (user_id) VALUES (_user) ON CONFLICT (user_id) DO NOTHING;
  UPDATE why.user_stats us
     SET total_points = us.total_points + _points,
         facts_seen   = us.facts_seen + COALESCE(_facts_seen, 0)
   WHERE us.user_id = _user
     AND us.total_points + _points >= 0
  RETURNING us.total_points INTO new_total;
  -- NULL means the debit would have taken the balance below zero.
  RETURN new_total;
END;
$function$;

CREATE OR REPLACE FUNCTION why.assign_fact_code()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'why'
AS $function$
DECLARE
  next_seq bigint;
BEGIN
  IF NEW.code_seq IS NULL THEN
    SELECT COALESCE(MAX(code_seq), 0) + 1 INTO next_seq
      FROM why.facts
      WHERE category IS NOT DISTINCT FROM NEW.category;
    NEW.code_seq := next_seq;
  END IF;
  IF NEW.code IS NULL THEN
    -- Opaque code: users can't tell order or category from it.
    NEW.code := 'WHY-' || upper(substr(md5(COALESCE(NEW.id::text, gen_random_uuid()::text) || '::why-code-v1'), 1, 6));
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION why.boss_decode_fact_code(_code text)
 RETURNS TABLE(id uuid, code text, code_seq bigint, category text, question text, answer text, fun_fact text, source text, created_at timestamp with time zone)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'why'
AS $function$
  SELECT f.id, f.code, f.code_seq, f.category, f.question, f.answer, f.fun_fact, f.source, f.created_at
  FROM why.facts f
  WHERE f.code = _code
    AND why.is_boss(auth.uid())
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION why.claim_champion_title(_title text, _user uuid, _value integer, _ref uuid)
 RETURNS TABLE(claimed boolean, previous_holder uuid, previous_value integer, current_value integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'why'
AS $function$
DECLARE cur why.champion_titles%ROWTYPE;
BEGIN
  SELECT * INTO cur FROM why.champion_titles WHERE title_key = _title FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO why.champion_titles(title_key, holder_user_id, record_value, reference_id)
      VALUES (_title, _user, _value, _ref);
    INSERT INTO why.champion_title_history(title_key, holder_user_id, previous_holder_user_id, record_value, previous_record_value, reference_id)
      VALUES (_title, _user, NULL, _value, 0, _ref);
    RETURN QUERY SELECT true, NULL::uuid, 0, _value;
    RETURN;
  END IF;
  IF _value > cur.record_value THEN
    UPDATE why.champion_titles
      SET holder_user_id = _user, record_value = _value, reference_id = _ref,
          claimed_at = now(), updated_at = now()
      WHERE title_key = _title;
    INSERT INTO why.champion_title_history(title_key, holder_user_id, previous_holder_user_id, record_value, previous_record_value, reference_id)
      VALUES (_title, _user, cur.holder_user_id, _value, cur.record_value, _ref);
    RETURN QUERY SELECT true, cur.holder_user_id, cur.record_value, _value;
    RETURN;
  END IF;
  RETURN QUERY SELECT false, cur.holder_user_id, cur.record_value, cur.record_value;
END; $function$;

CREATE OR REPLACE FUNCTION why.count_unseen_facts(_user uuid, _category text DEFAULT NULL::text)
 RETURNS bigint LANGUAGE sql STABLE SET search_path TO 'why'
AS $function$
  SELECT count(*) FROM why.facts f
  WHERE (_category IS NULL OR f.category = _category)
    AND NOT EXISTS (
      SELECT 1 FROM why.discoveries d
      WHERE d.user_id = _user AND d.fact_id = f.id
    );
$function$;

CREATE OR REPLACE FUNCTION why.get_public_leaderboard(_kind text DEFAULT 'global'::text, _filter text DEFAULT NULL::text)
 RETURNS TABLE(user_id uuid, username text, display_name text, avatar_id text, age_band text, favorite_category text, score integer, created_at timestamp with time zone, category text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'why'
AS $function$
DECLARE
  _window_days integer;
  _since timestamptz;
BEGIN
  IF _kind = 'global' THEN
    RETURN QUERY
      SELECT p.id, p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category,
        COALESCE(us.total_points, 0)::integer AS score, p.created_at, NULL::text AS category
      FROM why.profiles p
      LEFT JOIN why.user_stats us ON us.user_id = p.id
      WHERE COALESCE(p.leaderboard_opt_out, false) = false
        AND COALESCE(p.hide_from_public, false) = false
      ORDER BY COALESCE(us.total_points, 0) DESC NULLS LAST, p.created_at ASC;

  ELSIF _kind = 'age' THEN
    RETURN QUERY
      SELECT p.id, p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category,
        COALESCE(us.total_points, 0)::integer AS score, p.created_at, NULL::text AS category
      FROM why.profiles p
      LEFT JOIN why.user_stats us ON us.user_id = p.id
      WHERE COALESCE(p.leaderboard_opt_out, false) = false
        AND COALESCE(p.hide_from_public, false) = false
        AND p.age_band = COALESCE(_filter, 'adult')
      ORDER BY COALESCE(us.total_points, 0) DESC NULLS LAST, p.created_at ASC;

  ELSIF _kind = 'category' THEN
    RETURN QUERY
      SELECT e.user_id, p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category,
        COALESCE(SUM(e.points), 0)::integer AS score, p.created_at, e.category
      FROM why.xp_events e
      JOIN why.profiles p ON p.id = e.user_id
      WHERE e.category IS NOT NULL
        AND e.category = COALESCE(_filter, e.category)
        AND COALESCE(p.leaderboard_opt_out, false) = false
        AND COALESCE(p.hide_from_public, false) = false
      GROUP BY e.user_id, p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category, p.created_at, e.category
      ORDER BY COALESCE(SUM(e.points), 0) DESC NULLS LAST, p.created_at ASC;

  ELSIF _kind = 'window' THEN
    _window_days := CASE WHEN _filter = 'daily' THEN 1 WHEN _filter = 'monthly' THEN 30 ELSE 7 END;
    _since := now() - make_interval(days => _window_days);
    RETURN QUERY
      SELECT e.user_id, p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category,
        COALESCE(SUM(e.points), 0)::integer AS score, MAX(e.created_at) AS created_at, NULL::text AS category
      FROM why.xp_events e
      JOIN why.profiles p ON p.id = e.user_id
      WHERE e.created_at >= _since
        AND COALESCE(p.leaderboard_opt_out, false) = false
        AND COALESCE(p.hide_from_public, false) = false
      GROUP BY e.user_id, p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category
      ORDER BY COALESCE(SUM(e.points), 0) DESC NULLS LAST, MAX(e.created_at) ASC;

  ELSIF _kind = 'rising' THEN
    RETURN QUERY
      SELECT e.user_id, p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category,
        COALESCE(SUM(e.points), 0)::integer AS score, MAX(e.created_at) AS created_at, NULL::text AS category
      FROM why.xp_events e
      JOIN why.profiles p ON p.id = e.user_id
      WHERE e.created_at >= now() - interval '7 days'
        AND COALESCE(p.leaderboard_opt_out, false) = false
        AND COALESCE(p.hide_from_public, false) = false
      GROUP BY e.user_id, p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category
      ORDER BY COALESCE(SUM(e.points), 0) DESC NULLS LAST, MAX(e.created_at) ASC;

  ELSIF _kind = 'streaks' THEN
    RETURN QUERY
      SELECT p.id, p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category,
        COALESCE(us.current_streak, 0)::integer AS score, p.created_at, NULL::text AS category
      FROM why.profiles p
      LEFT JOIN why.user_stats us ON us.user_id = p.id
      WHERE COALESCE(us.current_streak, 0) > 0
        AND COALESCE(p.leaderboard_opt_out, false) = false
        AND COALESCE(p.hide_from_public, false) = false
      ORDER BY COALESCE(us.current_streak, 0) DESC NULLS LAST, p.created_at ASC;

  ELSIF _kind = 'weekend' THEN
    RETURN QUERY
      SELECT e.user_id, p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category,
        COALESCE(SUM(e.points), 0)::integer AS score, MAX(e.created_at) AS created_at, NULL::text AS category
      FROM why.xp_events e
      JOIN why.profiles p ON p.id = e.user_id
      WHERE e.created_at >= now() - interval '30 days'
        AND EXTRACT(isodow FROM e.created_at) IN (6, 7)
        AND COALESCE(p.leaderboard_opt_out, false) = false
        AND COALESCE(p.hide_from_public, false) = false
      GROUP BY e.user_id, p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category
      ORDER BY COALESCE(SUM(e.points), 0) DESC NULLS LAST, MAX(e.created_at) ASC;

  ELSIF _kind = 'new' THEN
    RETURN QUERY
      SELECT p.id, p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category,
        COALESCE(us.total_points, 0)::integer AS score, p.created_at, NULL::text AS category
      FROM why.profiles p
      LEFT JOIN why.user_stats us ON us.user_id = p.id
      WHERE p.created_at >= now() - interval '14 days'
        AND COALESCE(p.leaderboard_opt_out, false) = false
        AND COALESCE(p.hide_from_public, false) = false
      ORDER BY COALESCE(us.total_points, 0) DESC NULLS LAST, p.created_at ASC;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION why.guard_avatar_outfit()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'why'
AS $function$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND NEW.avatar_outfit IS DISTINCT FROM OLD.avatar_outfit THEN
    NEW.avatar_outfit := OLD.avatar_outfit;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION why.has_active_subscription(user_uuid uuid, check_env text DEFAULT 'live'::text)
 RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path TO 'why'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM why.subscriptions
    WHERE user_id = user_uuid
      AND environment = check_env
      AND status IN ('active', 'trialing')
      AND (current_period_end IS NULL OR current_period_end > now())
  );
$function$;

CREATE OR REPLACE FUNCTION why.purchase_item(_user uuid, _item text, _cost integer)
 RETURNS TABLE(out_status text, out_total integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'why'
AS $function$
DECLARE
  inserted integer;
  bal integer;
BEGIN
  IF _cost < 0 THEN
    RAISE EXCEPTION 'invalid cost';
  END IF;

  INSERT INTO why.user_stats (user_id) VALUES (_user) ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO why.user_inventory (user_id, item_id, cost)
  VALUES (_user, _item, _cost)
  ON CONFLICT (user_id, item_id) DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;

  IF inserted = 0 THEN
    SELECT us.total_points INTO bal FROM why.user_stats us WHERE us.user_id = _user;
    RETURN QUERY SELECT 'already_owned'::text, COALESCE(bal, 0);
    RETURN;
  END IF;

  UPDATE why.user_stats us
     SET total_points = us.total_points - _cost
   WHERE us.user_id = _user
     AND us.total_points >= _cost
  RETURNING us.total_points INTO bal;

  IF NOT FOUND THEN
    DELETE FROM why.user_inventory ui WHERE ui.user_id = _user AND ui.item_id = _item;
    SELECT us.total_points INTO bal FROM why.user_stats us WHERE us.user_id = _user;
    RETURN QUERY SELECT 'insufficient_coins'::text, COALESCE(bal, 0);
    RETURN;
  END IF;

  RETURN QUERY SELECT 'ok'::text, bal;
END;
$function$;

-- New in the hub: Why?'s rows for an account are made the first time that
-- account uses Why? (the hub's accounts are shared by several apps, so this
-- can't run on every sign-up the way handle_new_user did on Lovable).
CREATE OR REPLACE FUNCTION why.ensure_member(_uid uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'why'
AS $function$
DECLARE
  u auth.users%ROWTYPE;
BEGIN
  IF EXISTS (SELECT 1 FROM why.profiles WHERE id = _uid) THEN
    INSERT INTO why.user_stats (user_id) VALUES (_uid) ON CONFLICT (user_id) DO NOTHING;
    INSERT INTO why.user_settings (user_id) VALUES (_uid) ON CONFLICT (user_id) DO NOTHING;
    RETURN;
  END IF;
  SELECT * INTO u FROM auth.users WHERE id = _uid;
  IF NOT FOUND THEN RETURN; END IF;
  INSERT INTO why.profiles (id, display_name, username)
    VALUES (_uid,
      COALESCE(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1)),
      -- Only take the sign-up username if no Why? player already has it.
      CASE WHEN EXISTS (SELECT 1 FROM why.profiles p WHERE lower(p.username) = lower(u.raw_user_meta_data->>'username'))
           THEN NULL ELSE u.raw_user_meta_data->>'username' END)
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO why.user_stats (user_id) VALUES (_uid) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO why.user_settings (user_id) VALUES (_uid) ON CONFLICT (user_id) DO NOTHING;
END;
$function$;

-- -------------------- Views --------------------
CREATE VIEW why.leaderboard_category WITH (security_invoker=on) AS SELECT e.user_id, e.category, p.username, p.display_name, p.avatar_id, p.age_band, sum(e.points)::integer AS score
   FROM why.xp_events e LEFT JOIN why.profiles p ON p.id = e.user_id
  WHERE e.category IS NOT NULL AND COALESCE(p.leaderboard_opt_out, false) = false AND COALESCE(p.hide_from_public, false) = false
  GROUP BY e.user_id, e.category, p.username, p.display_name, p.avatar_id, p.age_band;
CREATE VIEW why.leaderboard_global WITH (security_invoker=on) AS SELECT p.id AS user_id, p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category,
    COALESCE(us.total_points, 0) AS score, COALESCE(us.current_streak, 0) AS current_streak, COALESCE(us.longest_streak, 0) AS longest_streak, COALESCE(us.facts_seen, 0) AS facts_seen
   FROM why.profiles p LEFT JOIN why.user_stats us ON us.user_id = p.id
  WHERE COALESCE(p.leaderboard_opt_out, false) = false AND COALESCE(p.hide_from_public, false) = false
  ORDER BY (COALESCE(us.total_points, 0)) DESC NULLS LAST;
CREATE VIEW why.leaderboard_new WITH (security_invoker=on) AS SELECT us.user_id, p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category, COALESCE(us.total_points, 0) AS score, p.created_at AS joined_at
   FROM why.user_stats us LEFT JOIN why.profiles p ON p.id = us.user_id
  WHERE p.created_at >= (now() - '14 days'::interval) AND COALESCE(p.leaderboard_opt_out, false) = false AND COALESCE(p.hide_from_public, false) = false;
CREATE VIEW why.leaderboard_rising WITH (security_invoker=on) AS SELECT e.user_id, p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category, sum(e.points)::integer AS score
   FROM why.xp_events e LEFT JOIN why.profiles p ON p.id = e.user_id
  WHERE e.created_at >= (now() - '7 days'::interval) AND COALESCE(p.leaderboard_opt_out, false) = false AND COALESCE(p.hide_from_public, false) = false
  GROUP BY e.user_id, p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category;
CREATE VIEW why.leaderboard_streaks WITH (security_invoker=on) AS SELECT us.user_id, p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category, us.current_streak AS score, us.longest_streak
   FROM why.user_stats us LEFT JOIN why.profiles p ON p.id = us.user_id
  WHERE us.current_streak > 0 AND COALESCE(p.leaderboard_opt_out, false) = false AND COALESCE(p.hide_from_public, false) = false;
CREATE VIEW why.leaderboard_weekend WITH (security_invoker=on) AS SELECT e.user_id, p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category, sum(e.points)::integer AS score
   FROM why.xp_events e LEFT JOIN why.profiles p ON p.id = e.user_id
  WHERE e.created_at >= (now() - '30 days'::interval) AND (EXTRACT(isodow FROM e.created_at) = ANY (ARRAY[6::numeric, 7::numeric])) AND COALESCE(p.leaderboard_opt_out, false) = false AND COALESCE(p.hide_from_public, false) = false
  GROUP BY e.user_id, p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category;
CREATE VIEW why.leaderboard_weekly WITH (security_invoker=on) AS SELECT s.user_id, p.username, p.display_name, p.avatar_id, sum(s.score)::integer AS week_score, count(*)::integer AS quizzes_played, max(s.score) AS best_this_week
   FROM why.quiz_sessions s LEFT JOIN why.profiles p ON p.id = s.user_id
  WHERE s.finished_at >= date_trunc('week'::text, now()) AND COALESCE(p.leaderboard_opt_out, false) = false AND COALESCE(p.hide_from_public, false) = false
  GROUP BY s.user_id, p.username, p.display_name, p.avatar_id
  ORDER BY (sum(s.score)::integer) DESC;
CREATE VIEW why.leaderboard_windowed WITH (security_invoker=on) AS SELECT e.user_id, p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category, sum(e.points)::integer AS score, e.created_at
   FROM why.xp_events e LEFT JOIN why.profiles p ON p.id = e.user_id
  WHERE COALESCE(p.leaderboard_opt_out, false) = false AND COALESCE(p.hide_from_public, false) = false
  GROUP BY e.user_id, p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category, e.created_at;
CREATE VIEW why.profiles_public WITH (security_invoker=on) AS SELECT id, display_name, username, avatar_id, bio, favorite_category, leaderboard_opt_out, created_at, updated_at
   FROM why.profiles WHERE hide_from_public = false;

-- -------------------- Triggers --------------------
CREATE TRIGGER guard_avatar_outfit BEFORE UPDATE ON why.profiles FOR EACH ROW EXECUTE FUNCTION why.guard_avatar_outfit();
CREATE TRIGGER quiz_stats_updated_at BEFORE UPDATE ON why.quiz_stats FOR EACH ROW EXECUTE FUNCTION why.update_updated_at_column();
CREATE TRIGGER trg_assign_fact_code BEFORE INSERT ON why.facts FOR EACH ROW EXECUTE FUNCTION why.assign_fact_code();
CREATE TRIGGER trg_facts_updated_at BEFORE UPDATE ON why.facts FOR EACH ROW EXECUTE FUNCTION why.update_updated_at_column();
CREATE TRIGGER update_chain_collections_updated_at BEFORE UPDATE ON why.chain_collections FOR EACH ROW EXECUTE FUNCTION why.update_updated_at_column();
CREATE TRIGGER update_daily_missions_updated_at BEFORE UPDATE ON why.daily_missions FOR EACH ROW EXECUTE FUNCTION why.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON why.profiles FOR EACH ROW EXECUTE FUNCTION why.update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON why.subscriptions FOR EACH ROW EXECUTE FUNCTION why.update_updated_at_column();
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON why.user_settings FOR EACH ROW EXECUTE FUNCTION why.update_updated_at_column();
CREATE TRIGGER update_user_stats_updated_at BEFORE UPDATE ON why.user_stats FOR EACH ROW EXECUTE FUNCTION why.update_updated_at_column();
CREATE TRIGGER update_why_chains_updated_at BEFORE UPDATE ON why.why_chains FOR EACH ROW EXECUTE FUNCTION why.update_updated_at_column();

-- -------------------- Row level security --------------------
DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'why' LOOP
    EXECUTE format('ALTER TABLE why.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

CREATE POLICY "Achievements are public" ON why.achievements AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated can read app_config" ON why.app_config AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Boss can read audit log" ON why.boss_audit_log AS PERMISSIVE FOR SELECT TO authenticated USING (why.is_boss(auth.uid()));
CREATE POLICY "Boss can write app_config" ON why.app_config AS PERMISSIVE FOR ALL TO authenticated USING (why.is_boss(auth.uid())) WITH CHECK (why.is_boss(auth.uid()));
CREATE POLICY "Public can view shared chain steps" ON why.why_chain_steps AS PERMISSIVE FOR SELECT TO public USING ((EXISTS (SELECT 1 FROM why.why_chains c WHERE ((c.id = why_chain_steps.chain_id) AND (c.is_public = true)))));
CREATE POLICY "Public can view shared chains" ON why.why_chains AS PERMISSIVE FOR SELECT TO public USING ((is_public = true));
CREATE POLICY "Read kid-safe facts" ON why.facts AS PERMISSIVE FOR SELECT TO anon, authenticated USING ((is_adult = false));
CREATE POLICY "Service role can manage subscriptions" ON why.subscriptions AS PERMISSIVE FOR ALL TO public USING ((auth.role() = 'service_role'::text));
CREATE POLICY "Users can insert own profile" ON why.profiles AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = id));
CREATE POLICY "Users can update own profile" ON why.profiles AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));
CREATE POLICY "Users can view own profile" ON why.profiles AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = id));
CREATE POLICY "Users can view own subscription" ON why.subscriptions AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users insert own discoveries" ON why.discoveries AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users insert own settings" ON why.user_settings AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users manage own category interests" ON why.category_interests AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users manage own chain steps" ON why.why_chain_steps AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users manage own collection items" ON why.chain_collection_items AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users manage own collections" ON why.chain_collections AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users manage own favorites" ON why.favorites AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users manage own why_chains" ON why.why_chains AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users read own achievements" ON why.user_achievements AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users read own discoveries" ON why.discoveries AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users read own generated_questions" ON why.generated_questions AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users read own inventory" ON why.user_inventory AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users read own missions" ON why.daily_missions AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users read own plus entitlement" ON why.plus_entitlements AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users read own settings" ON why.user_settings AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users read own stats" ON why.user_stats AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users update own settings" ON why.user_settings AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "achievements readable by authenticated" ON why.achievements AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "boss manages categories" ON why.categories AS PERMISSIVE FOR ALL TO authenticated USING (why.is_boss(auth.uid())) WITH CHECK (why.is_boss(auth.uid()));
CREATE POLICY "categories readable by all" ON why.categories AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "champion_title_history public read" ON why.champion_title_history AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "champion_titles public read" ON why.champion_titles AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "own quiz answers read" ON why.quiz_answers AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "own quiz sessions read" ON why.quiz_sessions AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "own quiz stats read" ON why.quiz_stats AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "own xp events read" ON why.xp_events AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "ui_overrides boss write" ON why.ui_overrides AS PERMISSIVE FOR ALL TO authenticated USING (why.has_role(auth.uid(), 'admin'::why.app_role)) WITH CHECK (why.has_role(auth.uid(), 'admin'::why.app_role));
CREATE POLICY "ui_overrides public read" ON why.ui_overrides AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "users read own roles" ON why.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));

-- -------------------- Permissions (same as on Lovable) --------------------
GRANT ALL ON ALL TABLES IN SCHEMA why TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA why TO service_role;
GRANT ALL ON why.achievements, why.boss_audit_log, why.categories, why.category_interests,
  why.chain_collection_items, why.chain_collections, why.champion_title_history, why.champion_titles,
  why.discoveries, why.facts, why.favorites, why.generated_questions, why.profiles, why.quiz_stats,
  why.subscriptions, why.ui_overrides, why.user_achievements, why.user_roles, why.user_settings,
  why.user_stats, why.why_chain_steps, why.why_chains, why.xp_events,
  why.leaderboard_category, why.leaderboard_global, why.leaderboard_new, why.leaderboard_rising,
  why.leaderboard_streaks, why.leaderboard_weekend, why.leaderboard_weekly, why.leaderboard_windowed,
  why.profiles_public
  TO anon, authenticated;
GRANT ALL ON why.app_config TO authenticated;
GRANT INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON why.app_config TO anon;
GRANT SELECT, REFERENCES, TRIGGER, TRUNCATE ON why.daily_missions, why.quiz_answers TO anon, authenticated;
GRANT REFERENCES, TRIGGER, TRUNCATE ON why.quiz_sessions TO anon, authenticated;
GRANT SELECT ON why.plus_entitlements, why.user_inventory TO authenticated;

REVOKE EXECUTE ON FUNCTION why.apply_points(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION why.assign_fact_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION why.boss_decode_fact_code(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION why.claim_champion_title(text, uuid, integer, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION why.count_unseen_facts(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION why.get_public_leaderboard(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION why.has_active_subscription(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION why.purchase_item(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION why.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION why.ensure_member(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA why TO service_role;
