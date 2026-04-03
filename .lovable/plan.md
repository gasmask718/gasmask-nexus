
# Penthouse Control System — Build Plan

## Data Layer (Existing Tables)
All data comes from existing `tt_*` tables + `admin_audit_log`, `user_roles`, `role_permissions`, `system_settings`:

| Module | Tables |
|--------|--------|
| Dashboard | tt_bookings, tt_partners, tt_partner_earnings, tt_experiences |
| Partners | tt_partners, tt_partner_earnings, tt_bookings |
| Affiliates | affiliate_clicks, affiliate_conversions (no tt-specific affiliate table — will use these) |
| Marketplace | tt_experiences, tt_bookings, tt_charter_requests, tt_private_jets |
| Finance | tt_partner_earnings, tt_bookings |
| Roles | user_roles, role_permissions, permissions_matrix |
| System | system_settings |
| Analytics | tt_bookings, tt_partners, tt_partner_earnings |
| Audit | admin_audit_log |

## New Tables Needed
1. `tt_system_controls` — pause bookings, disable categories, emergency controls
2. `tt_affiliates` — TopTier-specific affiliate/ambassador tracking

## Routes (all under `/os/toptier/penthouse/`)
- `/os/toptier/penthouse` — Dashboard
- `/os/toptier/penthouse/partners` — Partner Management
- `/os/toptier/penthouse/affiliates` — Affiliate Management
- `/os/toptier/penthouse/marketplace` — Marketplace Control
- `/os/toptier/penthouse/finance` — Finance Control
- `/os/toptier/penthouse/roles` — Role & Permission Control
- `/os/toptier/penthouse/system` — System Controls
- `/os/toptier/penthouse/analytics` — Analytics & Intelligence
- `/os/toptier/penthouse/audit` — Audit Logs

## Implementation Order
1. Create required new tables (tt_system_controls, tt_affiliates)
2. Build Penthouse layout with sidebar navigation
3. Build Dashboard page
4. Build Partner Management page
5. Build Affiliate Management page
6. Build Marketplace Control page (CRUD for experiences, jets, charters)
7. Build Finance Control page
8. Build Role & Permission page
9. Build System Controls page
10. Build Analytics page
11. Build Audit Logs page
12. Wire routes into existing TopTier hub navigation

## Design
- Dark penthouse: #0A0A0A background, #C9A84C gold accent
- Same luxury design system as existing TopTier Hub
- Admin-only access enforced via RoleGuard

## Security
- All pages require admin/super_admin role check
- All mutations log to admin_audit_log
