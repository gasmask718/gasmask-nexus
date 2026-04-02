## Session 1 — Foundation Build

### Phase 1: Database Schema (Migration)
Create the core tables needed for the first 3 modules:

**Client & Intake Tables:**
- `funding_clients` — master client record (personal info, business info, funding goal, target amount, revenue, time in business, DFS score, status)
- `funding_client_documents` — uploaded credit reports and documents per client
- `funding_dfs_scores` — DFS score history with all 12 dimension breakdowns
- `funding_infrastructure_checklist` — onboarding steps tracker (address, LLC, EIN, DUNS, banking, 411, website) per client
- `funding_mailbox_providers` — client mailbox provider credentials and monitoring config

**Credit Repair Tables:**
- `funding_credit_items` — negative items per bureau per client (creditor, type, balance, status, date)
- `funding_dispute_rounds` — dispute round tracking with letter type, sent date, response deadline, status
- `funding_mailing_log` — certified mail tracking (tracking number, delivery status, sent/received dates)

**Business Credit Tables:**
- `funding_tradeline_accounts` — vendor/store/bank tradeline tracking per client (tier, limit, balance, utilization, reporting bureau, Paydex contribution)

**Reference Data Tables:**
- `funding_card_database` — card products with bureau pull tags, score tiers, limits, APR info
- `funding_lender_database` — all lender products with requirements, amounts, speeds
- `funding_task_cards` — structured task cards per client (action, category, steps, deadline, impact score, status)

All tables get RLS policies scoped to authenticated users. Reference tables (cards, lenders) are read-accessible to all authenticated users.

### Phase 2: Module Registration
- Create the Funding Machine module config at `src/modules/fundingmachine/index.ts`
- Register as Floor 10 in Dynasty OS with sidebar items for each sub-module
- Update `src/modules/index.ts` to include it

### Phase 3: Client Intake UI
- Build the client intake form (personal info, business info, funding goals)
- Build the DFS score dashboard with 12-dimension visual breakdown
- Build the infrastructure checklist tracker (7-step onboarding)

### What's NOT in Session 1:
- Credit Repair Command Center UI (Session 2)
- Business Credit Builder UI (Session 2)  
- Card/Bureau Intelligence UI (Session 3)
- Funding Product Matrix UI (Session 3)
- Banking Velocity Calculator (Session 4)
- Tradeline Vault (Session 4)
- Claude API integrations (Session 5)
- Mail monitoring integrations (Session 5)
- Morning Briefing + Automation (Session 6)
