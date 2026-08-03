# VA Messaging Interface (Section 1.5)

Give VAs a messaging surface inside the VA portal, scoped to their own assigned leads, that reads message history and composes new outbound messages as draft rows in `brandaro_pending_messages`.

## Reuse decision

The admin Inbox page rebuilt today is an **approval queue** — it lists every pending message across the whole business, exposes approve/reject actions, and pages 100 rows at a time with global status counts. None of that fits a VA, who needs a per-lead conversation view and no approval powers.

Verdict: **do not reuse `InboxPage.tsx`**. Build a simpler VA-scoped component, but carry over the three patterns proven there: server-side filtering (never client-side slicing), explicit `count` queries for badges, and surfacing raw errors instead of empty states.

## Backend: RLS is the actual blocker

`brandaro_pending_messages` currently has exactly one policy — admin/owner full access. A VA cannot read or insert at all today, so the interface cannot work without a migration.

Migration adds:

- `public.va_owns_brandaro_lead(lead_id uuid)` — security-definer helper returning true when the lead's `assigned_va = auth.uid()`. Avoids recursive policy evaluation.
- `brandaro_pending_messages`: VA `SELECT` and `INSERT` policies gated on `va_owns_brandaro_lead(lead_id)`. Insert is additionally forced to `status = 'pending'` via `WITH CHECK`, so a VA can queue a draft but can never self-approve or mark something sent.
- `brandaro_pending_messages`: no VA `UPDATE`/`DELETE` — the approval queue stays admin-only.
- `brandaro_inbound_messages`: currently `USING (true)` for **all authenticated users**, which leaks every inbound reply in the business to any VA. Replace with admin-full-access plus a VA read policy scoped through the same helper.
- `GRANT SELECT, INSERT ON public.brandaro_pending_messages TO authenticated` and `GRANT SELECT ON public.brandaro_inbound_messages TO authenticated` if not already present.

## Frontend

**Route** — no new URL. `VADashboard.tsx` drives its panes off internal `VAView` state and a sidebar, so add `'messages'` to the union and a "Messages" nav item (MessageSquare icon) with an unread-inbound badge, matching the existing AI Coaching badge pattern.

**`src/components/va/VAMessages.tsx`** — two-pane layout:

- *Left, conversation list:* the VA's assigned leads that have at least one message, business name, last message snippet, relative timestamp, unread inbound dot. Search filters by business name / phone server-side.
- *Right, thread:* merged timeline of outbound `brandaro_pending_messages` and inbound `brandaro_inbound_messages` for the selected lead, sorted by `created_at`, outbound right-aligned with a status badge (pending / approved / sent / failed / rejected), inbound left-aligned. Failed messages get destructive styling so a VA sees delivery reality rather than assuming success.
- *Composer:* textarea with a live character counter and a 1,600-char cap, Send button inserts into `brandaro_pending_messages` with `lead_id`, `lead_name`, `phone_number`, `message_body`, `message_type: 'va_manual'`, `status: 'pending'`, `ai_agent: null`, then invalidates the thread query.
- After sending, an inline note tells the VA the message is queued for approval before it goes out — no false "sent" impression.
- Disabled composer with an explanatory line when the lead has no `phone_number`.

**Data access** — a small `src/hooks/useVAMessages.ts` holding the three queries (conversation list, thread, unread count) so the component stays presentational. All queries filter by `assigned_va = auth.uid()` at the query level in addition to RLS, so a policy regression cannot silently widen the view.

## Technical notes

- Message type `'va_manual'` is new; confirm the `message_type` column has no restrictive check constraint before writing (the `status` constraint was tightened earlier today, `message_type` was not).
- Inbound rows link to a lead via `lead_id`, which is nullable — threads key off `lead_id`, and phone-only inbound rows are matched by normalized phone as a fallback, the same normalization the Inbox page uses.
- Polling: thread and unread count refetch every 30s, consistent with the rest of the VA dashboard.
- No changes to `brandaro-sms-dispatch` — it already picks up approved rows, so VA drafts flow through the existing approval-then-send pipeline with no new send path.
