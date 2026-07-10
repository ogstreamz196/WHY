
CREATE TABLE public.champion_titles (
  title_key text PRIMARY KEY,
  holder_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  record_value integer NOT NULL DEFAULT 0,
  reference_id uuid,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.champion_titles TO anon, authenticated;
GRANT ALL ON public.champion_titles TO service_role;
ALTER TABLE public.champion_titles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "champion_titles public read" ON public.champion_titles FOR SELECT USING (true);

CREATE TABLE public.champion_title_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_key text NOT NULL,
  holder_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  previous_holder_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  record_value integer NOT NULL,
  previous_record_value integer NOT NULL DEFAULT 0,
  reference_id uuid,
  claimed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX champion_title_history_title_time_idx
  ON public.champion_title_history (title_key, claimed_at DESC);
GRANT SELECT ON public.champion_title_history TO anon, authenticated;
GRANT ALL ON public.champion_title_history TO service_role;
ALTER TABLE public.champion_title_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "champion_title_history public read" ON public.champion_title_history FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.claim_champion_title(
  _title text, _user uuid, _value integer, _ref uuid
) RETURNS TABLE(claimed boolean, previous_holder uuid, previous_value integer, current_value integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cur public.champion_titles%ROWTYPE;
BEGIN
  SELECT * INTO cur FROM public.champion_titles WHERE title_key = _title FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.champion_titles(title_key, holder_user_id, record_value, reference_id)
      VALUES (_title, _user, _value, _ref);
    INSERT INTO public.champion_title_history(title_key, holder_user_id, previous_holder_user_id, record_value, previous_record_value, reference_id)
      VALUES (_title, _user, NULL, _value, 0, _ref);
    RETURN QUERY SELECT true, NULL::uuid, 0, _value;
    RETURN;
  END IF;
  IF _value > cur.record_value THEN
    UPDATE public.champion_titles
      SET holder_user_id = _user, record_value = _value, reference_id = _ref,
          claimed_at = now(), updated_at = now()
      WHERE title_key = _title;
    INSERT INTO public.champion_title_history(title_key, holder_user_id, previous_holder_user_id, record_value, previous_record_value, reference_id)
      VALUES (_title, _user, cur.holder_user_id, _value, cur.record_value, _ref);
    RETURN QUERY SELECT true, cur.holder_user_id, cur.record_value, _value;
    RETURN;
  END IF;
  RETURN QUERY SELECT false, cur.holder_user_id, cur.record_value, cur.record_value;
END; $$;

GRANT EXECUTE ON FUNCTION public.claim_champion_title(text, uuid, integer, uuid) TO authenticated, service_role;
