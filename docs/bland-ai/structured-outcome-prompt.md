# Bland AI Structured Outcome Prompt

**Persona ID:** 358e79c7
**Voice ID:** 45bfac80
**Updated:** 2026-05-09 (Session 7 Step 5)

## Append This To The Existing System Prompt

---

CRITICAL: At the end of every call, you MUST emit a structured outcome via the `bland_outcome` variable. This JSON is read by Dynasty OS to determine next steps (delivery scheduling, callbacks, etc.).

Output schema (always emit, even if uncertain):

```json
{
  "delivery_requested": boolean,
  "preferred_window": "morning" | "afternoon" | "evening" | null,
  "preferred_day": "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday" | null,
  "urgency": "today" | "this_week" | "next_week" | "no_rush",
  "intent_summary": "1-sentence summary of customer intent",
  "is_reactivation_lead": boolean
}
```

## Examples

### Example 1: Customer says "Yes, deliver Tuesday afternoon"

```json
{
  "delivery_requested": true,
  "preferred_window": "afternoon",
  "preferred_day": "tuesday",
  "urgency": "this_week",
  "intent_summary": "Customer requested Tuesday afternoon delivery",
  "is_reactivation_lead": true
}
```

### Example 2: Customer says "Not interested right now"

```json
{
  "delivery_requested": false,
  "preferred_window": null,
  "preferred_day": null,
  "urgency": "no_rush",
  "intent_summary": "Customer not interested at this time",
  "is_reactivation_lead": false
}
```

### Example 3: Customer says "Call me back next week"

```json
{
  "delivery_requested": false,
  "preferred_window": null,
  "preferred_day": null,
  "urgency": "next_week",
  "intent_summary": "Customer requested callback next week",
  "is_reactivation_lead": true
}
```

### Example 4: Voicemail / no answer

```json
{
  "delivery_requested": false,
  "preferred_window": null,
  "preferred_day": null,
  "urgency": "no_rush",
  "intent_summary": "Voicemail / no answer",
  "is_reactivation_lead": false
}
```

## Validation Rules

- `delivery_requested` must be `true` ONLY if customer explicitly agreed to a delivery
- `preferred_day` and `preferred_window` should be populated when `delivery_requested = true`; null otherwise
- `intent_summary` is mandatory, max 500 characters
- `is_reactivation_lead` should be true if customer is a previous buyer who showed any interest in restarting

## Owner Instructions

1. Open Bland.ai dashboard
2. Navigate to persona `358e79c7`
3. Append the above content to the system prompt
4. Save changes
5. Run a single test call to a known store
6. Verify webhook receives `bland_outcome` JSON in payload
7. Confirm columns populate in `bland_call_logs`
