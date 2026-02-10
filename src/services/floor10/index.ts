// Floor 10 — AI Execution Engine
// 3-step ritual: Intent → Permission → Execute
// No shortcuts. No inference. No autonomy.

export {
  declareIntent,
  checkPermission,
  executeGuarded,
  aiAct,
  type AIIntent,
  type PermissionVerdict,
  type ExecutionResult,
  type AllowedActionKey,
} from './aiPermissionGuard';
