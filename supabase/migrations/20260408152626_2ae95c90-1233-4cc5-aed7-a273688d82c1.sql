CREATE TABLE public.schedule_bounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stop_diva text NOT NULL,
  line_name text NOT NULL,
  towards text NOT NULL,
  first_departure text NOT NULL,
  last_departure text NOT NULL,
  computed_date date NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_schedule_bounds_diva ON public.schedule_bounds(stop_diva);
CREATE INDEX idx_schedule_bounds_date ON public.schedule_bounds(computed_date);

ALTER TABLE public.schedule_bounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.schedule_bounds
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Allow service role insert" ON public.schedule_bounds
  FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Allow service role delete" ON public.schedule_bounds
  FOR DELETE TO service_role
  USING (true);