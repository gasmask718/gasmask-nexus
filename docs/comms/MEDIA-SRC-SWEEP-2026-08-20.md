# Raw media `src` sweep — audio, video, images against storage

**Date:** 2026-08-20
**Trigger:** `FinishedCallsBoard` was still playing recordings through a raw
`<audio src={recording_url}>` after the `call-recordings` bucket was closed and seven
components were repointed. It was found incidentally. This is the deliberate sweep.

Same shape as the dead-fallback sweep: enumerate every `src=` that resolves to storage or a
provider, then check the target against live reality instead of assuming.

## 1. Every raw `<audio>` / `<video>` in `src/`

17 raw media tags. Grouped by what actually sits behind them:

### Live data, real exposure — FIXED

| File | Table | Rows with a recording | Host |
|---|---|---|---|
| `pages/dynasty-connect/DCRecordingsPage.tsx` | `dc_call_logs` | 19 | `api.bland.ai` |
| `pages/bland-dial/BlandDialHubPage.tsx` (×2) | `bland_call_logs` | 15 | `api.bland.ai` |

Both now render `RecordingPlayer`, which goes through `play-twilio-recording`. Also removed
the two "Download" / "Open in new tab" anchors that handed the bare provider URL to the
browser — a proxied player next to a raw `<a href>` is not a closed door.

### Raw tags over tables that currently hold zero recordings — surfaces, not leaks

`components/dialer/CallTimelineDrawer.tsx` (×2) and `components/communication/LiveCallObserver.tsx`
read `outbound_call_queue.bland_recording_url`; `pages/communication/dialer/DialerHistoryPage.tsx`
reads `dialer_call_attempts.recording_url`; `pages/communication/call-intelligence/VoicemailInboxPage.tsx`
(×2) reads `voicemails.recording_url`; `pages/brandaro/BrandaroReceptionistCalls.tsx` and
`BrandaroReceptionistClientDetail.tsx` read `brandaro_receptionist_calls.recording_url`.

**All five tables have zero non-null recording rows.** Nothing has ever played through these
tags. Left as-is and named here rather than fixed silently — they are the next
`FinishedCallsBoard` the moment any of those pipelines starts populating a URL. They are
not safe; they are unused.

### Not recordings

`CampaignWizardPage` and `ColdCallBlastPage` play TTS voice previews (blob / `cold-call-audio`,
a deliberately public bucket). `MediaVault` and `PenthouseSecurity` play uploaded marketing
video from public asset buckets. No change.

## 2. VA surfaces — already correct, but the stored URLs are stale

All VA call surfaces (`VACallHistory`, `VAAICoachingHub`, `VACallWrapUpModal`, `VAManagerPage`,
`AdminCallReview`) render `RecordingPlayer`. Correct.

Worth recording: **103 `va_call_logs` rows store a URL of the form
`/storage/v1/object/public/call-recordings/…`** — the *public* path form, written before the
bucket was closed. The bucket is private now, so those literal URLs 403. They only still play
because `RecordingPlayer` proxies by path rather than trusting the stored URL. The stored
column is a fossil of the old posture, not a working link. Anything that ever renders that
column directly gets a broken player, not a leak — but it will look like a bug in the player.

## 3. `getPublicUrl` against buckets that are private or do not exist

The inverse of the audio finding, and the same family as `store_master.contact_phone`: a call
that returns a confident-looking URL string for a resource that cannot serve it. `getPublicUrl`
never fails — it does string concatenation. It returns a URL for a private bucket, and for a
bucket that was never created.

| Call site | Bucket | Reality |
|---|---|---|
| `hooks/useUnforgettableStaffTabs.ts:415` | `ut-staff-documents` | **private** — URL 403s |
| `pages/os/uben/UbenHQ.tsx:908` | `uben-docs` | **private** — URL 403s |
| `pages/pod/uploads.tsx:81` | `pod-designs` | **bucket does not exist** |
| `components/crm/toptier/MediaUploadModal.tsx:61` | `partner-media` | **bucket does not exist** |
| `components/crm/toptier/AssetUploadModal.tsx:61` | `partner-assets` | **bucket does not exist** |
| `hooks/useDisputes.ts:350` | `dispute-evidence` | **bucket does not exist** |

The three nonexistent buckets mean the *upload* fails first, so those flows are broken end to
end, not just at display. The two private ones upload fine and then hand back a dead link —
the failure surfaces later, to the user, as a document that will not open.

Not fixed here (each needs a decision: make the bucket, or switch to `createSignedUrl`).
Logged so the choice is made deliberately.

## 4. One posture question, not a bug

`customer-documents` is a **public** bucket, written by `CRMCustomerDetail`. Same category as
`call-recordings` before we closed it: customer paperwork behind a guessable public URL with
no auth. Flagging for the same treatment; not changed tonight because it needs the
signed-URL read path built first, exactly as the recordings did.

## Standing rule added

Media that comes from a private bucket or a call provider is rendered through a proxying
player component, never a raw `src` and never a bare `<a href>` beside it. Closing a bucket is
not complete until every render path for that column is enumerated — grep the tag, not the
component list.
