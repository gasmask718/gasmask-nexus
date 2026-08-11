# Wholesaler Account Handoff (Dynasty Direct)

## Why this works cleanly

All supplier data hangs off `wholesaler_profiles.id`, **not** off the login:

- `products_all.wholesaler_id` → `wholesaler_profiles.id`
- catalog drafts, orders, fulfillments, payouts → same profile id

`wholesaler_profiles.user_id` is only the *login pointer*. Repointing it hands over
the entire account — products, order history, payouts — with zero data movement.

## Current caretaker account (created 2026-08-11)

| Field | Value |
|---|---|
| Login email | `firstwholesaler@dynastyos.app` |
| Password | `Dynasty!Supplier1-2026` (rotate after handoff) |
| Auth user id | `d1107e44-866f-4a58-8f68-4a1089e67240` |
| Company | First Wholesaler — Pending Transfer |
| Status | `verified` (immediately usable) |
| Entry point | `/portal/wholesaler/catalog/onboard` |

Roles set: `profiles.role = 'wholesaler'` and `user_roles` row `wholesaler`.

## Transfer to the real wholesaler

Preferred: `dd-provision-wholesaler` edge function (admin JWT required).

```
POST /functions/v1/dd-provision-wholesaler
Authorization: Bearer <admin session token>
{
  "action": "transfer",
  "wholesaler_profile_id": "<profile id>",
  "new_email": "owner@theircompany.com",
  "new_password": "<temp password>",
  "company_name": "Their Real Company LLC",
  "revoke_old_user": true
}
```

It: creates (or reuses) the new auth user, grants the `wholesaler` role, repoints
`wholesaler_profiles.user_id` + `email`, optionally strips the caretaker's role.

Manual fallback (same three effects):

1. Create the new login (invite flow → `complete-user-invite`, role `wholesaler`).
2. `UPDATE wholesaler_profiles SET user_id = <new_uid>, email = <new_email>, company_name = '<real name>' WHERE id = <profile id>;`
3. `DELETE FROM user_roles WHERE user_id = <caretaker_uid> AND role = 'wholesaler';`
   and set `profiles.role` on the new user to `wholesaler`.

## What does NOT change on transfer

- `wholesaler_profiles.id` (keep it stable — everything references it)
- Every uploaded product, draft, order, fulfillment and payout row
- Commission / payout settings on the profile

## Checklist for handoff day

- [ ] Confirm real company name, contact, tax id on the profile
- [ ] Run the transfer call
- [ ] New owner signs in and sees the existing catalog at `/portal/wholesaler`
- [ ] Rotate/disable the caretaker password
