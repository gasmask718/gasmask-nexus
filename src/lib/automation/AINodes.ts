// ═══════════════════════════════════════════════════════════════════════════════
// GRABBA AI NODES — Intelligent Automation Workers
// ═══════════════════════════════════════════════════════════════════════════════

import { GrabbaBrandId } from '@/config/grabbaSkyscraper';

export type AINodeType =
  | 'sales'
  | 'inventory'
  | 'delivery'
  | 'finance'
  | 'ambassador'
  | 'wholesale';

export interface AINodePrediction {
  id: string;
  nodeType: AINodeType;
  title: string;
  description: string;
  confidence: number;
  brand?: GrabbaBrandId;
  timestamp: string;
  data: Record<string, unknown>;
  actionable: boolean;
  suggestedAction?: string;
}

export interface AINodeStatus {
  nodeType: AINodeType;
  name: string;
  isActive: boolean;
  lastRun?: string;
  predictionsGenerated: number;
  accuracy: number;
}

// AI Node implementations
const aiNodes: Map<AINodeType, AINodeStatus> = new Map([
  ['sales', { nodeType: 'sales', name: 'AI Sales Node', isActive: true, predictionsGenerated: 0, accuracy: 87 }],
  ['inventory', { nodeType: 'inventory', name: 'AI Inventory Node', isActive: true, predictionsGenerated: 0, accuracy: 92 }],
  ['delivery', { nodeType: 'delivery', name: 'AI Delivery Node', isActive: true, predictionsGenerated: 0, accuracy: 85 }],
  ['finance', { nodeType: 'finance', name: 'AI Finance Node', isActive: true, predictionsGenerated: 0, accuracy: 89 }],
  ['ambassador', { nodeType: 'ambassador', name: 'AI Ambassador Node', isActive: true, predictionsGenerated: 0, accuracy: 78 }],
  ['wholesale', { nodeType: 'wholesale', name: 'AI Wholesale Node', isActive: true, predictionsGenerated: 0, accuracy: 83 }],
]);

let predictions: AINodePrediction[] = [];
const MAX_PREDICTIONS = 100;

// AI Sales Node
export function generateSalesPrediction(brand?: GrabbaBrandId): AINodePrediction {
  const prediction: AINodePrediction = {
    id: crypto.randomUUID(),
    nodeType: 'sales',
    title: 'Order Volume Forecast',
    description: `Predicted ${Math.floor(Math.random() * 50 + 20)} orders for next week`,
    confidence: Math.random() * 20 + 80,
    brand,
    timestamp: new Date().toISOString(),
    data: {
      predictedOrders: Math.floor(Math.random() * 50 + 20),
      recommendedStores: ['Brooklyn Smoke', 'Harlem Corner', 'Queens Plaza'],
      topBrand: brand || 'gasMask',
    },
    actionable: true,
    suggestedAction: 'Prioritize visits to high-potential stores',
  };
  
  addPrediction(prediction);
  updateNodeStats('sales');
  return prediction;
}

// AI Inventory Node
export function generateInventoryPrediction(brand?: GrabbaBrandId): AINodePrediction {
  const prediction: AINodePrediction = {
    id: crypto.randomUUID(),
    nodeType: 'inventory',
    title: 'Stock-Out Risk Alert',
    description: 'Low inventory predicted in 3 days for tubes',
    confidence: Math.random() * 15 + 85,
    brand,
    timestamp: new Date().toISOString(),
    data: {
      daysUntilStockOut: 3,
      recommendedProduction: Math.floor(Math.random() * 100 + 50),
      criticalItems: ['tubes', 'boxes'],
    },
    actionable: true,
    suggestedAction: 'Create production batch immediately',
  };
  
  addPrediction(prediction);
  updateNodeStats('inventory');
  return prediction;
}

// AI Delivery Node
export function generateDeliveryPrediction(): AINodePrediction {
  const prediction: AINodePrediction = {
    id: crypto.randomUUID(),
    nodeType: 'delivery',
    title: 'Route Optimization',
    description: 'Optimized routes can save 45 minutes today',
    confidence: Math.random() * 10 + 85,
    timestamp: new Date().toISOString(),
    data: {
      timeSaved: 45,
      fuelSaved: 12,
      optimalDrivers: ['Driver A', 'Driver B'],
      trafficDelay: Math.floor(Math.random() * 20),
    },
    actionable: true,
    suggestedAction: 'Apply suggested route changes',
  };
  
  addPrediction(prediction);
  updateNodeStats('delivery');
  return prediction;
}

