/**
 * RLS-Aware Error Handler
 * 
 * Translates RLS policy violations and database errors into
 * user-friendly, actionable messages.
 * 
 * ⚠️ SECURITY NOTE: Never expose raw SQL errors to users.
 * This handler maps known error patterns to safe messages.
 */

export interface RLSErrorResult {
  title: string;
  description: string;
  action?: string;
  isPermissionError: boolean;
}

/**
 * Parse database/RLS errors into user-friendly messages
 */
export function parseRLSError(error: unknown): RLSErrorResult {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const lowerMessage = errorMessage.toLowerCase();

  // RLS Policy Violation
  if (
    lowerMessage.includes('row-level security') ||
    lowerMessage.includes('rls') ||
    lowerMessage.includes('new row violates')
  ) {
    // Check for specific patterns
    if (lowerMessage.includes('store_tube_inventory_status')) {
      return {
        title: 'Store Access Required',
        description: 'You are not assigned to this store. Contact your admin to get access.',
        action: 'Request store assignment',
        isPermissionError: true,
      };
    }
    if (lowerMessage.includes('store_brand_stickers')) {
      return {
        title: 'Sticker Update Blocked',
        description: 'You can only update stickers for stores you are assigned to.',
        action: 'Verify store assignment',
        isPermissionError: true,
      };
    }
    if (lowerMessage.includes('invoice')) {
      return {
        title: 'Invoice Access Denied',
        description: 'You can only create invoices for your assigned stores.',
        action: 'Check store assignment',
        isPermissionError: true,
      };
    }
    
    // Generic RLS violation
    return {
      title: 'Permission Denied',
      description: 'You don\'t have permission to perform this action. Contact your admin if you believe this is an error.',
      action: 'Contact admin',
      isPermissionError: true,
    };
  }

  // Auth/Session errors
  if (
    lowerMessage.includes('jwt') ||
    lowerMessage.includes('not authenticated') ||
    lowerMessage.includes('auth')
  ) {
    return {
      title: 'Session Expired',
      description: 'Your session has expired. Please log in again.',
      action: 'Log in',
      isPermissionError: true,
    };
  }

  // Foreign key / relationship errors
  if (lowerMessage.includes('foreign key') || lowerMessage.includes('fk_')) {
    return {
      title: 'Invalid Reference',
      description: 'The selected item no longer exists or is invalid.',
      isPermissionError: false,
    };
  }

  // Unique constraint
  if (lowerMessage.includes('unique') || lowerMessage.includes('duplicate')) {
    return {
      title: 'Duplicate Entry',
      description: 'This record already exists.',
      isPermissionError: false,
    };
  }

  // Network/Connection errors
  if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('fetch') ||
    lowerMessage.includes('connection')
  ) {
    return {
      title: 'Connection Error',
      description: 'Unable to connect to the server. Check your internet connection and try again.',
      isPermissionError: false,
    };
  }

  // Default fallback - don't expose raw error
  return {
    title: 'Operation Failed',
    description: 'Something went wrong. Please try again or contact support if the issue persists.',
    isPermissionError: false,
  };
}

/**
 * Check if error is a permission/access error
 */
export function isPermissionError(error: unknown): boolean {
  return parseRLSError(error).isPermissionError;
}

/**
 * Get a toast-friendly error object
 */
export function getRLSErrorToast(error: unknown): { title: string; description: string; variant: 'destructive' } {
  const parsed = parseRLSError(error);
  return {
    title: parsed.title,
    description: parsed.description,
    variant: 'destructive',
  };
}
