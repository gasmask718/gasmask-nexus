ALTER TABLE public.sbo_signals ADD COLUMN IF NOT EXISTS game_id uuid REFERENCES public.sbo_games(id);
ALTER TABLE public.sbo_signals ADD COLUMN IF NOT EXISTS graded_at timestamptz;
ALTER TABLE public.sbo_signals ADD COLUMN IF NOT EXISTS grading_source text;