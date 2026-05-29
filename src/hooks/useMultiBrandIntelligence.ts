// ═══════════════════════════════════════════════════════════════════════════════
// MULTI-BRAND INTELLIGENCE HOOK
// Cross-Brand Route Efficiency (CBRE), Conflict Detection, Invoice Linkage
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface BrandDeliveryItem {
  id: string;
  store_id: string;
  store_name: string;
  brand: string;
  quantity: number;
  invoice_id?: string;
  invoice_status?: 'paid' | 'unpaid' | 'partial';
}

export interface RouteWithBrands {
  route_id: string;
  worker_id?: string;
  worker_name?: string;
  territory?: string;
  stops: RouteStopWithBrands[];
}

export interface RouteStopWithBrands {
  stop_id: string;
  store_id: string;
  store_name: string;
  brands: BrandAtStop[];
  invoices: InvoiceAtStop[];
  conflicts: BrandConflict[];
}

export interface BrandAtStop {
  brand: string;
  quantity: number;
  status: 'pending' | 'partial' | 'complete';
}

export interface InvoiceAtStop {
  invoice_id: string;
  brand: string;
  amount: number;
  status: 'paid' | 'unpaid' | 'partial';
}

export interface BrandConflict {
  type: BrandConflictType;
  severity: 'warning' | 'error';
  message: string;
  brands: string[];
}

export type BrandConflictType = 
  | 'store_restriction'      // Store doesn't accept mixed deliveries
  | 'handling_constraint'    // Different storage/handling requirements
  | 'time_window_conflict'   // Conflicting delivery windows
  | 'weight_threshold'       // Combined load exceeds capacity
  | 'commercial_constraint'; // Exclusive delivery agreements

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const BRANDS = ['GasMask', 'Hot Mama', 'Hotscolatti', 'Grabba R Us'] as const;

// Worker capacity limits (boxes)
export const WORKER_CAPACITY = {
  driver: 100,
  biker: 30,
  ambassador: 15,
} as const;

