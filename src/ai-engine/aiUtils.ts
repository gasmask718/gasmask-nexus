// AI Utility Functions for Grabba Skyscraper

export const calculateRollingAverage = (values: number[], window: number = 7): number => {
  if (values.length === 0) return 0;
  const slice = values.slice(-window);
  return slice.reduce((sum, v) => sum + v, 0) / slice.length;
};

export const calculateTrend = (values: number[]): 'rising' | 'stable' | 'declining' => {
  if (values.length < 2) return 'stable';
  const recent = calculateRollingAverage(values.slice(-3), 3);
  const older = calculateRollingAverage(values.slice(-7, -3), 4);
  const change = ((recent - older) / (older || 1)) * 100;
  if (change > 5) return 'rising';
  if (change < -5) return 'declining';
  return 'stable';
};

export const calculateWeightedScore = (
  factors: { value: number; weight: number; max?: number }[]
): number => {
  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  const weightedSum = factors.reduce((sum, f) => {
    const normalized = f.max ? (f.value / f.max) * 100 : f.value;
    return sum + normalized * f.weight;
  }, 0);
  return Math.round(weightedSum / totalWeight);
};

export const predictDepletion = (
  currentStock: number,
  dailyUsage: number
): { daysRemaining: number; depletionDate: Date | null } => {
  if (dailyUsage <= 0) return { daysRemaining: Infinity, depletionDate: null };
  const daysRemaining = Math.floor(currentStock / dailyUsage);
  const depletionDate = new Date();
  depletionDate.setDate(depletionDate.getDate() + daysRemaining);
  return { daysRemaining, depletionDate };
};

export const detectAnomaly = (
  value: number,
  historicalValues: number[],
  threshold: number = 2
): boolean => {
  if (historicalValues.length < 3) return false;
  const mean = historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length;
  const variance = historicalValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / historicalValues.length;
  const stdDev = Math.sqrt(variance);
  return Math.abs(value - mean) > threshold * stdDev;
};

export const calculateGrowthRate = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
};

export const segmentByPerformance = <T extends { score: number }>(
  items: T[]
): { top: T[]; middle: T[]; bottom: T[] } => {
  const sorted = [...items].sort((a, b) => b.score - a.score);
  const topCount = Math.ceil(items.length * 0.2);
  const bottomCount = Math.ceil(items.length * 0.2);
  return {
    top: sorted.slice(0, topCount),
    middle: sorted.slice(topCount, -bottomCount || undefined),
    bottom: sorted.slice(-bottomCount),
  };
};

export const generateForecast = (
  historicalData: number[],
  periodsAhead: number = 7
): number[] => {
  if (historicalData.length < 3) {
    const lastValue = historicalData[historicalData.length - 1] || 0;
    return Array(periodsAhead).fill(lastValue);
  }
  
  const trend = calculateTrend(historicalData);
  const average = calculateRollingAverage(historicalData);
  const trendMultiplier = trend === 'rising' ? 1.02 : trend === 'declining' ? 0.98 : 1;
  
  const forecast: number[] = [];
  let lastValue = historicalData[historicalData.length - 1];
  
  for (let i = 0; i < periodsAhead; i++) {
    const seasonalFactor = 1 + Math.sin((i / 7) * Math.PI) * 0.1;
    lastValue = lastValue * trendMultiplier * seasonalFactor;
    forecast.push(Math.round(lastValue));
  }
  
  return forecast;
};

export const optimizeRoute = (
  stops: { id: string; lat: number; lng: number; priority: number }[]
): typeof stops => {
  // Simple nearest-neighbor with priority weighting
  if (stops.length <= 2) return stops;
  
  const sorted = [...stops].sort((a, b) => b.priority - a.priority);
  const optimized: typeof stops = [sorted[0]];
  const remaining = sorted.slice(1);
  
  while (remaining.length > 0) {
    const last = optimized[optimized.length - 1];
    let nearestIdx = 0;
    let nearestDist = Infinity;
    
    remaining.forEach((stop, idx) => {
      const dist = Math.sqrt(
        Math.pow(stop.lat - last.lat, 2) + Math.pow(stop.lng - last.lng, 2)
      );
      const weightedDist = dist / (stop.priority || 1);
      if (weightedDist < nearestDist) {
        nearestDist = weightedDist;
        nearestIdx = idx;
      }
    });
    
    optimized.push(remaining.splice(nearestIdx, 1)[0]);
  }
  
  return optimized;
};

export const calculateChurnRisk = (
  daysSinceLastOrder: number,
  totalOrders: number,
  averageOrderValue: number
): { risk: 'low' | 'medium' | 'high'; score: number } => {
  let score = 0;
  
  if (daysSinceLastOrder > 30) score += 30;
  else if (daysSinceLastOrder > 14) score += 15;
  
  if (totalOrders < 3) score += 25;
  else if (totalOrders < 10) score += 10;
  
  if (averageOrderValue < 100) score += 20;
  else if (averageOrderValue < 300) score += 10;
  
  // Loyalty bonus
  if (totalOrders > 20 && daysSinceLastOrder < 14) score -= 20;
  
  score = Math.max(0, Math.min(100, score));
  
  return {
    score,
    risk: score > 60 ? 'high' : score > 30 ? 'medium' : 'low',
  };
};

export const detectFraudSignals = (
  metrics: {
    unusualOrderSize?: boolean;
    paymentDelays?: number;
    addressMismatches?: boolean;
    rapidOrderChanges?: boolean;
  }
): { fraudScore: number; signals: string[] } => {
  const signals: string[] = [];
  let score = 0;
  
  if (metrics.unusualOrderSize) {
    signals.push('Unusual order size detected');
    score += 25;
  }
  if (metrics.paymentDelays && metrics.paymentDelays > 3) {
    signals.push(`${metrics.paymentDelays} payment delays`);
    score += metrics.paymentDelays * 5;
  }
  if (metrics.addressMismatches) {
    signals.push('Address mismatch detected');
    score += 20;
  }
  if (metrics.rapidOrderChanges) {
    signals.push('Rapid order modifications');
    score += 15;
  }
  
  return { fraudScore: Math.min(100, score), signals };
};
