

# Fix VA Dashboard Invoices + Wire VA Calls to Brandaro (with Brandaro Twilio)

## What you'll get

1. **Invoices tab on `/va/dashboard`** — a real table of every invoice you've created, with View / Send / Resend buttons. New invoices appear immediately after saving.
2. **"Send Invoice" actually sends** — emails the invoice (with payment link) to the lead and records the send event. No more silent "draft" creates.
3. **Every VA call routes through your dedicated Brandaro Twilio account** and lands on `/brandaro` with recording + transcript fully populated.

---

## Part 1 — Invoices tab (the broken part)

**Why it's broken today**
- `VADashboard.tsx` line 247-253 renders the Invoices tab as a hardcoded "coming soon" placeholder. The data exists in `va_invoices` (I confirmed your "TEST - David Suth" invoice is in the DB), but nothing reads it.
- The "Send Invoice" button just re-opens the same Create modal (`VALeadsTable.tsx` and `VACallPanel.tsx` both call the create modal for both actions). It never sends anything or writes to `va_invoice_logs`.

**Fixes**

1. **Build a real `VAInvoicesTable` component** rendered when `view === 'invoices'`:
   - Table columns: Invoice #, Customer, Service Type, Total, Status (draft/sent/paid), Due Date, Created, Actions
   - Actions per row: **View** (opens detail dialog with line items + payment link + send history), **Send** (if draft → sends; if sent → "Resend"), **Copy Pay Link**
   - Filter pills: All / Draft / Sent / Paid
   - Pulls from `va_invoices` filtered by `va_id = current user`, ordered by `created_at desc`, refetches every 10s
   - On "Send" success, invalidates the query so the row updates instantly

2. **Create edge function `va-send-invoice`** (with `verify_jwt = false` + in-code JWT validation):
   - Input: `{ invoice_id, channel: 'email' | 'sms', recipient }`
   - Loads the invoice + lead to resolve customer email / phone
   - Sends email via Resend (already configured) with the payment link, total, line items, and due date
   - Optional SMS path uses the **Brandaro Twilio** credentials (`BRANDARO_TWILIO_ACCOUNT_SID` / `BRANDARO_TWILIO_AUTH_TOKEN` / `BRANDARO_TWILIO_NUMBER`)
   - Inserts a row into `va_invoice_logs` (`sent_via`, `sent_to`, `sent_at`)
   - Updates `va_invoices.status` from `draft` → `sent`
   - Returns `{ success, log_id }`

3. **Wire the buttons**
   - `VALeadsTable` "Send Invoice" button: if a draft exists for that lead, call `va-send-invoice`; otherwise open create modal first then auto-send on save (via a `sendOnSave` flag on `VAInvoiceModal`).
   - `VACallPanel` same behavior.
   - "View" opens a read-only invoice dialog with full details and the send-history list.

4. **(Optional but recommended) Add `invoice_number` column** to `va_invoices` (auto-generated like `INV-2026-0001`) so the table has a clean human ID. Backfill existing rows.

---

## Part 2 — Route VA calls through your Brandaro Twilio account

**Why VA calls aren't fully landing on `/brandaro` today**
- `VoiceDeviceProvider` calls `twilio-voice-token` (the **generic** Twilio account), not `brandaro-voice-token`. So the browser softphone is registered against the wrong Twilio sub-account, recordings end up on the wrong account, and `brandaro-sync-recordings` (which queries the **Brandaro** account) finds nothing to attach.
- `va_call_logs` has 5 recent rows, all with `recording_url=null` and `transcript=null` — confirming the disconnect.
- `VACallPanel.initiateCall` doesn't pass the `callLogId` into the TwiML params, so even when status callbacks fire, they have no `callLogId` to update.

**Fixes**

1. **Switch the VA softphone to Brandaro Twilio**
   - In `VoiceDeviceProvider.tsx`, when the user is in the VA portal (or always for VA flows), call `brandaro-voice-token` instead of `twilio-voice-token`. Cleanest approach: accept a `tokenFunction` prop / context flag, and have `VADashboard` set it to `brandaro-voice-token`.
   - This makes the browser SDK register against your Brandaro sub-account, so all recordings live there and all status callbacks come from there.

