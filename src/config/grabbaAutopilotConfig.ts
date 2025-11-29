// ═══════════════════════════════════════════════════════════════════════════════
// GRABBA AUTOPILOT CONFIGURATION
// Phase 6: Safety controls and settings for the autopilot layer
// ═══════════════════════════════════════════════════════════════════════════════

export const GRABBA_AUTOPILOT_CONFIG = {
  // Master switches
  enableDailyAutopilot: true,
  requireHumanConfirmation: true,
  
  // Task limits
  maxDailyTasks: 100,
  maxTasksPerFloor: 20,
  maxCriticalTasks: 10,
  
  // Floor controls (0 = Penthouse)
  floorsEnabled: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  
  // Safety rules - NEVER perform these automatically
  allowExternalActions: false,     // No direct SMS/calls/payments
  allowAutoPayments: false,        // Never auto-charge
  allowAutoMessages: false,        // Never auto-send messages
  allowAutoInventoryChanges: false, // Never auto-modify inventory
  
  // Task generation settings
  minPriorityForAutoQueue: 'medium' as const, // Only queue medium+ priority tasks
  skipDuplicateWindow: 24 * 60 * 60 * 1000,   // 24 hours - don't create duplicate tasks
  
  // Display settings
  showSuggestionsOnFloors: true,
  maxSuggestionsPerFloor: 5,
  
  // Refresh intervals (ms)
  taskRefreshInterval: 60000,      // 1 minute
  intelligenceRefreshInterval: 60000, // 1 minute
};

// Task type configurations
export const TASK_TYPE_CONFIG = {
  restock_run: {
    label: 'Restock Run',
    icon: '📦',
    color: 'bg-blue-500',
    requiresConfirmation: true,
    autoExecutable: false,
  },
  collection_call: {
    label: 'Collection Call',
    icon: '💰',
    color: 'bg-amber-500',
    requiresConfirmation: true,
    autoExecutable: false,
  },
  store_checkin: {
    label: 'Store Check-in',
    icon: '🏪',
    color: 'bg-green-500',
    requiresConfirmation: false,
    autoExecutable: false,
  },
  driver_review: {
    label: 'Driver Review',
    icon: '🚚',
    color: 'bg-purple-500',
    requiresConfirmation: true,
    autoExecutable: false,
  },
  ambassador_checkin: {
    label: 'Ambassador Check-in',
    icon: '👥',
    color: 'bg-pink-500',
    requiresConfirmation: false,
    autoExecutable: false,
  },
  wholesaler_activation: {
    label: 'Wholesaler Activation',
    icon: '🌐',
    color: 'bg-indigo-500',
    requiresConfirmation: true,
    autoExecutable: false,
  },
  inventory_audit: {
    label: 'Inventory Audit',
    icon: '📋',
    color: 'bg-cyan-500',
    requiresConfirmation: false,
    autoExecutable: false,
  },
  pricing_review: {
    label: 'Pricing Review',
    icon: '💲',
    color: 'bg-orange-500',
    requiresConfirmation: true,
    autoExecutable: false,
  },
  promo_push: {
    label: 'Promotional Push',
    icon: '📣',
    color: 'bg-red-500',
    requiresConfirmation: true,
    autoExecutable: false,
  },
  route_optimization: {
    label: 'Route Optimization',
    icon: '🗺️',
    color: 'bg-teal-500',
    requiresConfirmation: false,
    autoExecutable: false,
  },
  production_boost: {
    label: 'Production Boost',
    icon: '🏭',
    color: 'bg-slate-500',
    requiresConfirmation: true,
    autoExecutable: false,
  },
  communication_followup: {
    label: 'Communication Follow-up',
    icon: '📞',
    color: 'bg-emerald-500',
    requiresConfirmation: false,
    autoExecutable: false,
  },
};

// Priority configurations
export const PRIORITY_CONFIG = {
  critical: {
    label: 'Critical',
    color: 'bg-red-500 text-white',
    borderColor: 'border-red-500',
    maxResponseHours: 24,
  },
  high: {
    label: 'High',
    color: 'bg-orange-500 text-white',
    borderColor: 'border-orange-500',
    maxResponseHours: 48,
  },
  medium: {
    label: 'Medium',
    color: 'bg-amber-500 text-white',
    borderColor: 'border-amber-500',
    maxResponseHours: 120,
  },
  low: {
    label: 'Low',
    color: 'bg-blue-500 text-white',
    borderColor: 'border-blue-500',
    maxResponseHours: 168,
  },
};

// Status configurations
export const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    color: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  },
  in_progress: {
    label: 'In Progress',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  },
  completed: {
    label: 'Completed',
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
  },
  dismissed: {
    label: 'Dismissed',
    color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  },
};
