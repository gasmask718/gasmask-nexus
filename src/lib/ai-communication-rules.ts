/**
 * AI COMMUNICATION RULES (HARD-LOCKED)
 * 
 * This file documents the immutable rules for AI-generated communications
 * in Dynasty OS. These rules cannot be overridden.
 * 
 * ABSOLUTE RULE: NO AUTOMATIC SENDING
 * 
 * 1. AI may ONLY create draft messages
 * 2. AI is NEVER allowed to send or schedule messages
 * 3. All AI outputs assume human review before sending
 * 4. Human approval is MANDATORY for all outbound communications
 * 
 * DRAFT-FIRST WORKFLOW:
 * 
 * 1. Draft Creation (AI or Human)
 *    - status = "draft"
 *    - requires_approval = true
 *    - All content is editable
 * 
 * 2. Human Review
 *    - Review message content
 *    - Verify recipient details
 *    - Check context (amounts, dates, etc.)
 *    - Review any warnings
 * 
 * 3. Edit (Optional)
 *    - Modify subject, body, or any field
 *    - edited_before_send = true
 * 
 * 4. Approval + Send (Human only)
 *    - Only Owner, Admin, or Accountant roles
 *    - approved_by and sent_by are recorded
 *    - Immutable audit log created
 * 
 * PERMISSION HIERARCHY:
 * 
 * - Owner: Full access (create, edit, approve, send, delete)
 * - Admin: Full access (create, edit, approve, send)
 * - Accountant: Full access (create, edit, approve, send)
 * - Other roles: Create and edit drafts only
 * 
 * AUTOMATION BEHAVIOR:
 * 
 * - Collection automation creates drafts only
 * - Scheduled sequences create drafts only
 * - AI suggestions create drafts only
 * - NOTHING sends without human approval
 * 
 * AUDIT REQUIREMENTS:
 * 
 * - All drafts tracked in communication_drafts table
 * - All sent messages logged in communication_sent_log (immutable)
 * - created_by, approved_by, sent_by recorded
 * - edited_before_send flag tracks modifications
 * - context_snapshot preserves state at time of send
 */

export const AI_COMMUNICATION_RULES = {
  // AI can only create drafts
  AI_CAN_SEND: false,
  AI_CAN_SCHEDULE: false,
  AI_CAN_CREATE_DRAFTS: true,
  
  // All messages require human approval
  REQUIRES_APPROVAL: true,
  
  // Roles that can approve and send
  SEND_ALLOWED_ROLES: ['owner', 'admin', 'accountant'] as const,
  
  // Roles that can create/edit drafts
  DRAFT_ALLOWED_ROLES: ['owner', 'admin', 'accountant', 'staff', 'va', 'employee'] as const,
} as const;
