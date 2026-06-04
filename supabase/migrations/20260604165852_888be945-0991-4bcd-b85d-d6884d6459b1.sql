
-- Allow 'planned' status for designed-but-not-built routes
ALTER TABLE public.floor_directory DROP CONSTRAINT IF EXISTS floor_directory_status_check;
ALTER TABLE public.floor_directory ADD CONSTRAINT floor_directory_status_check
  CHECK (status = ANY (ARRAY['ready'::text, 'needs_work'::text, 'stub'::text, 'kill_pending'::text, 'dormant'::text, 'planned'::text]));

INSERT INTO public.floor_directory (floor, section, page_route, page_name, purpose, status, gaps_count, audit_pass, last_audited)
VALUES
  ('Owner', 'Holdings', '/os/owner/holdings', 'Investment Command', 'Doorway deck for every investment class; honest-data mode', 'ready', 0, true, now()),
  ('Owner', 'Holdings', '/os/owner/holdings/sports', 'Sports Betting AI', 'Live model accuracy + saved-pick volume from SBO; bankroll honest-empty', 'ready', 0, true, now()),
  ('Owner', 'Holdings', '/os/owner/holdings/property/:propertyId', 'Property Detail', 'Reads single re_deals row; empty state when no deal', 'ready', 0, true, now()),
  ('Owner', 'Holdings', '/os/owner/holdings/crypto', 'Crypto Hub', 'External platform — connection pending with paste-link affordance', 'ready', 0, true, now()),
  ('Owner', 'Holdings', '/os/owner/holdings/auto-trading', 'Auto-Trading AI', 'Bundled with Crypto Hub external link; activates on connection', 'ready', 0, true, now()),
  ('Owner', 'Holdings', '/os/owner/investment-engine', 'Dynasty Investment Engine', 'PLANNED — Stocks, mortgage notes, private deal flow (R2-NEW-1)', 'planned', 0, false, now()),
  ('Owner', 'Holdings', '/os/owner/crypto-hub', 'Crypto / Auto-Trading Hub', 'PLANNED — embed/connect/import ruling when external link arrives (R2-NEW-2)', 'planned', 0, false, now())
ON CONFLICT (page_route) DO UPDATE
  SET page_name   = EXCLUDED.page_name,
      purpose     = EXCLUDED.purpose,
      status      = EXCLUDED.status,
      section     = EXCLUDED.section,
      floor       = EXCLUDED.floor,
      gaps_count  = EXCLUDED.gaps_count,
      audit_pass  = EXCLUDED.audit_pass,
      last_audited= now();
