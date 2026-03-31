

# VA Portal — Full Build Plan

## What Already Exists
- `profiles` table with `role` column using `app_role` enum (already includes `va`)
- `brandaro_phone_numbers` table (phone pool with CRUD)
- `brandaro_qualified_leads` + `brandaro_leads_master` tables (lead data)
- `brandaro_call_logs` table (call logging)
- `invoices` table (existing invoicing system)
- `EnglishVADashboard.tsx` and `SpanishVADashboard.tsx` (basic VA dashboards exist but are embedded in Brandaro OS routes)
- `PhoneNumbersPage.tsx` (admin phone CRUD exists)
- `AuthContext.tsx` reads `profiles.role`

## Database Changes (Migration)

### New Tables

```sql
-- VA session tracking (Twilio number assignment per session)
CREATE TABLE va_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  va_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  twilio_number_id UUID NOT NULL REFERENCES brandaro_phone_numbers(id),
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'es')),
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

-- VA call logs (links to leads + recordings + AI analysis)
CREATE TABLE va_call_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES brandaro_qualified_leads(id),
  va_id UUID NOT NULL REFERENCES profiles(id),
  twilio_number TEXT NOT NULL,
  recording_url TEXT,
  transcript TEXT,
  ai_analysis JSONB,
  duration_seconds INTEGER,
  call_status TEXT DEFAULT 'initiated',
  called_at TIMESTAMPTZ DEFAULT now()
);

-- VA invoices (separate from store invoices)
CREATE TABLE va_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES brandaro_qualified_leads(id),
  va_id UUID NOT NULL REFERENCES profiles(id),
  customer_name TEXT NOT NULL,
  service_type TEXT,
  line_items JSONB NOT NULL DEFAULT '[]',
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','cancelled')),
  payment_link TEXT,
  due_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- VA invoice send logs
CREATE TABLE va_invoice_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES va_invoices(id) ON DELETE CASCADE,
  sent_via TEXT NOT NULL CHECK (sent_via IN ('sms','email')),
  sent_to TEXT,
  sent_at TIMESTAMPTZ DEFAULT now()
);
```

Plus: Add `in_use` boolean and `assigned_va_id` columns to `brandaro_phone_numbers` if not already present. RLS policies for all new tables scoped to the VA's own records + admin full access.

### Seed Data
Insert the two pre-seeded numbers (+17183089391, +18776818621) into `brandaro_phone_numbers` if not already present.

## New Routes

| Route | Component | Access |
|---|---|---|
| `/va/auth` | `VAAuthPage` | Public |
| `/va/dashboard` | `VADashboard` | VA + Admin |
| `/admin/numbers` | `AdminNumbersPage` | Admin only |
| `/pay/:invoiceId` | `PayInvoicePage` | Public |

## Components to Create (~25 files)

### 1. Auth — `src/pages/va/VAAuthPage.tsx`
- Signup/login form using Supabase Auth
- On signup: insert into `profiles` with `role: 'va'`
- On login: redirect to `/va/dashboard`
- Dark navy + teal theme

### 2. VA Dashboard Layout — `src/pages/va/VADashboard.tsx`
- SidebarProvider with left nav (Leads, Active Call, Scripts, FAQs, Invoices, Settings)
- Top bar: assigned Twilio number, language badge, logout
- Protected route (VA or admin only)

### 3. Onboarding Modal — `src/components/va/VAOnboardingModal.tsx`
- Fullscreen modal on first dashboard load per session
- Step 1: Language selection (English/Spanish) — two large buttons
- Step 2: Twilio number picker — cards showing available/in-use numbers
- On select: creates `va_sessions` record, marks number as `in_use`
- On logout/close: releases number (sets `in_use = false`, `ended_at`)

### 4. Leads Table — `src/components/va/VALeadsTable.tsx`
- Queries `brandaro_qualified_leads` filtered by session language
- Sortable/filterable table: Name, Phone, Email, Status, Last Contacted, Assigned VA
- Row actions: Call, Create Invoice, Send Invoice Link

### 5. Active Call UI — `src/components/va/VACallPanel.tsx`
- Slide-in overlay when VA clicks Call
- Lead info, call timer, status (Ringing/Connected/Ended)
- Mute, Hold, End Call buttons
- Contextual sidebar with 3 tabs: Scripts, Rebuttals, FAQs

### 6. Call Scripts/Rebuttals/FAQs — `src/components/va/VAScripts.tsx`, `VARebuttals.tsx`, `VAFAQs.tsx`
- Hardcoded content in EN and ES (pulled from i18n files)
- Searchable FAQ panel

### 7. Invoice Modal — `src/components/va/VAInvoiceModal.tsx`
- Create invoice: auto-fill from lead, add line items, auto-calculate total
- Save to `va_invoices` table

### 8. Invoice Send — `src/components/va/VASendInvoice.tsx`
- Generate payment link (`/pay/:invoiceId`)
- Send via SMS (Twilio edge function) or email
- Log to `va_invoice_logs`

### 9. Admin Numbers Page — `src/pages/admin/AdminNumbersPage.tsx`
- Full CRUD on `brandaro_phone_numbers`
- Force Release button for stuck numbers
- Admin-only access guard

### 10. Payment Page — `src/pages/va/PayInvoicePage.tsx`
- Public page at `/pay/:invoiceId`
- Shows invoice details, total, pay button
- Integrates with Stripe for payment

### 11. i18n System — `src/i18n/` with `en.json` and `es.json`
- All VA portal strings translated
- React context for language switching based on session

## Edge Functions

### `va-initiate-call`
- Accepts lead phone + VA's assigned Twilio number
- Initiates outbound call via Twilio connector gateway
- Enables recording (`record: true`)
- Returns call SID

### `va-send-invoice`
- Accepts invoice ID + delivery method (sms/email)
- Sends payment link via Twilio SMS or email
- Logs to `va_invoice_logs`

### `va-analyze-call`
- Accepts call recording URL or transcript
- Sends to Lovable AI (Claude/GPT) for analysis
- Returns objections, VA quality score, recommendations
- Saves to `va_call_logs.ai_analysis`

## Design
- Dark navy (`#0f172a`) + electric teal (`#06b6d4`) accent palette
- High-contrast call overlay with large buttons
- Mobile/tablet responsive
- Spanish mode: identical layout, all text from `es.json`

## Implementation Order
1. Database migration (4 tables + seed numbers)
2. i18n setup
3. VA Auth page
4. VA Dashboard layout + onboarding modal
5. Leads table
6. Active Call UI + edge function
7. Invoice creation + send
8. Admin numbers page
9. Payment page
10. AI call analysis edge function