// AI Finance Node
export function generateFinancePrediction(): AINodePrediction {
  const weeklyRevenue = Math.floor(Math.random() * 10000 + 5000);
  const prediction: AINodePrediction = {
    id: crypto.randomUUID(),
    nodeType: 'finance',
    title: 'Revenue Forecast',
    description: `Estimated weekly revenue: $${weeklyRevenue.toLocaleString()}`,
    confidence: Math.random() * 15 + 80,
    timestamp: new Date().toISOString(),
    data: {
      weeklyRevenue,
      suspiciousInvoices: Math.floor(Math.random() * 3),
      underpaymentRisk: Math.random() * 100,
      collectionPriority: ['Store A', 'Store B'],
    },
    actionable: true,
    suggestedAction: 'Review flagged invoices',
  };
  
  addPrediction(prediction);
  updateNodeStats('finance');
  return prediction;
}

// AI Ambassador Node
export function generateAmbassadorPrediction(): AINodePrediction {
  const prediction: AINodePrediction = {
    id: crypto.randomUUID(),
    nodeType: 'ambassador',
    title: 'Ambassador Performance Forecast',
    description: 'Top performer expected to bring 8 new stores',
    confidence: Math.random() * 20 + 75,
    timestamp: new Date().toISOString(),
    data: {
      topPerformer: 'Ambassador Mike',
      expectedNewStores: 8,
      recommendedStoreAssignments: 5,
      performanceScore: Math.random() * 30 + 70,
    },
    actionable: true,
    suggestedAction: 'Assign high-potential territories',
  };
  
  addPrediction(prediction);
  updateNodeStats('ambassador');
  return prediction;
}

// AI Wholesale Node
export function generateWholesalePrediction(): AINodePrediction {
  const prediction: AINodePrediction = {
    id: crypto.randomUUID(),
    nodeType: 'wholesale',
    title: 'Wholesale Demand Forecast',
    description: 'High demand expected for premium tubes',
    confidence: Math.random() * 15 + 80,
    timestamp: new Date().toISOString(),
    data: {
      topProducts: ['Premium Tubes', 'Flavored Wraps'],
      demandIncrease: Math.floor(Math.random() * 30 + 10),
      recommendedPricing: { tubes: 4.99, wraps: 2.99 },
      storeBehaviorTrend: 'increasing',
    },
    actionable: true,
    suggestedAction: 'Adjust inventory for high-demand items',
  };
  
  addPrediction(prediction);
  updateNodeStats('wholesale');
  return prediction;
}

function addPrediction(prediction: AINodePrediction): void {
  predictions.unshift(prediction);
  if (predictions.length > MAX_PREDICTIONS) {
    predictions = predictions.slice(0, MAX_PREDICTIONS);
  }
  
  window.dispatchEvent(new CustomEvent('grabba-ai-prediction', { detail: prediction }));
}

function updateNodeStats(nodeType: AINodeType): void {
  const node = aiNodes.get(nodeType);
  if (node) {
    node.lastRun = new Date().toISOString();
    node.predictionsGenerated++;
    aiNodes.set(nodeType, node);
  }
}

export function getAllPredictions(options?: {
  nodeType?: AINodeType;
  brand?: GrabbaBrandId;
  limit?: number;
}): AINodePrediction[] {
  let filtered = [...predictions];
  
  if (options?.nodeType) {
    filtered = filtered.filter((p) => p.nodeType === options.nodeType);
  }
  if (options?.brand) {
    filtered = filtered.filter((p) => p.brand === options.brand || !p.brand);
  }
  
  return filtered.slice(0, options?.limit || 20);
}

export function getAINodeStatus(): AINodeStatus[] {
  return Array.from(aiNodes.values());
}

export function toggleAINode(nodeType: AINodeType, isActive: boolean): void {
  const node = aiNodes.get(nodeType);
  if (node) {
    node.isActive = isActive;
    aiNodes.set(nodeType, node);
  }
}

export function runAllAINodes(brand?: GrabbaBrandId): AINodePrediction[] {
  const results: AINodePrediction[] = [];
  
  aiNodes.forEach((node) => {
    if (node.isActive) {
      switch (node.nodeType) {
        case 'sales':
          results.push(generateSalesPrediction(brand));
          break;
        case 'inventory':
          results.push(generateInventoryPrediction(brand));
          break;
        case 'delivery':
          results.push(generateDeliveryPrediction());
          break;
        case 'finance':
          results.push(generateFinancePrediction());
          break;
        case 'ambassador':
          results.push(generateAmbassadorPrediction());
          break;
        case 'wholesale':
          results.push(generateWholesalePrediction());
          break;
      }
    }
  });
  
  return results;
}
