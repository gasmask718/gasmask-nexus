## Goal
Wire the three deployed SF edge functions (`sf-send-contract`, `sf-assign-attorney`, `sf-payment-handler`) into the UI so the team can trigger them from the case detail views. All three functions operate on `case_id` from `surplus_funds_cases`, so the primary surface is `SFCases.tsx` (case detail modal). `SFLeadPipeline.tsx` gets a lightweight entry point that jumps to the case once a lead is converted.

## Scope

### 1. New shared component: `src/pages/surplus-funds/components/CaseActionButtons.tsx`
Reusable action bar rendered inside any case detail view. Contains:

- **Send Contract** button
  - `supabase.functions.invoke('sf-send-contract', { body: { case_id } })`
  - Uses `useMutation` (React Query) so loading/spinner state and error handling are consistent
  - On success: `toast.success('Contract sent')`, invalidate `['sf-cases']`
  - Disabled when `case.status` is past `agreement_sent` (avoid duplicate sends)

- **Assign Attorney** modal
  - Dialog opens a `Select` populated by `useQuery(['sf-attorneys-active'])` from `surplus_funds_attorneys` where `status='active'`
  - Submit → `supabase.functions.invoke('sf-assign-attorney', { body: { case_id, attorney_id } })`
  - Toast + invalidate `['sf-cases']`
  - Shows currently-assigned attorney name if present (reassignment allowed)

- **Log Payment** modal
  - Dialog with numeric `Input` for amount (required, > 0), optional note
  - Submit → `supabase.functions.invoke('sf-payment-handler', { body: { case_id, amount } })`
  - Toast + invalidate `['sf-cases']` and `['sf-payments', case_id]`

All three invocations wrapped in `try/catch` (via `useMutation.onError`) and surface the raw edge-function error message via `toast.error` (per project's "Zero Silent Failures" rule).

### 2. `src/pages/surplus-funds/SFCases.tsx`
- Import and render `<CaseActionButtons case={detailCase} />` inside the existing detail `Dialog`, above the notes section.
- No other changes to filtering/table logic.

### 3. `src/pages/surplus-funds/SFLeadPipeline.tsx`
- In the lead detail drawer's Overview tab, when `detailLead.status === 'agreement_signed'` (existing branch, line ~834):
  - Look up the linked case via `useQuery(['sf-case-for-lead', detailLead.id])` on `surplus_funds_cases` filtered by `lead_id`.
  - If a case exists → render `<CaseActionButtons case={linkedCase} />` (same component) so VAs can send contract / assign attorney / log payment without leaving the pipeline.
  - If no case exists yet → keep the existing "Create Case →" button (unchanged behavior; case creation is out of scope for this task).

### 4. Optimistic UX / re-fetch
- Every mutation calls `queryClient.invalidateQueries` for `['sf-cases']` (and `['sf-lead-summary']` where a lead status might have flipped). No optimistic writes — the edge functions are the source of truth for status transitions, and re-fetch on success is fast enough here.
- Loading state: buttons show a `Loader2` spinner and are disabled while `isPending`.

## Out of scope
- Case creation flow (existing "Create Case →" button stays as-is).
- Changes to the edge functions themselves.
- Attorney CRUD (already handled in `SFAttorneys.tsx`).
- Payment history UI beyond the log action (can be a follow-up).

## Files touched
- **New:** `src/pages/surplus-funds/components/CaseActionButtons.tsx`
- **Edit:** `src/pages/surplus-funds/SFCases.tsx`
- **Edit:** `src/pages/surplus-funds/SFLeadPipeline.tsx` (drawer Overview tab only, ~10 lines)
