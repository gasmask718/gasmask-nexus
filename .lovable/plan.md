# Read-only re-check: supplier-management permissions (owner session)

Nothing was created, invited, imported or published. Approving this runs nothing.

## 1. Does this session have permission to create a supplier account?
**Yes.** The owner login (gasmaskapprovedllc@gmail.com) holds the roles: **owner, admin, wholesaler, ambassador**. The supplier-provisioning function (`dd-provision-wholesaler`) accepts an admin or owner session, so this account can create a supplier account. (The earlier failure was because the check ran under a non-admin login, not this one.)

## 2. Is the spreadsheet import available to an internally created supplier without inviting them?
**Not directly.** The spreadsheet/Excel import exists only inside the supplier portal (`WholesalerPortalPage.tsx` / `WholesalerCatalogOnboard.tsx` → `BulkUploadModule.tsx`), and it is tied to the **logged-in supplier's own profile**. There is **no admin page that uploads a spreadsheet on behalf of a supplier**.

So the practical options are:
- Create the supplier account with a placeholder email and generated password, then **log in as that supplier** and use the spreadsheet import yourself; or
- An admin inserts rows into the catalog-drafts table directly (the access rules allow admins full access), but there is no built-in screen for that — it would be a manual/scripted route.

Note: the supplier self-serve setting is now **ON** (`wholesaler_self_serve_enabled = true`), so a supplier logging in today would see the import, not "Coming Soon".

## 3. Do imported products still go to the admin review queue?
**Yes.** The database trigger `dd_enforce_self_serve_review` forces every non-admin submission to status **pending_admin_review** and stamps who submitted it and when. An admin then approves or rejects each product at `/dynasty-direct/catalog/review` before anything goes live. This is enforced in the database, not just the screen.

## 4. Can we create an internal supplier record for Anna without sending an invitation?
**Yes.** `dd-provision-wholesaler` creates the login (email confirmed, password generated if omitted) plus the supplier role and a verified profile — **no invitation email is sent**. The email field is required but can be a placeholder on our own domain and changed later.

## SAFE NEXT ACTION (when you approve)
Create one internal supplier account for "Anna" via `dd-provision-wholesaler` using the owner session, with a placeholder email and generated password, then report the login details and import readiness. No products imported, no catalog changes, nothing published.
