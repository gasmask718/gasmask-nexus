

# Redesign: /communication/agents Page

## Overview
Transform the agents page from an agent-card grid into a **store-centric call dashboard**. The main view becomes a paginated table of all 2,962 stores from `store_master`, with inline call actions that let you pick an agent before dialing. Call summaries display in real-time as the call progresses. A new "GASMASK INVENTORY CHECK" agent is created in the database.

## New Page Flow

```text
/communication/agents
+-------------------------------------------------------------+
| AI Agents (V6)                                              |
| [Agent Team] [Activity Monitor] [Insights]   <-- tabs stay  |
+-------------------------------------------------------------+
| Agent Team tab (redesigned):                                |
|                                                              |
| +--- Agent Selector Bar (horizontal scroll) ---------------+|
| | [GASMASK INVENTORY CHECK] [BRIAN WINLEY] [+ Add Agent]   ||
| +-----------------------------------------------------------+|
|                                                              |
| +--- Store Call Table (paginated, 50/page) -----------------+|
| | Search: [__________]  Filter: [Borough v] [Status v]     ||
| |                                                            ||
| | Store Name | Address | Phone | Borough | Actions          ||
| | ---------- | ------- | ----- | ------- | -------          ||
| | Acme Deli  | 123 Main| 555.. | BK      | [Call] [...]    ||
| | Bob Shop   | 456 Oak | 555.. | MN      | [Call] [...]    ||
| | ...        |         |       |         |                  ||
| +------------------------------------------------------------+|
| | Showing 1-50 of 2962 | [<] Page 1 of 60 [>] | 50/page v ||
| +------------------------------------------------------------+|
+-------------------------------------------------------------+

Clicking [Call] on a row:
+----------------------------------+
| Select Agent for Call            |
| Store: Acme Deli (555-1234)     |
|                                  |
| ( ) GASMASK INVENTORY CHECK     |
| ( ) BRIAN WINLEY                 |
|                                  |
| [Start Call]  [Cancel]           |
+----------------------------------+

During call (dialog expands):
+----------------------------------+
| Voice Call - GASMASK INVENTORY   |
| Calling: Acme Deli               |
|                                  |
|    [Pulse indicator]             |
|    "Agent Speaking..."           |
|                                  |
| --- Live Summary ---             |
| - Asked about product stock     |
| - Owner confirmed 50 units      |
| - Needs restock by Friday       |
|                                  |
| [End Call]                       |
+----------------------------------+
```

## Implementation Steps

### Step 1: Database -- Insert "GASMASK INVENTORY CHECK" Agent
- Insert a new row into `ai_agents` with:
  - name: "GASMASK INVENTORY CHECK"
  - role: "customer_service"
  - description: "Automated inventory check agent for store calls"
  - active: true
  - capabilities: `["inventory_check", "stock_verification"]`

### Step 2: Create Store Call Table Hook
- New file: `src/hooks/useStoreCallTable.ts`
- Paginated query against `store_master` using the existing `usePaginationState` pattern
- Fetches: `id, store_name, address, city, state, phone, borough_id, health_status`
- Server-side pagination via Supabase `.range()` with exact count
- Search filter on `store_name` and `address` using `.ilike()`
- Returns 50 rows per page (configurable)

### Step 3: Create Agent Selector Component
- New file: `src/components/communication/AgentSelectorDialog.tsx`
- Modal that shows all active agents as radio options
- Displays store name/phone being called
- On confirm, opens the `VoiceCallDialog` with the selected agent's ElevenLabs ID

### Step 4: Enhance VoiceCallDialog with Call Summary
- Modify `src/components/communication/VoiceCallDialog.tsx`
- Add `onMessage` handler to `useConversation` to capture transcripts
- Display a scrollable "Live Summary" section below the call status
- Show `user_transcript` and `agent_response` events in real-time
- Add store context (name, phone) to the dialog header

### Step 5: Redesign AIAgentsPanel
- Rewrite `src/components/communication/AIAgentsPanel.tsx`
- Replace agent card grid with:
  1. **Agent bar**: Horizontal row of agent badges (clickable to filter/manage)
  2. **Store table**: Full-width paginated table with columns: Store Name, Address, Phone, Borough, Actions
  3. **Call button per row**: Opens agent selector then voice call
- Use `DataTablePagination` component for pagination controls
- Keep stats cards at top (condensed)

### Step 6: Wire ElevenLabs Agent ID
- All agents use the same ElevenLabs agent ID: `agent_8601khrh92krfgrrdj6gqcdpwate`
- Passed through from the agent selector to VoiceCallDialog

## Files to Create
- `src/hooks/useStoreCallTable.ts` -- paginated store query
- `src/components/communication/AgentSelectorDialog.tsx` -- pre-call agent picker

## Files to Modify
- `src/components/communication/AIAgentsPanel.tsx` -- full redesign to table layout
- `src/components/communication/VoiceCallDialog.tsx` -- add live transcript/summary, store context
- `src/components/communication/AIAgentsTab.tsx` -- minor tab label updates if needed

## Technical Notes
- Pagination uses `usePaginationState` from `src/hooks/usePaginatedQuery.ts` with Supabase `.range()` and `{ count: 'exact' }`
- Store table query excludes soft-deleted stores (`deleted_at IS NULL`)
- The ElevenLabs `onMessage` callback captures `user_transcript` and `agent_response` events for the live summary panel
- All 2,962+ stores are accessible via server-side pagination (no client-side loading of full dataset)

