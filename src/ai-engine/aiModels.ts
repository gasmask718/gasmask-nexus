// AI Models for Grabba Skyscraper
import {
  calculateWeightedScore,
  calculateChurnRisk,
  generateForecast,
  detectFraudSignals,
  predictDepletion,
  calculateTrend,
} from './aiUtils';

export interface StoreQualityScore {
  storeId: string;
  storeName: string;
  overallScore: number;
  factors: {
    orderFrequency: number;
    paymentReliability: number;
    orderVolume: number;
    communicationResponsiveness: number;
  };
  recommendation: string;
}

export interface ReorderPrediction {
  entityId: string;
  entityName: string;
  probability: number;
  predictedDate: Date | null;
  suggestedProducts: string[];
  confidence: number;
}

export interface DriverPerformance {
  driverId: string;
  driverName: string;
  score: number;
  metrics: {
    onTimeRate: number;
    completionRate: number;
    customerRating: number;
    efficiency: number;
  };
  alerts: string[];
}

export interface SalesForecast {
  brand: string;
  currentWeek: number;
  nextWeek: number;
  trend: 'rising' | 'stable' | 'declining';
  confidence: number;
}

export const calculateStoreQualityScore = (
  store: {
    id: string;
    name: string;
    totalOrders: number;
    paidOnTime: number;
    totalPaid: number;
    lastOrderDate?: string;
    responseRate?: number;
  }
): StoreQualityScore => {
  const orderFrequency = Math.min(100, (store.totalOrders / 50) * 100);
  const paymentReliability = store.totalPaid > 0 
    ? (store.paidOnTime / store.totalPaid) * 100 
    : 50;
  const orderVolume = Math.min(100, store.totalOrders * 2);
  const communicationResponsiveness = store.responseRate || 70;

  const overallScore = calculateWeightedScore([
    { value: orderFrequency, weight: 25 },
    { value: paymentReliability, weight: 35 },
    { value: orderVolume, weight: 25 },
    { value: communicationResponsiveness, weight: 15 },
  ]);

  let recommendation = '';
  if (overallScore >= 80) recommendation = 'VIP customer - prioritize orders';
  else if (overallScore >= 60) recommendation = 'Good customer - maintain relationship';
  else if (overallScore >= 40) recommendation = 'Needs attention - schedule follow-up';
  else recommendation = 'At risk - immediate outreach needed';

  return {
    storeId: store.id,
    storeName: store.name,
    overallScore,
    factors: {
      orderFrequency,
      paymentReliability,
      orderVolume,
      communicationResponsiveness,
    },
    recommendation,
  };
};

