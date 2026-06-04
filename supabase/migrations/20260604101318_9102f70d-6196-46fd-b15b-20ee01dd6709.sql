
-- T2 Sidebar Sweep: mark fixed pages ready in floor_directory
UPDATE public.floor_directory
SET status = 'ready', last_audited = now()
WHERE page_route IN (
  '/analytics/revenue-brain',
  '/gasmask/leaderboard',
  '/gasmask/territories',
  '/brand/gasmask',
  '/system-operations/ai-ceo-control-room',
  '/settings/automation',
  '/crm/data/backup',
  '/pod/generate',
  '/communication/follow-ups',
  '/influencers/campaigns',
  '/ai/workforce',
  '/meta-ai'
);

-- Mark legacy sidebar paths as kill_pending (now redirect-only)
UPDATE public.floor_directory
SET status = 'kill_pending', last_audited = now()
WHERE page_route IN (
  '/revenue-brain',
  '/leaderboard',
  '/territories',
  '/brand-dashboard',
  '/ai-ceo',
  '/automation-settings',
  '/crm/backup',
  '/pod/generator',
  '/communication/follow-up',
  '/influencer-campaigns',
  '/ai/meta'
);