2. **Wire the TwiML params correctly**
   - Update `VACallPanel.initiateCall` to pass `params` into `voice.makeCall`: `{ leadPhone, callLogId, callerId: twilioNumber }`. These flow into the TwiML app webhook → `va-power-dialer?action=twiml`, which already builds the `<Dial>` with `recordingStatusCallback` → `brandaro-call-status?callLogId=...`.
   - Confirm the Brandaro TwiML App's Voice URL points at `…/functions/v1/va-power-dialer?action=twiml` (the function expects this). I'll add a one-time check in `brandaro-voice-token` that logs the expected URL.

3. **Persist the Twilio CallSid immediately**
   - In `VACallPanel`, after `voice.makeCall` resolves, capture `call.parameters.CallSid` and `update va_call_logs.call_sid = ...`. This is the link Twilio's status callbacks need.

4. **Harden `brandaro-call-status`**
   - Already correct schema-wise. Add: also update `va_call_logs` matched by `call_sid` when `callLogId` is missing in the query string (defensive).
   - Already requests transcription on recording-complete. Good.

5. **Brandaro Sync button + auto-sync**
   - `brandaro-sync-recordings` already exists and pulls from the Brandaro Twilio account. Add a "Sync Recordings & Transcripts" button on `/brandaro` (Conversations / Call History area) that invokes it, plus a scheduled invocation note (cron) for the user.
   - It already updates `va_call_logs` by `call_sid` — once the softphone is on Brandaro Twilio, this will start filling in `recording_url` and `transcript` for the existing 5 stuck calls and all future ones.

6. **Surface the calls on `/brandaro`**
   - `BrandaroUnifiedCallHistory` already reads from `va_call_logs` via `get-unified-call-history`. Confirm that function selects from `va_call_logs` (audit it; if missing, add the VA-call source). Once recordings + transcripts populate, the existing audio player + transcript viewer light up automatically.

---

## Part 3 — Database / config touch list

Migration:
```sql
ALTER TABLE va_invoices
  ADD COLUMN IF NOT EXISTS invoice_number TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_send_error TEXT;

-- auto-number trigger: INV-YYYY-NNNN per year
```

`supabase/config.toml`:
```toml
[functions.va-send-invoice]
verify_jwt = false
```

No RLS changes needed — `va_invoices` already has `"VAs can manage own invoices" (va_id = auth.uid())` for all ops.

---

## Files I'll touch

**New**
- `src/components/va/VAInvoicesTable.tsx`
- `src/components/va/VAInvoiceDetailDialog.tsx`
- `supabase/functions/va-send-invoice/index.ts`
- `supabase/migrations/<timestamp>_va_invoice_send_columns.sql`

**Edit**
- `src/pages/va/VADashboard.tsx` (replace Invoices placeholder, pass `sendOnSave`)
- `src/components/va/VAInvoiceModal.tsx` (add optional auto-send after save, return invoice id)
- `src/components/va/VALeadsTable.tsx` + `src/components/va/VACallPanel.tsx` (Send button → call `va-send-invoice` or open modal in send-mode)
- `src/contexts/VoiceDeviceProvider.tsx` (use `brandaro-voice-token` for VA flows)
- `src/components/brandaro/BrandaroUnifiedCallHistory.tsx` (add manual "Sync from Twilio" button invoking `brandaro-sync-recordings`)
- `supabase/functions/brandaro-call-status/index.ts` (fallback match by `call_sid`)
- `supabase/config.toml` (register `va-send-invoice`)

---

## Test plan (after implementation)

1. Create a new invoice from `/va/dashboard` → switch to **Invoices** tab → row appears with status `draft`.
2. Click **Send** → toast "Invoice sent", row flips to `sent`, `va_invoice_logs` has a new row, you receive the email.
3. Make a VA call → call ends → within ~30s the row in **Recent Calls** shows duration; within a couple of minutes (Twilio transcription latency) `recording_url` + `transcript` populate.
4. Open the lead on `/brandaro` → `BrandaroUnifiedCallHistory` shows the audio player + transcript.

Reply **"go"** to apply, or tell me to skip any part (e.g. "skip SMS sending", "no invoice numbering").

