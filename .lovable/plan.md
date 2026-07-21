## Expand role gating for RE and SF hubs

Update `src/AppRoutes.tsx`:

- `<Route path="/real-estate">` — change `RequireRole` to:
  `allowedRoles={['owner','admin','va','employee','staff','realestate_worker']}`
- `<Route path="/surplus-funds">` — change `RequireRole` to:
  `allowedRoles={['owner','admin','va','employee','staff']}`

No other files touched. Existing RLS policies already permit these roles, so unblocking the routes is sufficient.