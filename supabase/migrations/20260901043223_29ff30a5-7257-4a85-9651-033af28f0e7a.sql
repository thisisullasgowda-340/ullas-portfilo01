CREATE TABLE public.watch_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN ('vitals', 'steps', 'game_score')),
  heart_rate integer,
  spo2 integer,
  steps integer,
  score integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.watch_events TO anon;
GRANT SELECT ON public.watch_events TO authenticated;
GRANT ALL ON public.watch_events TO service_role;

ALTER TABLE public.watch_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read watch telemetry"
  ON public.watch_events
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE INDEX watch_events_type_created_at_idx
  ON public.watch_events (event_type, created_at DESC);

INSERT INTO public.watch_events (event_type, heart_rate, spo2, created_at) VALUES
  ('vitals', 98, 97, now() - interval '4 minutes'),
  ('vitals', 94, 98, now() - interval '9 minutes'),
  ('vitals', 88, 98, now() - interval '14 minutes'),
  ('vitals', 82, 99, now() - interval '19 minutes'),
  ('vitals', 78, 98, now() - interval '24 minutes'),
  ('vitals', 74, 99, now() - interval '29 minutes');

INSERT INTO public.watch_events (event_type, steps, created_at) VALUES
  ('steps', 6842, now() - interval '4 minutes'),
  ('steps', 6120, now() - interval '39 minutes'),
  ('steps', 5480, now() - interval '74 minutes'),
  ('steps', 4960, now() - interval '109 minutes'),
  ('steps', 4210, now() - interval '144 minutes'),
  ('steps', 3680, now() - interval '179 minutes');

INSERT INTO public.watch_events (event_type, score, created_at) VALUES
  ('game_score', 1280, now() - interval '4 minutes'),
  ('game_score', 1100, now() - interval '19 minutes'),
  ('game_score', 940, now() - interval '34 minutes'),
  ('game_score', 720, now() - interval '49 minutes');