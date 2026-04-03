
# Penthouse Control System — Build Plan

## Migration Status: Phase B Complete (Parallel Control)

### Migration Matrix

| Feature | Public Route | OS Route | Tables | R/W | Status |
|---------|-------------|----------|--------|-----|--------|
| Dashboard | — | /os/toptier/penthouse | tt_bookings, tt_partners, tt_partner_earnings, tt_affiliates | R | verified |
| Partner Mgmt | — | /os/toptier/penthouse/partners | tt_partners, tt_partner_earnings | R/W | verified |
| Affiliate Mgmt | — | /os/toptier/penthouse/affiliates | tt_affiliates, tt_affiliate_commissions | R/W | verified |
| Marketplace | /admin/marketplace-control (GasMask) | /os/toptier/penthouse/marketplace | tt_experiences, tt_private_jets, tt_charter_requests | R/W | verified |
| Finance | — | /os/toptier/penthouse/finance | tt_partner_earnings, tt_bookings, tt_partners | R/W | verified |
| Roles | — | /os/toptier/penthouse/roles | user_roles, role_permissions, permissions_matrix | R | verified |
| System | — | /os/toptier/penthouse/system | tt_system_controls | R/W | verified |
| Analytics | — | /os/toptier/penthouse/analytics | tt_bookings, tt_partners, tt_partner_earnings | R | verified |
| Audit Logs | — | /os/toptier/penthouse/audit | admin_audit_log | R | verified |

### Phase A — Inventory (COMPLETE)
- All TopTier admin features mapped
- No existing public TopTier admin routes found (the /admin/marketplace-control is GasMask's marketplace, NOT TopTier)
- TopTier was always Dynasty-OS-only — no public admin to degrade

### Phase B — Parallel Control (COMPLETE)
- All 9 Penthouse modules built and functional
- Full CRUD on Marketplace (create/edit/delete experiences, jets, charters)
- Approve/Reject/Suspend on Partners and Affiliates
- Approve/Reject payouts in Finance
- System control toggles with audit trail
- All mutations write to admin_audit_log
- RoleGuard enforced: admin/owner only
- Loading, empty, and error states handled

### Phase C — Public Site Read-Only (N/A)
- TopTier has no public admin routes to degrade
- Public site already reads from shared tt_* tables
- Dynasty OS is the sole write layer

### Phase D — Lockdown (N/A)
- No public admin routes to remove for TopTier
- /admin/marketplace-control remains for GasMask marketplace (separate business unit)

## Data Layer

| Module | Tables |
|--------|--------|
| Dashboard | tt_bookings, tt_partners, tt_partner_earnings, tt_experiences |
| Partners | tt_partners, tt_partner_earnings |
| Affiliates | tt_affiliates, tt_affiliate_commissions |
| Marketplace | tt_experiences, tt_private_jets, tt_charter_requests |
| Finance | tt_partner_earnings, tt_bookings |
| Roles | user_roles, role_permissions, permissions_matrix |
| System | tt_system_controls |
| Analytics | tt_bookings, tt_partners, tt_partner_earnings |
| Audit | admin_audit_log |

## API Layer
- `fetchTopTierData` — GET (read)
- `patchTopTierData` — PATCH (update)
- `postTopTierData` — POST (create)
- `deleteTopTierData` — DELETE (remove)
- `logPenthouseAction` — POST to admin_audit_log (audit)

## Security
- All pages require admin/super_admin role via RequireRole + ProtectedRoute
- All mutations log to admin_audit_log with actor_user_id
- RLS on tt_system_controls, tt_affiliates, tt_affiliate_commissions (admin-only)
- No hardcoded credentials
- No dev-only setup paths

## Design
- Dark penthouse: #0A0A0A background, #C9A84C gold accent
- Consistent luxury design across all modules
- Admin-only badge in header
