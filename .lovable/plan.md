

# Communication Hub with Template CRUD and Bulk SMS

## What Already Exists
- **Template CRUD** is already fully built in `src/components/comm-systems/TemplatesLibrary.tsx` with Create, Read, Update, Delete operations against the `communication_templates` table.
- **`bulkSendSMS`** function exists in `src/services/templateService.ts` and accepts a brand, category, and array of recipients with phone numbers.
- **`TemplatesPage`** at `/comm-systems/templates` already renders this library.

## What Will Be Built

### 1. Bulk SMS Launch Modal (new component)
A new `BulkSMSModal.tsx` component that:
- Opens when the user clicks "Launch Bulk SMS" on any SMS template
- Fetches stores from `store_master` (id, store_name, phone) with pagination
- Shows a searchable, selectable list of stores as the target audience
- Displays a count of selected recipients
- On confirm, calls `bulkSendSMS` from `templateService.ts`
- Shows success/error toast notifications with delivery summary

### 2. Enhanced TemplatesLibrary
Add to each SMS template card:
- A "Launch Bulk SMS" button (rocket icon) that only appears on `template_type === 'sms'` cards
- Wires to open the Bulk SMS Modal with the selected template's data

### 3. CommunicationHub Page
A new page at `/comm-systems/comm-hub` that:
- Uses the existing `CommSystemsLayout` wrapper
- Renders the enhanced `TemplatesLibrary` as its primary content
- Adds a nav entry under the Communication Hub sidebar section

## Navigation
- **Route**: `/comm-systems/comm-hub`
- **Sidebar**: Under the "Communication Hub" section in the Comm Systems sidebar

---

## Technical Details

### New File: `src/components/comm-systems/BulkSMSModal.tsx`
- Uses Dialog, ScrollArea, Checkbox, Input, Button from existing UI components
- Fetches stores via `supabase.from('store_master').select('id, store_name, phone')` with `.not('phone', 'is', null)` filter
- Search filter on store name
- Select all / deselect all controls
- Calls `bulkSendSMS(brand, category, recipients)` on submit
- Toast notifications for results

### Modified File: `src/components/comm-systems/TemplatesLibrary.tsx`
- Import and render `BulkSMSModal`
- Add state for `bulkSMSTemplate` (the template being launched)
- Add a "Launch Bulk SMS" button to SMS template cards (between Copy and Delete)
- Pass template data to the modal

### New File: `src/pages/comm-systems/hub/CommunicationHubPage.tsx`
- Simple page using `CommSystemsLayout` with title "Communication Hub"
- Renders `TemplatesLibrary`

### Modified File: `src/pages/comm-systems/CommSystemsLayout.tsx`
- Add nav item `{ to: '/comm-systems/comm-hub', icon: Radio, label: 'Comm Hub' }` under the Communication Hub section

### Modified File: `src/routes/AppRoutes.tsx`
- Add route for `/comm-systems/comm-hub` pointing to the new page

