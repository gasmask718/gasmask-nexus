/**
 * Field Governance Service
 * 
 * Single entry point for ALL field-origin mutations.
 * Ensures every driver/biker/ambassador action is captured in field_submissions
 * before any production data is modified.
 * 
 * NON-NEGOTIABLE RULE:
 * Any action performed by a driver, biker, or ambassador MUST first exist
 * as a row in field_submissions. If the system allows a mutation without
 * that row, the implementation is invalid.
 */

// Types
export type {
  FieldSubmissionPayload,
  FieldGovernanceResult,
  FieldEntityType,
  FieldActionType,
  FieldRole,
  SubmissionSource,
  AllRoles,
} from './types';

export {
  FIELD_ROLES,
  isFieldRole,
  getSubmissionSource,
} from './types';

// Core submission function
export {
  submitFieldChange,
  governedFieldMutation,
  GOVERNANCE_STRICT_MODE,
} from './submitFieldChange';

// React hooks
export {
  useGovernedFieldMutation,
  useRequiresGovernance,
} from './useGovernedFieldMutation';

// Governed mutation hooks for specific entities
export {
  useGovernedBrandStickerUpdate,
  useGovernedTubeIntelUpdate,
} from './governedMutations';
export type {
  GovernedBrandStickerUpdate,
  GovernedTubeIntelUpdate,
} from './governedMutations';
