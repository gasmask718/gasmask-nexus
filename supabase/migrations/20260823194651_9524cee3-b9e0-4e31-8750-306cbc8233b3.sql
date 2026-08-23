INSERT INTO public.outreach_switches (key, label, what_it_does, channel, reaches, cron_jobid, cron_schedule, enabled, notes)
VALUES (
  'dynasty_collections_agent',
  'Collections agent (Brandaro)',
  'AI agent texts Brandaro leads with stuck booked accounts a payment reminder, Mon/Wed/Fri afternoons',
  'SMS',
  'Brandaro leads with pending accounts',
  20,
  'Mon/Wed/Fri 2pm',
  false,
  'Found ungated during 2026-08-23 switchboard build — sends send-sms directly from dynasty-agent-runner.'
)
ON CONFLICT (key) DO NOTHING;