export const predictReorderLikelihood = (
  entity: {
    id: string;
    name: string;
    orderHistory: number[];
    lastOrderDate: string;
    averageOrderInterval: number;
  }
): ReorderPrediction => {
  const daysSinceLastOrder = Math.floor(
    (Date.now() - new Date(entity.lastOrderDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  
  const intervalRatio = daysSinceLastOrder / (entity.averageOrderInterval || 14);
  let probability = 0;
  
  if (intervalRatio >= 0.8 && intervalRatio <= 1.2) probability = 85;
  else if (intervalRatio > 1.2 && intervalRatio <= 1.5) probability = 70;
  else if (intervalRatio > 1.5) probability = 40;
  else probability = 30;

  const trend = calculateTrend(entity.orderHistory);
  if (trend === 'rising') probability = Math.min(95, probability + 10);
  if (trend === 'declining') probability = Math.max(10, probability - 20);

  const predictedDate = new Date();
  predictedDate.setDate(predictedDate.getDate() + Math.max(0, entity.averageOrderInterval - daysSinceLastOrder));

  return {
    entityId: entity.id,
    entityName: entity.name,
    probability,
    predictedDate: probability > 50 ? predictedDate : null,
    suggestedProducts: ['Grabba Leaf', 'Gas Mask', 'Hot Mama'],
    confidence: Math.min(90, 50 + entity.orderHistory.length * 5),
  };
};

export const scoreDriverPerformance = (
  driver: {
    id: string;
    name: string;
    completedDeliveries: number;
    totalDeliveries: number;
    onTimeDeliveries: number;
    customerRatings: number[];
    avgDeliveryTime: number;
    expectedDeliveryTime: number;
  }
): DriverPerformance => {
  const completionRate = driver.totalDeliveries > 0
    ? (driver.completedDeliveries / driver.totalDeliveries) * 100
    : 100;
  
  const onTimeRate = driver.completedDeliveries > 0
    ? (driver.onTimeDeliveries / driver.completedDeliveries) * 100
    : 100;
  
  const customerRating = driver.customerRatings.length > 0
    ? (driver.customerRatings.reduce((a, b) => a + b, 0) / driver.customerRatings.length) * 20
    : 80;
  
  const efficiency = driver.expectedDeliveryTime > 0
    ? Math.min(100, (driver.expectedDeliveryTime / driver.avgDeliveryTime) * 100)
    : 80;

  const score = calculateWeightedScore([
    { value: completionRate, weight: 30 },
    { value: onTimeRate, weight: 30 },
    { value: customerRating, weight: 25 },
    { value: efficiency, weight: 15 },
  ]);

  const alerts: string[] = [];
  if (onTimeRate < 70) alerts.push('Low on-time delivery rate');
  if (completionRate < 90) alerts.push('Incomplete deliveries detected');
  if (customerRating < 60) alerts.push('Customer satisfaction concerns');

  return {
    driverId: driver.id,
    driverName: driver.name,
    score,
    metrics: { onTimeRate, completionRate, customerRating, efficiency },
    alerts,
  };
};

export const forecastBrandSales = (
  brand: string,
  historicalSales: number[]
): SalesForecast => {
  const forecast = generateForecast(historicalSales, 7);
  const currentWeek = historicalSales.slice(-7).reduce((a, b) => a + b, 0);
  const nextWeek = forecast.reduce((a, b) => a + b, 0);
  const trend = calculateTrend(historicalSales);
  
  return {
    brand,
    currentWeek,
    nextWeek,
    trend,
    confidence: Math.min(90, 50 + historicalSales.length * 2),
  };
};

export const predictInventoryNeeds = (
  inventory: {
    brand: string;
    currentStock: number;
    dailyUsage: number;
    reorderPoint: number;
  }[]
): { brand: string; daysUntilDepletion: number; urgency: 'critical' | 'warning' | 'ok'; reorderNow: boolean }[] => {
  return inventory.map(item => {
    const { daysRemaining } = predictDepletion(item.currentStock, item.dailyUsage);
    const urgency = daysRemaining <= 3 ? 'critical' : daysRemaining <= 7 ? 'warning' : 'ok';
    
    return {
      brand: item.brand,
      daysUntilDepletion: daysRemaining === Infinity ? 999 : daysRemaining,
      urgency,
      reorderNow: item.currentStock <= item.reorderPoint,
    };
  });
};

export const detectWholesalerFraud = (
  wholesaler: {
    id: string;
    name: string;
    orderSizes: number[];
    paymentHistory: { onTime: boolean }[];
    addresses: string[];
  }
): { fraudScore: number; signals: string[]; recommendation: string } => {
  const avgOrderSize = wholesaler.orderSizes.reduce((a, b) => a + b, 0) / wholesaler.orderSizes.length;
  const lastOrderSize = wholesaler.orderSizes[wholesaler.orderSizes.length - 1] || 0;
  const unusualOrderSize = lastOrderSize > avgOrderSize * 2;
  
  const paymentDelays = wholesaler.paymentHistory.filter(p => !p.onTime).length;
  const addressMismatches = new Set(wholesaler.addresses).size > 2;
  
  const { fraudScore, signals } = detectFraudSignals({
    unusualOrderSize,
    paymentDelays,
    addressMismatches,
  });

  let recommendation = '';
  if (fraudScore > 60) recommendation = 'Require manual verification before processing';
  else if (fraudScore > 30) recommendation = 'Monitor closely - flag for review';
  else recommendation = 'Low risk - proceed normally';

  return { fraudScore, signals, recommendation };
};

export const scoreAmbassadorPerformance = (
  ambassador: {
    id: string;
    name: string;
    storesOnboarded: number;
    activeStores: number;
    totalCommissions: number;
    region: string;
  }
): { score: number; tier: 'bronze' | 'silver' | 'gold' | 'platinum'; projectedEarnings: number } => {
  const score = calculateWeightedScore([
    { value: ambassador.storesOnboarded, weight: 30, max: 50 },
    { value: ambassador.activeStores, weight: 40, max: 30 },
    { value: ambassador.totalCommissions, weight: 30, max: 10000 },
  ]);

  const tier = score >= 85 ? 'platinum' : score >= 70 ? 'gold' : score >= 50 ? 'silver' : 'bronze';
  const projectedEarnings = ambassador.totalCommissions * (1 + (score / 100) * 0.2);

  return { score, tier, projectedEarnings: Math.round(projectedEarnings) };
};
