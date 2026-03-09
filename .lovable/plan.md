

## Plan: Messaging Hub — Full Wiring & Contact Selector Overhaul

### Problem Summary

1. **Contact selection is broken**: Both ManualBulkTab and AICampaignTab only query the `profiles` table (which holds internal users like VAs/admins). They don't query the actual contact sources: **stores** (2,966), **drivers** (29), **bikers** (13), **ambassadors** (68), **wholesalers** (41), or **prospects** (territory_addresses).

2. **messaging-launch edge function ignores selected contacts**: It always resolves audience via `resolve_previous_customers` RPC, completely ignoring the `target_filter.user_ids` the UI sends. The UI selection is decorative.

3. **messaging-send-worker uses BizText, not Twilio**: Despite the UI saying "Twilio," the worker sends via `biztextsolutions.com`. Twilio SMS credentials exist (`TWILIO_MESSAGING_SERVICE_SID`, `TWILIO_PHONE_NUMBER`).

4. **No pagination**: Contact table loads all records in a ScrollArea with no pagination.

5. **`provider` column doesn't exist**: Both tabs insert `provider: "twilio"` into `messaging_campaigns` but the column doesn't exist in the schema — this gets silently ignored.

6. **ConversationsTab has no filters**: No way to filter by status, date, direction, or campaign.

7. **ActiveCampaignsTab**: Already functional — queries `messaging_campaigns` with real data, shows progress, supports pause/resume/stop.

---

### Changes

#### 1. Database Migration
- Add `provider` column to `messaging_campaigns` (text, default `'twilio'`)
- Add `contact_type` and `contact_id` columns to `messaging_targets` so we track which entity type each target came from

#### 2. Shared `ContactSelector` Component
Create `src/components/communication/ContactSelector.tsx` — a reusable paginated contact table used by both ManualBulkTab and AICampaignTab.

**Entity types with sources:**
| Type | Table | Name field | Phone field |
|------|-------|-----------|-------------|
| Store | `stores` | `name` | `phone` |
| Prospect | `territory_addresses` | `store_name` | `phone` |
| Driver | `drivers` | `full_name` | `phone` |
| Biker | `bikers` | `full_name` | `phone` |
| Ambassador | `ambassadors` joined with `profiles` | `profiles.name` | `profiles.phone` |
| Wholesaler | `wholesalers` | `name` | `phone` |
| Customer | `people` | `name` | `phone` |
| Custom | Manual entry | — | — |

**Features:**
- Tab/badge filter by entity type (multi-select)
- 20 rows per page with page number selector
- **Selection persists across page changes** (stored in a `Set<string>` keyed by `{type}:{id}`)
- Select all on current page / select all across all pages
- Search by name/phone
- Shows total selected count

#### 3. Update ManualBulkTab & AICampaignTab
- Remove inline `profiles` query and contact table
- Embed `<ContactSelector>` component
- Pass selected contacts as `{ type, id, phone, name }[]` to campaign creation
- Store selected contacts in `target_filter` as `{ contacts: [{ type, id, phone, name }] }`
- Remove `provider: "twilio"` from insert until migration adds the column (or add it after migration)

#### 4. Fix `messaging-launch` Edge Function
- Check `target_filter.contacts` array first
- If contacts are provided, use them directly to create `messaging_targets` rows (skip RPC resolution)
- Fall back to RPC resolution only when no explicit contacts are provided
- Populate `contact_type` and `contact_id` on each target row

#### 5. Fix `messaging-send-worker` to Use Twilio
- Replace BizText API call with Twilio Messages API using `TWILIO_MESSAGING_SERVICE_SID` and `TWILIO_AUTH_TOKEN`
- Send via `https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json`
- Use `MessagingServiceSid` for automatic number selection
- Keep BizText as fallback if Twilio fails (optional)

#### 6. ConversationsTab Filters
- Add filter bar: status (Sent / Failed / Needs Review), direction (Inbound / Outbound), campaign dropdown, date range
- Add search by phone number
- Persist filters in state

#### 7. ActiveCampaignsTab
- Already functional. Add status filter tabs (All / Active / Paused / Completed / Draft) for convenience.

---

### Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/communication/ContactSelector.tsx` | **CREATE** — Shared paginated contact selector |
| `src/pages/communication/messaging/ManualBulkTab.tsx` | **MODIFY** — Replace inline profiles query with ContactSelector |
| `src/pages/communication/messaging/AICampaignTab.tsx` | **MODIFY** — Replace inline profiles query with ContactSelector |
| `src/pages/communication/messaging/ConversationsTab.tsx` | **MODIFY** — Add filter bar |
| `src/pages/communication/messaging/ActiveCampaignsTab.tsx` | **MODIFY** — Add status filter tabs |
| `supabase/functions/messaging-launch/index.ts` | **MODIFY** — Use target_filter.contacts when provided |
| `supabase/functions/messaging-send-worker/index.ts` | **MODIFY** — Switch from BizText to Twilio SMS API |
| Database migration | Add `provider` column + `contact_type`/`contact_id` to `messaging_targets` |

