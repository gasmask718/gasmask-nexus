# customer-documents closure + the four phantom buckets

**Date:** 2026-08-20
**Follows:** `docs/comms/MEDIA-SRC-SWEEP-2026-08-20.md`

## 1. customer-documents — report before the change

**What read it:** exactly one surface, `src/pages/CRMCustomerDetail.tsx`. It uploads on three
tabs (invoice → `customer_invoices.pdf_url`, receipt → `customer_receipts.pdf_url`, file →
`customer_files.file_url`) and renders each as a `window.open(url)` download button. No edge
function, no email template, no export references the bucket.

**How many objects:** **zero.** `storage.objects` has no rows for `customer-documents`, and
`customer_files` has 0 rows. The bucket has been public since 2025-11-22 and nothing was ever
put in it.

**Was any URL shared:** no. There is nothing to have shared. No stored URL exists in any
column, so nothing was pasted into an email, an invoice, or a portal.

That is the whole of the exposure question: closing it ends a future exposure and unshares
nothing, because nothing was out. This was the cheapest possible moment to close it — the same
change made against a populated bucket would have needed a URL-rewrite backfill and a
"who already has these links" answer we could not have given.

**Change:** bucket flipped to private. `CRMCustomerDetail` now stores the object **path** and
opens documents through a 5-minute signed URL (`src/lib/storageLinks.ts`). Delete still works
on legacy URL strings — `storageObjectPath()` accepts either shape.

## 2. The four nonexistent buckets — which are live broken features

All four were being uploaded to by code against buckets that did not exist, so `upload()`
failed and the flow died at step one. Reachability:

| Bucket | Surface | Route | Reachable? |
|---|---|---|---|
| `pod-designs` | Design Intake + AI generator | `/pod/upload`, `/pod/generator` (nav → `/pod/designs`) | **Yes** — CEO/admin nav |
| `partner-media` | TopTier partner profile → Media Vault tab | `/crm/toptier-experience/partners/profile/:id` | **Yes** |
| `partner-assets` | TopTier partner profile → Assets tab | same profile page | **Yes** |
| `dispute-evidence` | Ambassador + admin dispute detail | `/ambassador/disputes/:id`, `/admin/disputes/:id` | **Yes** — including a non-staff (ambassador) surface |

So all four are **live broken features, not latent ones**. Every one has a button a real user
can press that fails. Nobody reported it, and the ambassador dispute upload is the one that
stings: an ambassador contesting a commission tries to attach proof, it fails, and there is no
reason for them to read that as our bug rather than their file.

Backing tables are all empty (`pod_designs`, `commission_dispute_evidence` = 0 rows), which
confirms the flows never once completed.

**Change:** all four buckets created **private**, with authenticated-only RLS on
`storage.objects`. Every writer now persists the object path; every reader mints a signed URL
(`SignedImage` for POD artwork, `openSignedStorageObject` for dispute attachments).

Note on `pod-designs`: it was going to be public, since channel publishers (Printify, Etsy)
need a fetchable image URL. The workspace blocks public buckets (`cloud_block_public_buckets`),
so it is private and the UI signs. **When a channel publisher is actually built it will need a
signed URL minted server-side at publish time** — it cannot read `design_image_url` and hand
that string to Printify. Written down here so that is a known step rather than a surprise.

## 3. ut-staff-documents and uben-docs — upload succeeds, read 403s

The worst-shaped version: `upload()` works (bucket exists, private, insert policy present),
then `getPublicUrl()` returns a confident string that 403s. The user sees "Document uploaded
successfully" and the link is dead for whoever opens it later.

Both fixed the same way — store path, sign on read:

- `useUnforgettableStaffTabs.ts` (`useUploadStaffDocument`) + `StaffDocumentsTab` view/download.
- `UbenHQ.tsx` document vault: was storing `publicUrl` and rendering a bare `<a href>`. Now
  stores the path and opens via signed URL. (`UbenDocuments.tsx` already did this correctly —
  the two vaults had drifted apart, and only one of them was right.)

Both tables are empty, so no backfill was needed; `storageObjectPath()` handles legacy strings
if any turn up.

## 4. va_call_logs fossil — comment, not migration

`COMMENT ON COLUMN public.va_call_logs.recording_url` now records that 103 rows hold a
`/storage/v1/object/public/call-recordings/...` URL written before that bucket was closed,
that those literal URLs 403, and that playback only works because `RecordingPlayer` proxies by
path and ignores the stored string. Rendering the column directly produces a dead link that
looks exactly like a player bug.

## Standing rule reinforced

Private bucket ⇒ the database stores an object **path**, never a URL. A stored URL is a
snapshot of a permissions posture; a path survives the posture changing. `getPublicUrl` should
not appear against any private bucket — it cannot fail, so it cannot warn you.
