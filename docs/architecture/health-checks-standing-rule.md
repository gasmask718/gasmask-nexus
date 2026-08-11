# System Health — standing rule

Every new feature MUST register its health checks in `public.health_checks`.

When you ship:

- **A new cron** → add a row with `kind='cron'`, the `jobname`, and `cadence_expected_minutes`. The runner auto-tracks lateness via `cron.job_run_details`.
- **A new edge function called on a schedule** → register the cron above; optionally add a `kind='function'` probe.
- **A new trigger** → register a `kind='trigger'` heartbeat in `system-health-runner` (a cheap SQL that proves the side-effect happened in the expected window).
- **A new multi-step pipeline** → register `kind='chain'` with `config.synthetic = true`, and add a synthetic-test branch in the runner that exercises it end-to-end.
- **A new third-party integration** → register `kind='integration'` and add a ping (key reachable + cheap probe). If keys aren't connected yet, register with `config.key_ready = true` — it will sit yellow until the key lands, then auto-monitor.
- **A new data invariant** → register `kind='data_canary'` with a SQL count + a threshold. The runner reads the threshold from `config`.
- **A new AI agent** → register `kind='agent'` with `config.function` (edge function name) and `config.outputs_table` (the table where its output lands). The runner proves the agent is alive by checking for recent rows.

Then the check shows up automatically on `/system-health`, sparklines populate over time, RED items SMS David (6h dedupe) and feed the DD AlertBar.

**No exceptions.** A feature without a health check is not shipped.

## Dynasty Direct money-path monitoring (added 2026-08-11)

- `public.dd_error_log` — every failure in `dd-create-checkout`, `dd-auto-price`,
  `dd-generate-description`, and the browser product-save path (via `dd-log-error`)
  is written here by `supabase/functions/_shared/ddAlert.ts`, which also SMSes
  David (30-minute dedupe per source, `DD_ALERT_DEDUPE_MINUTES`).
- Client code reports via `src/lib/dd/reportDdError.ts` → `dd-log-error`.
- Registered checks: `function.dd_create_checkout`, `function.dd_auto_price`,
  `function.dd_generate_description`, `function.dd_log_error` (real HTTP probes,
  `kind='function'`, `config.probe_body = { healthcheck: true }`), plus
  `canary.dd_error_spike` (warn >3 errors/60m, fail >9).
- Health probes are no-ops inside each function: they return before any Stripe,
  AI, or DB work.
