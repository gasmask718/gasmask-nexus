
# 📱 Mobile QA Report — 375px iPhone Safari

Static analysis of the current codebase against Apple HIG (44×44 tap targets) and horizontal‑overflow rules. Sources: `SFCommandCenter.tsx`, `SFLeadPipeline.tsx`, `SFAutomation.tsx`, `SFHumanQueue.tsx`, `RECommandCenter.tsx`, `REVADesk.tsx`, `REAnalyzer.tsx`, `SFLayout.tsx`, `RELayout.tsx`, `Layout.tsx`, `components/ui/button.tsx`, `components/ui/input.tsx`.

Key baseline pulled from the shared UI kit:
- `Button` default = `h-10` (40px) → **fails 44px HIG** unless page passes `size="lg"` (h‑11 = 44px).
- `Input` = `h-10` (40px), `text-base` on mobile (16px) → **prevents iOS auto‑zoom** ✅.

## Report

| # | Page | Test | Pass/Fail | Notes / Failure Reason |
|---|---|---|---|---|
| 1 | SF Penthouse | Stat cards stack 2×2 | PASS | `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6` — 6 cards render 2‑wide at 375px (3 rows of 2). No overlap. |
| 2 | SF Leads | Table scrolls horizontally | PASS | Table wrapped in `<div className="overflow-x-auto">` at line 357 of `SFLeadPipeline.tsx`; page container itself does not overflow. |
| 3 | SF Automation | Campaign launcher usable | PASS (with caveat) | Uses shadcn `Input` (h‑10, 16px text — no iOS zoom), `Select` (h‑10), stacked in default flex; Launch button default h‑10 = 40px, technically below 44px HIG but still tappable. Recommend `size="lg"` on the primary Launch CTA. |
| 4 | Human Queue | Call panel is full screen | FAIL | `SFHumanQueue.tsx` L189 uses `<DialogContent className="max-w-3xl max-h-[90vh]">`. shadcn Dialog default is a centered card with side gutters and `rounded-lg` — not `w-full`/edge‑to‑edge full‑screen on mobile. Needs `w-screen h-screen max-w-none rounded-none` (or a `Sheet side="bottom"`) at `<sm`. |
| 5 | Human Queue | Disposition buttons ≥44px | FAIL | L254‑268: Interested / No Answer / Schedule Callback / Not Interested all use default `<Button>` (h‑10 = 40px). Below 44px HIG. Add `size="lg"` or `className="h-11"`. |
| 6 | Human Queue | Phone number is `<a href="tel:...">` | PASS | L209 wraps the dial CTA in `<a href={\`tel:${active.phone}\`}>`. Native tap‑to‑call works. |
| 7 | RE Penthouse | Stat cards readable | FAIL | `RECommandCenter.tsx` L146‑158: 7 metric cards use `grid-cols-2 md:grid-cols-4 lg:grid-cols-7` (OK) but labels use `text-[10px]` (10px) — below the ≥14px body‑text bar and hard to read on 375px. Values are `text-xl` (fine). Bump labels to `text-xs` (12px) minimum, ideally `text-sm`. |
| 8 | RE VA Desk | Call panel full screen | PASS | L238: `<SheetContent className="w-full sm:max-w-xl">` — full width on mobile, capped only from `sm:` up. Sheet slides in edge‑to‑edge on 375px. |
| 9 | RE VA Desk | All 6 disposition buttons tappable | FAIL | L260‑264 renders the 6 `DISPOSITIONS` buttons at default size (h‑10 = 40px). Below 44px HIG. Add `size="lg"` or `min-h-[44px]`. |
| 10 | RE VA Desk | Escalate to David visible | PASS | L265: rendered inside the same `grid gap-2` in the Sheet body, immediately after the disposition list. Sheet is `overflow-y-auto`; button is never clipped or pushed off‑screen. (Same 40px height caveat as #9.) |
| 11 | RE Analyzer | Form fields usable on mobile | PASS | Outer form is `grid lg:grid-cols-2` — collapses to a single column at 375px. `Input` uses `text-base` (16px) so iOS won't zoom on focus. Only sub‑caveat: the inner `grid-cols-3` for Beds/Baths/Sqft (L180) is cramped at 375px (~110px per input) but does not overflow. |
| 12 | RE Analyzer | Grade badge readable | PASS | L240: `<Badge className="text-base px-4 py-1">{grade} — {gradeMeta.label}</Badge>` — 16px text, single line, centered in the calc card. No awkward wrap. |
| 13 | Global sidebar | Collapses correctly on mobile | PASS (with caveat) | `Layout.tsx` L1451‑1468: header renders a `md:hidden` hamburger that opens a `Sheet side="left" w-72` with full nav. Content isn't obscured. **Caveat (not in the 13‑point scope, worth flagging):** the *inner* OS shells `SFLayout.tsx` L49 and `RELayout.tsx` L57 both use `hidden lg:block` on their secondary sidebar with **no** mobile trigger — on `/surplus-funds/*` and `/real-estate/*` at 375px users lose access to the OS‑local nav (Command Center / Leads / VA Desk / etc.) entirely. Recommend a Sheet‑backed trigger in the OS page headers. |

## Summary
- **Pass:** 8 (1, 2, 3, 6, 8, 10, 11, 12, 13) — counted 13 as pass.
- **Fail:** 4 (4, 5, 7, 9).
- **Root causes are concentrated:**
  1. Default shadcn `Button` size (h‑10) is used everywhere → drives fails 5 and 9, and lurks under 3, 10.
  2. `DialogContent` used for the mobile call panel in Human Queue instead of `Sheet` / full‑screen dialog → fail 4.
  3. `text-[10px]` labels on RE Penthouse metric cards → fail 7.
  4. OS‑local sidebars (`SFLayout`, `RELayout`) have no mobile hamburger — a secondary but real UX gap.

Awaiting your confirmation before switching to Build Mode to apply fixes.
