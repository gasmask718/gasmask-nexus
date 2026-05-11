# Canonical Contacts

**Authority:** Store Profile Contact Fix (2026-05-11)
**Status:** ACTIVE

## Source of Truth

- `store_contacts` — canonical multi-contact table (1,823 rows, fully relational, 40 columns)
- `is_primary = true` row designates the primary contact for a store. Enforced single-primary by `trg_sync_store_primary_contact_name`.

## Legacy Mirror (auto-synced — DO NOT WRITE DIRECTLY)

- `stores.primary_contact_name` — legacy single-string column.
- Maintained by `public.sync_store_primary_contact_name()` via `trg_sync_store_primary_contact_name`
  (AFTER INSERT OR UPDATE OF is_primary, name ON store_contacts).
- Behavior:
  - When a contact is marked `is_primary = true`, `stores.primary_contact_name` updates to that contact's `name` and any other primary flags on the same store are demoted.
  - When the current primary's `is_primary` flips to `false` and no replacement primary exists, `stores.primary_contact_name` is cleared.
  - Renaming the primary contact propagates the new name to `stores.primary_contact_name`.
- Read by: `ConnectedStoresCard`, `MultiBrandDelivery` driver list, `SharedStoreCoreIntelligence`, `StoreDetail` owner-name composition.

## UI Surfaces

- `/stores/:id` (`StoreDetail.tsx`) and `/grabba/store/:id` (`StoreMasterProfile.tsx`) both render `StoreContactsSection` (full CRUD: Add / Edit / Delete / is_primary toggle / role / SMS opt-in).
- `StorePeopleSection` (read-only) is deprecated for these surfaces. Kept in repo for reference only.

## Three-Layer Contact Pattern (2026-05-11)

1. **Layer 1 — Profile Header** (`StoreDetail.tsx`): Store Name + Owner Name shown together at the top. Owner sourced from `stores.primary_contact_name` (canonical-synced via trigger), falling back to `store_master.owner_name`. The 90% glance.
2. **Layer 2 — Edit Contact Info modal** (`StoreContactInfoCard.tsx`): Quick-edit "Owner Name" field. Writes to `store_contacts` (updates the existing `is_primary = true` row, or inserts a new OWNER+is_primary row if none exists). The `trg_sync_store_primary_contact_name` trigger then mirrors the change to `stores.primary_contact_name`. The 30% quick edit.
3. **Layer 3 — Store Contacts section** (`StoreContactsSection`): Full CRUD for multiple contacts (manager, cell rep, backup, etc.) with role assignment, SMS opt-in, and responsiveness data. The 10% multi-decision-maker case.

The Edit modal handles **store-level fields** (name, address, phone, alt_phone, email, tags, sticker fields, notes) plus the single-string Owner Name shortcut for Layer 2. Multi-contact management lives exclusively in `StoreContactsSection`.

## Migration Reference

- `supabase/migrations/*_sync_store_primary_contact_name.sql`
  - Creates `sync_store_primary_contact_name()` function + `trg_sync_store_primary_contact_name` trigger.
  - One-shot dedup of multiple `is_primary = true` rows per store.
  - One-shot backfill of `stores.primary_contact_name` from canonical primary.
