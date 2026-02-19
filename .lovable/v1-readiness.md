# v1 Readiness Checklist & Lock Declaration

## Status: READY FOR LOCK

### ✅ Profile Parity & Truth Layer
- [x] Ambassador profile — Activity tab (Inbox + Tasks) added
- [x] Influencer profile — Activity tab added
- [x] Driver profile — Activity tab added
- [x] Biker profile — Activity tab added
- [x] Shared `ProfileActivityPanel` component created
- [x] All panels are read-only mirrors, no mutations
- [x] Governance banners displayed on all analytics surfaces

### ✅ Territory Intelligence Hardening
- [x] `TerritoryDiagnosticsPanel` created (admin-only, read-only)
- [x] Store coverage + verification rate metrics
- [x] API usage estimation (manual trigger only)
- [x] Source breakdown analytics
- [x] No auto-sync, no background jobs

### ✅ Mobile UX & PWA Hardening
- [x] Bottom nav touch targets: 56px min (exceeds 48px WCAG minimum)
- [x] `touch-manipulation` CSS applied for faster tap response
- [x] Safe area bottom padding for notched devices
- [x] Loading skeletons in ProfileLayout
- [x] Backdrop blur on nav for visual clarity
- [x] Inbox unread badge with real-time updates
- [x] PWA install flow via PwaGate (Phase 7)
- [x] SW update toast (Phase 7)

### ✅ Security & Access Control
- [x] Ops PWA protected by OpsAccessGate (Phase 8)
- [x] Device trust + invite-only access
- [x] RLS on all ops_inbox and ops_tasks tables
- [x] RPCs use SECURITY DEFINER with permission checks
- [x] Admin-only thread creation enforced

### ✅ Governance Compliance
- [x] All task surfaces display advisory banner
- [x] All analytics surfaces display "descriptive only" banner
- [x] Non-Inference Law banners on influencer profiles
- [x] Driver/Biker profiles display "no discipline/ranking" banner
- [x] Territory panel states "no auto-sync active"

---

## v1 Lock Declaration

### What is FROZEN (no changes without explicit authorization):
1. Database schema for: ops_inbox_*, ops_tasks, ops_task_events, geo_identities
2. RLS policies on all operational tables
3. Edge function: create-ops-thread
4. RPCs: create_ops_task, update_ops_task_status, complete_ops_task, reopen_ops_task
5. RPCs: mark_ops_thread_read, ack_ops_thread, resolve_ops_thread, snooze_ops_thread
6. ProfileLayout component contract
7. OpsAccessGate security flow
8. Device trust model
9. Three-plane separation (Execution / Command / Intelligence)

### What MAY change (with review):
1. UI copy and labels
2. Color tokens / design refinements
3. Additional read-only analytics panels
4. New admin dashboard cards
5. Bug fixes in existing components

### What MUST NOT happen without Phase 11+ approval:
1. No automation of task assignment
2. No SLA enforcement
3. No push notifications
4. No background sync jobs
5. No AI-driven actions
6. No scoring or ranking of personnel

---

## Post-v1 Roadmap (requires separate Master Prompts):
- Phase 11: Counterfactual Simulation (read-only)
- Phase 12: Decision Quality Index (task-aware, read-only)
- Phase 13: Org Memory Layer (institutional learning)
