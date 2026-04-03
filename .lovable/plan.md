
# Penthouse Control System — Build Plan

## Migration Status: Admin Consolidation Complete

### Feature Parity Matrix

| Feature | Public Admin Route | OS Route | Tables | Media/Storage | R/W | Status |
|---------|-------------------|----------|--------|---------------|-----|--------|
| Dashboard | — | /os/toptier/penthouse | tt_bookings, tt_partners, tt_partner_earnings, tt_affiliates | — | R | verified |
| Partner Mgmt | — | /os/toptier/penthouse/partners | tt_partners, tt_partner_earnings | toptier-assets/partners | R/W | verified |
| Affiliate Mgmt | — | /os/toptier/penthouse/affiliates | tt_affiliates, tt_affiliate_commissions | toptier-assets/affiliates | R/W | verified |
| Marketplace | /admin/marketplace-control (GasMask) | /os/toptier/penthouse/marketplace | tt_experiences, tt_private_jets, tt_charter_requests | toptier-assets/experiences, toptier-assets/jets | R/W | verified |
| Finance | — | /os/toptier/penthouse/finance | tt_partner_earnings, tt_bookings, tt_partners | — | R/W | verified |
| Roles | — | /os/toptier/penthouse/roles | user_roles, role_permissions, permissions_matrix | — | R | verified |
| System | — | /os/toptier/penthouse/system | tt_system_controls | — | R/W | verified |
| Analytics | — | /os/toptier/penthouse/analytics | tt_bookings, tt_partners, tt_partner_earnings | — | R | verified |
| Audit Logs | — | /os/toptier/penthouse/audit | admin_audit_log | — | R | verified |

### Consolidation Audit Results

**TopTier has NO existing public admin routes** — the /admin/marketplace-control is GasMask's marketplace (separate business unit). TopTier was always Dynasty-OS-only.

### Admin Consolidation Features Added

1. **Media Management** (NEW)
   - `toptier-assets` storage bucket created with public read + authenticated write
   - Experience cover images + gallery management
   - Jet photos + gallery management
   - Partner avatar uploads
   - Affiliate avatar uploads
   - All media URLs stored in respective table columns

2. **Enhanced Marketplace Control**
   - image_url, gallery_images (JSONB), featured, sort_order, pricing_tier, pricing_notes columns added to tt_experiences
   - gallery_images, featured, sort_order columns added to tt_private_jets
   - Full-field experience editor: title, category, price, pricing tier, pricing notes, description, location, duration, max guests, availability, special requirements, notes, status, featured, complimentary toggle
   - Full-field jet editor: name, tail number, manufacturer, model, year, capacity, range, hourly/daily rates, locations, notes, maintenance notes, status, featured
   - Full-field charter editor: customer, routes, dates, pricing, special requests, notes, status
   - Inline featured star toggle in table view
   - Sort order display and editing
   - Image thumbnails in table rows

3. **Enhanced Partner Management** (NEW)
   - Create new partners (was view/status only)
   - Edit all partner fields: name, business, email, phone, category, commission rate, website, address, bio
   - Avatar upload with preview
   - Commission rate column added to tt_partners (default 15%)
   - Bio, website, address fields added

4. **Enhanced Affiliate Management** (NEW)
   - Create new affiliates (was view/status only)
   - Edit all affiliate fields: name, email, phone, referral code, category, commission override, tier, notes
   - Avatar upload with preview
   - Commission override column added to tt_affiliates
   - Category assignment column added

### Data + Media Preservation

| Entity | Table | Image Field | Gallery Field | Storage Bucket |
|--------|-------|-------------|---------------|----------------|
| Experiences | tt_experiences | image_url | gallery_images (jsonb) | toptier-assets/experiences |
| Jets | tt_private_jets | photo_url | gallery_images (jsonb) | toptier-assets/jets |
| Partners | tt_partners | avatar_url | — | toptier-assets/partners |
| Affiliates | tt_affiliates | avatar_url | — | toptier-assets/affiliates |

### Security

- All pages require admin/super_admin role via RequireRole + ProtectedRoute
- All mutations log to admin_audit_log with actor_user_id
- Storage bucket: public read, authenticated write only
- No hardcoded credentials
- No dev-only setup paths

### Design

- Dark penthouse: #0A0A0A background, #C9A84C gold accent
- Consistent luxury design across all modules
- Admin-only badge in header
- ScrollArea for long forms, max-h dialogs
