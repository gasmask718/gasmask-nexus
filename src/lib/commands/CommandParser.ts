// ═══════════════════════════════════════════════════════════════════════════════
// GRABBA COMMAND PARSER — Natural Language Processing
// ═══════════════════════════════════════════════════════════════════════════════

import { QueryIntent, ActionIntent, INTENT_REGISTRY, getAllShortcuts } from './IntentRegistry';

export interface ParsedCommand {
  originalText: string;
  intent: QueryIntent;
  action?: ActionIntent;
  confidence: number;
  entities: ParsedEntities;
  isShortcut: boolean;
}

export interface ParsedEntities {
  brand?: string;
  amount?: number;
  days?: number;
  storeName?: string;
  driverName?: string;
  ambassadorName?: string;
  date?: string;
  status?: string;
}

const ACTION_KEYWORDS: Record<ActionIntent, string[]> = {
  assign: ['assign', 'allocate', 'give to', 'set to'],
  create: ['create', 'make', 'add', 'new', 'generate'],
  update: ['update', 'change', 'modify', 'edit', 'set'],
  notify: ['notify', 'alert', 'tell', 'inform', 'send notification'],
  text: ['text', 'sms', 'message', 'send text'],
  route: ['route', 'send to route', 'add to route', 'plan route', 'build route', 'create route'],
  escalate: ['escalate', 'urgent', 'priority', 'flag'],
  export: ['export', 'download', 'extract', 'get csv', 'spreadsheet'],
  schedule: ['schedule', 'plan', 'set for', 'tomorrow', 'next week', 'on friday', 'on saturday'],
  create_route: ['create route', 'build route', 'plan route for', 'route for'],
  follow_up: ['follow up', 'followup', 'follow-up', 'reminder', 'call back'],
};

const BRAND_KEYWORDS = ['gasmask', 'gas mask', 'hotmama', 'hot mama', 'scalati', 'grabba'];

export function parseCommand(input: string): ParsedCommand {
  const normalizedInput = input.toLowerCase().trim();
  const shortcuts = getAllShortcuts();

  // Check for shortcuts first
  if (normalizedInput.startsWith('/')) {
    const shortcutKey = normalizedInput.split(' ')[0];
    if (shortcuts[shortcutKey]) {
      return {
        originalText: input,
        intent: shortcuts[shortcutKey],
        confidence: 1.0,
        entities: extractEntities(normalizedInput),
        isShortcut: true,
      };
    }
  }

  // Parse intent from natural language
  let bestMatch: { intent: QueryIntent; score: number } = { intent: 'unknown', score: 0 };

  for (const intentDef of INTENT_REGISTRY) {
    let score = 0;
    for (const keyword of intentDef.keywords) {
      if (normalizedInput.includes(keyword.toLowerCase())) {
        score += keyword.split(' ').length; // Multi-word keywords score higher
      }
    }
    if (score > bestMatch.score) {
      bestMatch = { intent: intentDef.id, score };
    }
  }

  // Parse action intent
  let detectedAction: ActionIntent | undefined;
  for (const [action, keywords] of Object.entries(ACTION_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalizedInput.includes(keyword)) {
        detectedAction = action as ActionIntent;
        break;
      }
    }
    if (detectedAction) break;
  }

  return {
    originalText: input,
    intent: bestMatch.intent,
    action: detectedAction,
    confidence: bestMatch.score > 0 ? Math.min(bestMatch.score / 3, 1) : 0.1,
    entities: extractEntities(normalizedInput),
    isShortcut: false,
  };
}

function extractEntities(input: string): ParsedEntities {
  const entities: ParsedEntities = {};

  // Extract brand
  for (const brand of BRAND_KEYWORDS) {
    if (input.includes(brand)) {
      entities.brand = brand.replace(' ', '');
      break;
    }
  }

  // Extract amount (e.g., "$300", "more than 500")
  const amountMatch = input.match(/\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/);
  if (amountMatch) {
    entities.amount = parseFloat(amountMatch[1].replace(',', ''));
  }

  // Extract days (e.g., "10 days", "in 5 days")
  const daysMatch = input.match(/(\d+)\s*days?/i);
  if (daysMatch) {
    entities.days = parseInt(daysMatch[1], 10);
  }

  // Extract date references
  if (input.includes('yesterday')) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    entities.date = yesterday.toISOString().split('T')[0];
  } else if (input.includes('today')) {
    entities.date = new Date().toISOString().split('T')[0];
  } else if (input.includes('this week')) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    entities.date = weekStart.toISOString().split('T')[0];
  }

  // Extract status keywords
  const statusKeywords = ['failed', 'pending', 'completed', 'active', 'inactive', 'overdue'];
  for (const status of statusKeywords) {
    if (input.includes(status)) {
      entities.status = status;
      break;
    }
  }

  return entities;
}

export function getSuggestedQueries(): string[] {
  return [
    'Show all unpaid stores',
    "Which stores haven't we visited in 10 days?",
    'Show low inventory items',
    'List unassigned stores',
    "What's the revenue by brand?",
    'Which stores owe more than $300?',
    'Show failed deliveries from yesterday',
    'Find ambassadors with poor performance',
    'Show slow stores',
    'List missing inventory',
  ];
}

export function getShortcutHelp(): { shortcut: string; description: string }[] {
  return [
    { shortcut: '/unpaid', description: 'Show unpaid stores/invoices' },
    { shortcut: '/lowstock', description: 'Show low inventory items' },
    { shortcut: '/unassigned', description: 'Show unassigned stores' },
    { shortcut: '/noresponse', description: 'Show stores with no response' },
    { shortcut: '/missing', description: 'Show missing inventory' },
    { shortcut: '/revenue', description: 'Show revenue report' },
    { shortcut: '/production', description: 'Show production status' },
    { shortcut: '/failed', description: 'Show failed deliveries' },
    { shortcut: '/slow', description: 'Show slow/declining stores' },
    { shortcut: '/ambassador', description: 'Show ambassador performance' },
  ];
}