// CBRE thresholds
export const CBRE_THRESHOLDS = {
  excellent: 0.7,    // < 0.7 = excellent (30%+ efficiency gain)
  acceptable: 0.85,  // 0.7-0.85 = acceptable
  inefficient: 1.0,  // > 0.85 = inefficient
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// CBRE CALCULATION
// Cross-Brand Route Efficiency = Actual Stops / Theoretical Stops
// ═══════════════════════════════════════════════════════════════════════════════

export interface CBREResult {
  actualStops: number;
  theoreticalStops: number;
  cbre: number;
  efficiencyGain: number; // Percentage saved
  rating: 'excellent' | 'acceptable' | 'inefficient';
  ratingColor: string;
}

export function calculateCBRE(
  stops: { store_id: string; brands: string[] }[]
): CBREResult {
  // Actual stops = unique store visits
  const actualStops = stops.length;
  
  // Theoretical stops = sum of stops per brand if each ran separately
  const brandStopCounts = new Map<string, Set<string>>();
  
  stops.forEach(stop => {
    stop.brands.forEach(brand => {
      if (!brandStopCounts.has(brand)) {
        brandStopCounts.set(brand, new Set());
      }
      brandStopCounts.get(brand)!.add(stop.store_id);
    });
  });
  
  let theoreticalStops = 0;
  brandStopCounts.forEach(stores => {
    theoreticalStops += stores.size;
  });
  
  // Avoid division by zero
  if (theoreticalStops === 0) {
    return {
      actualStops: 0,
      theoreticalStops: 0,
      cbre: 1,
      efficiencyGain: 0,
      rating: 'inefficient',
      ratingColor: 'text-destructive',
    };
  }
  
  const cbre = actualStops / theoreticalStops;
  const efficiencyGain = Math.round((1 - cbre) * 100);
  
  let rating: CBREResult['rating'];
  let ratingColor: string;
  
  if (cbre < CBRE_THRESHOLDS.excellent) {
    rating = 'excellent';
    ratingColor = 'text-green-600';
  } else if (cbre < CBRE_THRESHOLDS.acceptable) {
    rating = 'acceptable';
    ratingColor = 'text-yellow-600';
  } else {
    rating = 'inefficient';
    ratingColor = 'text-destructive';
  }
  
  return {
    actualStops,
    theoreticalStops,
    cbre,
    efficiencyGain,
    rating,
    ratingColor,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFLICT DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

export interface ConflictRule {
  type: BrandConflictType;
  check: (brands: string[], context: ConflictContext) => BrandConflict | null;
}

export interface ConflictContext {
  storeRestrictions?: {
    noMixedDeliveries?: boolean;
    requiresBrandInvoice?: boolean;
  };
  handlingRequirements?: Record<string, {
    requiresSignature?: boolean;
    fragile?: boolean;
    regulated?: boolean;
  }>;
  timeWindows?: Record<string, { start: string; end: string }>;
  totalWeight?: number;
  workerType?: 'driver' | 'biker' | 'ambassador';
  exclusiveDeliveryBrands?: string[];
}

const CONFLICT_RULES: ConflictRule[] = [
  // Store doesn't accept mixed deliveries
  {
    type: 'store_restriction',
    check: (brands, context) => {
      if (context.storeRestrictions?.noMixedDeliveries && brands.length > 1) {
        return {
          type: 'store_restriction',
          severity: 'error',
          message: 'Store does not accept mixed-brand deliveries',
          brands,
        };
      }
      return null;
    },
  },
  
  // Different handling requirements
  {
    type: 'handling_constraint',
    check: (brands, context) => {
      if (!context.handlingRequirements) return null;
      
      const requiresSignature = brands.filter(
        b => context.handlingRequirements?.[b]?.requiresSignature
      );
      const noSignature = brands.filter(
        b => !context.handlingRequirements?.[b]?.requiresSignature
      );
      
      if (requiresSignature.length > 0 && noSignature.length > 0) {
        return {
          type: 'handling_constraint',
          severity: 'warning',
          message: `${requiresSignature.join(', ')} requires signature, others do not`,
          brands,
        };
      }
      return null;
    },
  },
  
  // Weight/volume threshold exceeded
  {
    type: 'weight_threshold',
    check: (brands, context) => {
      if (!context.totalWeight || !context.workerType) return null;
      
      const capacity = WORKER_CAPACITY[context.workerType];
      if (context.totalWeight > capacity) {
        return {
          type: 'weight_threshold',
          severity: 'error',
          message: `Combined load (${context.totalWeight}) exceeds ${context.workerType} capacity (${capacity})`,
          brands,
        };
      }
      return null;
    },
  },
  
  // Exclusive delivery agreements
  {
    type: 'commercial_constraint',
    check: (brands, context) => {
      if (!context.exclusiveDeliveryBrands) return null;
      
      const exclusive = brands.filter(b => 
        context.exclusiveDeliveryBrands?.includes(b)
      );
      
      if (exclusive.length > 0 && brands.length > exclusive.length) {
        return {
          type: 'commercial_constraint',
          severity: 'error',
          message: `${exclusive.join(', ')} has exclusive delivery agreement`,
          brands,
        };
      }
      return null;
    },
  },
];

export function detectConflicts(
  brands: string[],
  context: ConflictContext = {}
): BrandConflict[] {
  if (brands.length <= 1) return [];
  
  return CONFLICT_RULES
    .map(rule => rule.check(brands, context))
    .filter((conflict): conflict is BrandConflict => conflict !== null);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PIGGYBACK OPPORTUNITY DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

export interface PiggybackOpportunity {
  store_id: string;
  store_name: string;
  currentBrands: string[];
  missingBrands: string[];
  potentialSavings: number; // Additional stops avoided
}

export function detectPiggybackOpportunities(
  routes: { store_id: string; store_name: string; brands: string[] }[],
  pendingDeliveries: { store_id: string; brand: string }[]
): PiggybackOpportunity[] {
  const opportunities: PiggybackOpportunity[] = [];
  
  // Map of stores already on routes
  const storesOnRoutes = new Map<string, { name: string; brands: Set<string> }>();
  
  routes.forEach(stop => {
    if (!storesOnRoutes.has(stop.store_id)) {
      storesOnRoutes.set(stop.store_id, {
        name: stop.store_name,
        brands: new Set(stop.brands),
      });
    } else {
      stop.brands.forEach(b => storesOnRoutes.get(stop.store_id)!.brands.add(b));
    }
  });
  
  // Find pending deliveries to stores already on routes
  const pendingByStore = new Map<string, string[]>();
  pendingDeliveries.forEach(pd => {
    if (!pendingByStore.has(pd.store_id)) {
      pendingByStore.set(pd.store_id, []);
    }
    pendingByStore.get(pd.store_id)!.push(pd.brand);
  });
  
  storesOnRoutes.forEach((storeData, storeId) => {
    const pending = pendingByStore.get(storeId) || [];
    const missingBrands = pending.filter(b => !storeData.brands.has(b));
    
    if (missingBrands.length > 0) {
      opportunities.push({
        store_id: storeId,
        store_name: storeData.name,
        currentBrands: Array.from(storeData.brands),
        missingBrands,
        potentialSavings: missingBrands.length, // Each brand saved = 1 potential separate stop
      });
    }
  });
  
  return opportunities.sort((a, b) => b.potentialSavings - a.potentialSavings);
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE LINKAGE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

export interface InvoiceSummary {
  totalInvoices: number;
  byBrand: Record<string, number>;
  byStatus: {
    paid: number;
    unpaid: number;
    partial: number;
  };
  totalAmount: number;
  unpaidAmount: number;
}

export function summarizeInvoices(invoices: InvoiceAtStop[]): InvoiceSummary {
  const summary: InvoiceSummary = {
    totalInvoices: invoices.length,
    byBrand: {},
    byStatus: { paid: 0, unpaid: 0, partial: 0 },
    totalAmount: 0,
    unpaidAmount: 0,
  };
  
  invoices.forEach(inv => {
    summary.byBrand[inv.brand] = (summary.byBrand[inv.brand] || 0) + 1;
    summary.byStatus[inv.status]++;
    summary.totalAmount += inv.amount;
    if (inv.status !== 'paid') {
      summary.unpaidAmount += inv.amount;
    }
  });
  
  return summary;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export interface MultiBrandIntelligenceInput {
  stops: {
    store_id: string;
    store_name: string;
    brands: string[];
    invoices?: InvoiceAtStop[];
    conflictContext?: ConflictContext;
  }[];
  pendingDeliveries?: { store_id: string; brand: string }[];
}

export interface MultiBrandIntelligence {
  cbre: CBREResult;
  conflictsByStop: Map<string, BrandConflict[]>;
  totalConflicts: number;
  criticalConflicts: number;
  piggybackOpportunities: PiggybackOpportunity[];
  invoiceSummary: InvoiceSummary;
  insights: IntelligenceInsight[];
}

export interface IntelligenceInsight {
  type: 'efficiency' | 'conflict' | 'opportunity' | 'invoice';
  severity: 'info' | 'warning' | 'error' | 'success';
  message: string;
  actionLabel?: string;
  actionPath?: string;
}

export function useMultiBrandIntelligence(
  input: MultiBrandIntelligenceInput
): MultiBrandIntelligence {
  return useMemo(() => {
    const { stops, pendingDeliveries = [] } = input;
    
    // Calculate CBRE
    const cbre = calculateCBRE(stops);
    
    // Detect conflicts per stop
    const conflictsByStop = new Map<string, BrandConflict[]>();
    let totalConflicts = 0;
    let criticalConflicts = 0;
    
    stops.forEach(stop => {
      const conflicts = detectConflicts(stop.brands, stop.conflictContext);
      conflictsByStop.set(stop.store_id, conflicts);
      totalConflicts += conflicts.length;
      criticalConflicts += conflicts.filter(c => c.severity === 'error').length;
    });
    
    // Detect piggyback opportunities
    const piggybackOpportunities = detectPiggybackOpportunities(
      stops,
      pendingDeliveries
    );
    
    // Summarize invoices
    const allInvoices = stops.flatMap(s => s.invoices || []);
    const invoiceSummary = summarizeInvoices(allInvoices);
    
    // Generate insights
    const insights: IntelligenceInsight[] = [];
    
    // CBRE insight
    if (cbre.rating === 'excellent') {
      insights.push({
        type: 'efficiency',
        severity: 'success',
        message: `Multi-brand efficiency is excellent — ${cbre.efficiencyGain}% delivery savings`,
      });
    } else if (cbre.rating === 'inefficient') {
      insights.push({
        type: 'efficiency',
        severity: 'warning',
        message: `Routes are over-segmented — brands could be combined to save ${Math.round((1 - cbre.cbre) * cbre.theoreticalStops)} stops`,
        actionLabel: 'Open Route Optimizer',
        actionPath: '/delivery/route-optimizer',
      });
    }
    
    // Conflict insights
    if (criticalConflicts > 0) {
      insights.push({
        type: 'conflict',
        severity: 'error',
        message: `${criticalConflicts} critical brand conflict${criticalConflicts > 1 ? 's' : ''} detected — review before dispatch`,
      });
    }
    
    // Piggyback insights
    if (piggybackOpportunities.length > 0) {
      const totalSavings = piggybackOpportunities.reduce((s, o) => s + o.potentialSavings, 0);
      insights.push({
        type: 'opportunity',
        severity: 'info',
        message: `${piggybackOpportunities.length} piggyback opportunities — add ${totalSavings} brand deliveries to existing stops`,
      });
    }
    
    // Invoice insights
    if (invoiceSummary.unpaidAmount > 0) {
      insights.push({
        type: 'invoice',
        severity: 'warning',
        message: `$${invoiceSummary.unpaidAmount.toLocaleString()} unpaid across ${invoiceSummary.byStatus.unpaid + invoiceSummary.byStatus.partial} invoices on route`,
        actionLabel: 'View Unpaid',
        actionPath: '/grabba/finance',
      });
    }
    
    return {
      cbre,
      conflictsByStop,
      totalConflicts,
      criticalConflicts,
      piggybackOpportunities,
      invoiceSummary,
      insights,
    };
  }, [input]);
}

export default useMultiBrandIntelligence;
