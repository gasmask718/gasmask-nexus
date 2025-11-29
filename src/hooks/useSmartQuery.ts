// ═══════════════════════════════════════════════════════════════════════════════
// SMART QUERY HOOK — Universal Query Handler for Results Panels
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useEffect } from 'react';
import { processCommand, QueryResult, CommandResponse } from '@/lib/commands/CommandEngine';
import { parseCommand } from '@/lib/commands/CommandParser';
import { ActionIntent } from '@/lib/commands/IntentRegistry';

export interface QueryDefinition {
  command: string;
  params?: Record<string, unknown>;
  brand?: string;
  region?: string;
  dateRange?: { start: string; end: string };
}

export interface SmartQueryState {
  data: QueryResult[];
  loading: boolean;
  error: string | null;
  summary: string;
  suggestedActions: ActionIntent[];
  totalCount: number;
  response: CommandResponse | null;
}

export function useSmartQuery(initialQuery?: QueryDefinition, autoRun = true) {
  const [state, setState] = useState<SmartQueryState>({
    data: [],
    loading: false,
    error: null,
    summary: '',
    suggestedActions: [],
    totalCount: 0,
    response: null,
  });

  const [currentQuery, setCurrentQuery] = useState<QueryDefinition | undefined>(initialQuery);

  const runQuery = useCallback(async (query: QueryDefinition) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // Build command string with filters
      let commandStr = query.command;
      
      if (query.brand) {
        commandStr += ` for ${query.brand}`;
      }
      
      if (query.params) {
        Object.entries(query.params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            commandStr += ` ${key}:${value}`;
          }
        });
      }

      const response = await processCommand(commandStr);
      
      setState({
        data: response.results,
        loading: false,
        error: response.error || null,
        summary: response.summary,
        suggestedActions: response.suggestedActions,
        totalCount: response.results.length,
        response,
      });
      
      setCurrentQuery(query);
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Query failed',
      }));
    }
  }, []);

  const refetch = useCallback(() => {
    if (currentQuery) {
      runQuery(currentQuery);
    }
  }, [currentQuery, runQuery]);

  const updateFilters = useCallback((filters: Partial<QueryDefinition>) => {
    if (currentQuery) {
      const newQuery = { ...currentQuery, ...filters };
      runQuery(newQuery);
    }
  }, [currentQuery, runQuery]);

  // Auto-run on mount if query provided
  useEffect(() => {
    if (initialQuery && autoRun) {
      runQuery(initialQuery);
    }
  }, []); // Only run once on mount

  return {
    ...state,
    runQuery,
    refetch,
    updateFilters,
    currentQuery,
  };
}

// Helper to decode URL query params into QueryDefinition
export function decodeQueryFromUrl(params: URLSearchParams): QueryDefinition | null {
  const panel = params.get('panel');
  const query = params.get('query');
  const brand = params.get('brand');
  const region = params.get('region');

  if (!query) return null;

  // Map common shorthand queries to full commands
  const queryMap: Record<string, string> = {
    'unpaid-stores': 'show all unpaid stores',
    'inactive-10-days': 'show stores not visited in 10 days',
    'inactive-30-days': 'show stores not visited in 30 days',
    'low-inventory': 'show low inventory',
    'unassigned-stores': 'show unassigned stores',
    'failed-deliveries': 'show failed deliveries',
    'ambassador-performance': 'show ambassador performance',
    'slow-stores': 'show slow stores',
    'high-debt': 'show stores with high debt',
    'missing-inventory': 'show missing inventory',
    'production': 'show production batches',
    'wholesale-items': 'show wholesale items',
    'revenue': 'show revenue by brand',
    'no-response': 'show stores with no response',
  };

  const command = queryMap[query] || query.replace(/-/g, ' ');

  return {
    command,
    brand: brand || undefined,
    region: region || undefined,
  };
}

// Helper to encode QueryDefinition to URL params
export function encodeQueryToUrl(query: QueryDefinition): string {
  const params = new URLSearchParams();
  
  // Simplify command to slug format
  const commandSlug = query.command
    .toLowerCase()
    .replace(/show (all )?/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  
  params.set('query', commandSlug);
  
  if (query.brand) params.set('brand', query.brand);
  if (query.region) params.set('region', query.region);
  
  return params.toString();
}

export default useSmartQuery;
