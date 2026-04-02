## Session 6 — Three Deliverables

### 1. PostGrid Certified Mail Integration
- Add PostGrid API call to Credit Repair's Send Certified Mail flow
- Store letter ID + tracking number in `funding_mailing_log`
- Display USPS tracking link
- Requires POSTGRID_API_KEY secret

### 2. Document Vault
- Create `funding-documents` storage bucket
- Create `funding_client_documents` table with RLS
- Build tabbed vault UI (Identity, Business, Financial, Lender Packages)
- Integrate into client profile page
- Upload to Supabase Storage under `client_id/category/filename`

### 3. Client Portal
- New route `/client-portal` with magic link auth
- Read-only view of DFS score, checklist, tasks
- Document upload capability
- Progress timeline showing pipeline phase
- Magic link via SendGrid transactional email

### Database Changes
- `funding_client_documents` table
- `funding-documents` storage bucket + policies
- Alter `funding_mailing_log` to add `postgrid_letter_id` and `tracking_number` columns if not present

### Edge Function Updates
- Update credit repair mail flow to call PostGrid API
- Add client portal magic link endpoint

Shall I proceed with Session 6?