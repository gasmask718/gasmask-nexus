// Prop Simulation Engine - Player Prop Intelligence
// Deterministic, explainable simulation logic for player props with calibrated probabilities

export interface CalibrationInputs {
  player_recent_avg?: number;
  player_recent_std?: number;
  player_season_avg?: number;
  minutes_trend?: 'up' | 'flat' | 'down';
  opponent_def_tier?: 'low' | 'med' | 'high';
  pace_tier?: 'slow' | 'avg' | 'fast';
  home_game?: boolean;
}

export interface PlayerPropInput {
  player_name: string;
  stat_type: string;
  line_value: number;
  over_under: 'over' | 'under';
  platform: string;
  odds_or_payout: number;
  // Optional context (legacy)
  recent_games?: number[];
  season_average?: number;
  home_game?: boolean;
  opponent_tier?: 'weak' | 'average' | 'strong';
  pace?: 'slow' | 'average' | 'fast';
  // New calibration inputs
  calibration?: CalibrationInputs;
}

export interface CalibrationFactor {
  factor: string;
  adjustment: number;
  direction: 'up' | 'down' | 'neutral';
}

export interface SimulationResult {
  estimated_probability: number;
  confidence_score: number;
  volatility_score: 'low' | 'medium' | 'high';
  simulated_roi: number;
  break_even_probability: number;
  edge: number;
  recommendation: 'strong_play' | 'lean' | 'pass' | 'avoid';
  reasoning: string[];
  calibration_factors: CalibrationFactor[];
  data_completeness: number;
}

export interface PickemPayout {
  legs: number;
  multiplier: number;
  flex_payouts?: { correct: number; payout: number }[];
}

// Standard pick'em payout structures
export const POWER_ENTRY_PAYOUTS: Record<number, number> = {
  2: 3,
  3: 5,
  4: 10,
  5: 20,
  6: 40,
};

export const FLEX_ENTRY_PAYOUTS: Record<number, { correct: number; payout: number }[]> = {
  3: [
    { correct: 3, payout: 2.25 },
    { correct: 2, payout: 1.25 },
  ],
  4: [
    { correct: 4, payout: 5 },
    { correct: 3, payout: 1.5 },
  ],
  5: [
    { correct: 5, payout: 10 },
    { correct: 4, payout: 2 },
    { correct: 3, payout: 0.4 },
  ],
  6: [
    { correct: 6, payout: 25 },
    { correct: 5, payout: 2 },
    { correct: 4, payout: 0.4 },
  ],
};

// Convert American odds to implied probability
export const oddsToImpliedProbability = (odds: number): number => {
  if (odds > 0) {
    return 100 / (odds + 100);
  } else {
    return Math.abs(odds) / (Math.abs(odds) + 100);
  }
};

// Convert implied probability to American odds
export const probabilityToOdds = (probability: number): number => {
  if (probability >= 0.5) {
    return -Math.round((probability / (1 - probability)) * 100);
  } else {
    return Math.round(((1 - probability) / probability) * 100);
  }
};

// Calculate break-even probability for given odds
export const calculateBreakEven = (odds: number): number => {
  return oddsToImpliedProbability(odds);
};

// Calculate data completeness score (0-100)
const calculateDataCompleteness = (input: PlayerPropInput): number => {
  let score = 0;
  const cal = input.calibration;
  
  if (cal?.player_recent_avg !== undefined) score += 25;
  if (cal?.player_recent_std !== undefined) score += 15;
  if (cal?.player_season_avg !== undefined) score += 20;
  if (cal?.minutes_trend) score += 10;
  if (cal?.opponent_def_tier) score += 10;
  if (cal?.pace_tier) score += 10;
  if (cal?.home_game !== undefined) score += 10;
  
  // Legacy inputs
  if (input.recent_games && input.recent_games.length > 0) score = Math.max(score, 40);
  if (input.season_average !== undefined) score = Math.max(score, 20);
  
  return Math.min(100, score);
};

// Calculate base probability from recent average vs line using normal distribution approximation
const calculateBaseProbFromStats = (
  recentAvg: number,
  recentStd: number | undefined,
  seasonAvg: number | undefined,
  lineValue: number,
  overUnder: 'over' | 'under'
): { probability: number; reasoning: string } => {
  // Blend recent and season averages (70% recent, 30% season if both available)
  let blendedAvg = recentAvg;
  if (seasonAvg !== undefined) {
    blendedAvg = recentAvg * 0.7 + seasonAvg * 0.3;
  }
  
  // Use provided std or estimate as 20% of average
  const std = recentStd ?? (recentAvg * 0.2);
  
  // Calculate z-score
  const zScore = (lineValue - blendedAvg) / (std || 1);
  
  // Approximate normal CDF using logistic function
  // P(X > line) for over, P(X < line) for under
  const probUnder = 1 / (1 + Math.exp(-1.7 * zScore));
  const probability = overUnder === 'over' ? 1 - probUnder : probUnder;
  
  const reasoning = seasonAvg !== undefined
    ? `Blended avg ${blendedAvg.toFixed(1)} (recent ${recentAvg.toFixed(1)}, season ${seasonAvg.toFixed(1)}) vs line ${lineValue}`
    : `Recent avg ${recentAvg.toFixed(1)} (std ${std.toFixed(1)}) vs line ${lineValue}`;
  
  return { probability, reasoning };
};

// Simulate a single player prop with calibrated probability
export const simulatePlayerProp = (input: PlayerPropInput): SimulationResult => {
  const reasoning: string[] = [];
  const calibrationFactors: CalibrationFactor[] = [];
  const cal = input.calibration;
  
  // Calculate data completeness first
  const dataCompleteness = calculateDataCompleteness(input);
  
  // Base probability estimation
  let baseProbability = 0.5; // Start at 50%
  
  // PRIMARY: Use calibration inputs if available
  if (cal?.player_recent_avg !== undefined) {
    const statsResult = calculateBaseProbFromStats(
      cal.player_recent_avg,
      cal.player_recent_std,
      cal.player_season_avg,
      input.line_value,
      input.over_under
    );
    baseProbability = statsResult.probability;
    reasoning.push(statsResult.reasoning);
    
    const diff = baseProbability - 0.5;
    calibrationFactors.push({
      factor: 'Statistical Model',
      adjustment: Math.round(diff * 100),
      direction: diff > 0.01 ? 'up' : diff < -0.01 ? 'down' : 'neutral'
    });
  }
  // FALLBACK: Use legacy recent_games if no calibration
  else if (input.recent_games && input.recent_games.length > 0) {
    const recentAvg = input.recent_games.reduce((a, b) => a + b, 0) / input.recent_games.length;
    const hitRate = input.recent_games.filter(g => 
      input.over_under === 'over' ? g > input.line_value : g < input.line_value
    ).length / input.recent_games.length;
    
    baseProbability = hitRate;
    reasoning.push(`Recent hit rate: ${Math.round(hitRate * 100)}% (last ${input.recent_games.length} games)`);
  }
  
  // Season average adjustment (legacy)
  if (input.season_average !== undefined && !cal?.player_season_avg) {
    const difference = input.season_average - input.line_value;
    const seasonFactor = input.over_under === 'over' 
      ? (difference > 0 ? 0.05 : -0.05)
      : (difference < 0 ? 0.05 : -0.05);
    
    baseProbability = Math.max(0.2, Math.min(0.8, baseProbability + seasonFactor));
    reasoning.push(`Season avg: ${input.season_average.toFixed(1)} vs line ${input.line_value}`);
  }
  
  // CALIBRATION ADJUSTMENTS
  
  // Home/Away adjustment
  const isHome = cal?.home_game ?? input.home_game;
  if (isHome !== undefined) {
    const homeAdj = isHome ? 0.02 : -0.02;
    baseProbability += homeAdj;
    reasoning.push(isHome ? 'Home game (+2%)' : 'Away game (-2%)');
    calibrationFactors.push({
      factor: isHome ? 'Home Game' : 'Away Game',
      adjustment: Math.round(homeAdj * 100),
      direction: isHome ? 'up' : 'down'
    });
  }
  
  // Opponent defense tier adjustment
  if (cal?.opponent_def_tier) {
    const defAdj = {
      low: input.over_under === 'over' ? 0.02 : -0.02,   // Weak defense = easier to score
      med: 0,
      high: input.over_under === 'over' ? -0.02 : 0.02, // Strong defense = harder to score
    }[cal.opponent_def_tier];
    
    baseProbability += defAdj;
    reasoning.push(`Defense tier: ${cal.opponent_def_tier} (${defAdj >= 0 ? '+' : ''}${Math.round(defAdj * 100)}%)`);
    if (defAdj !== 0) {
      calibrationFactors.push({
        factor: `${cal.opponent_def_tier === 'high' ? 'Strong' : 'Weak'} Defense`,
        adjustment: Math.round(defAdj * 100),
        direction: defAdj > 0 ? 'up' : 'down'
      });
    }
  } else if (input.opponent_tier) {
    // Legacy opponent tier
    const oppAdj = {
      weak: input.over_under === 'over' ? 0.05 : -0.05,
      average: 0,
      strong: input.over_under === 'over' ? -0.05 : 0.05,
    }[input.opponent_tier];
    baseProbability += oppAdj;
    reasoning.push(`Opponent tier: ${input.opponent_tier}`);
  }
  
  // Pace tier adjustment
  if (cal?.pace_tier) {
    const paceAdj = {
      fast: input.over_under === 'over' ? 0.02 : -0.02,
      avg: 0,
      slow: input.over_under === 'over' ? -0.02 : 0.02,
    }[cal.pace_tier];
    
    baseProbability += paceAdj;
    reasoning.push(`Pace: ${cal.pace_tier} (${paceAdj >= 0 ? '+' : ''}${Math.round(paceAdj * 100)}%)`);
    if (paceAdj !== 0) {
      calibrationFactors.push({
        factor: `${cal.pace_tier === 'fast' ? 'Fast' : 'Slow'} Pace`,
        adjustment: Math.round(paceAdj * 100),
        direction: paceAdj > 0 ? 'up' : 'down'
      });
    }
  } else if (input.pace) {
    // Legacy pace
    const paceAdj = {
      slow: input.over_under === 'over' ? -0.03 : 0.03,
      average: 0,
      fast: input.over_under === 'over' ? 0.03 : -0.03,
    }[input.pace];
    baseProbability += paceAdj;
    reasoning.push(`Game pace: ${input.pace}`);
  }
  
  // Minutes trend adjustment
  if (cal?.minutes_trend) {
    const minAdj = {
      up: input.over_under === 'over' ? 0.02 : -0.02,
      flat: 0,
      down: input.over_under === 'over' ? -0.02 : 0.02,
    }[cal.minutes_trend];
    
    baseProbability += minAdj;
    reasoning.push(`Minutes trend: ${cal.minutes_trend} (${minAdj >= 0 ? '+' : ''}${Math.round(minAdj * 100)}%)`);
    if (minAdj !== 0) {
      calibrationFactors.push({
        factor: `Minutes ${cal.minutes_trend === 'up' ? 'Up' : 'Down'}`,
        adjustment: Math.round(minAdj * 100),
        direction: minAdj > 0 ? 'up' : 'down'
      });
    }
  }
  
  // Clamp probability to reasonable bounds (0.35 to 0.65 as specified)
  const estimatedProbability = Math.max(0.35, Math.min(0.65, baseProbability));
  
  // Calculate break-even probability
  let breakEven: number;
  const isPickem = input.platform.toLowerCase().includes('prize') || 
                   input.platform.toLowerCase().includes('underdog');
  
  if (isPickem) {
    // Pick'em platforms are ~50% break-even per leg
    breakEven = 0.5;
  } else {
    // Sportsbook: calculate from American odds
    breakEven = calculateBreakEven(input.odds_or_payout);
  }
  
  // Calculate edge
  const edge = (estimatedProbability - breakEven) * 100;
  
  // Calculate simulated ROI properly
  let simulatedRoi: number;
  if (isPickem) {
    // For pick'em: single leg at ~1.9x payout
    const payout = 1.9;
    simulatedRoi = (estimatedProbability * payout) - 1;
  } else {
    // For sportsbook: use actual odds to calculate payout
    let payout: number;
    if (input.odds_or_payout > 0) {
      payout = 1 + (input.odds_or_payout / 100);
    } else {
      payout = 1 + (100 / Math.abs(input.odds_or_payout));
    }
    simulatedRoi = (estimatedProbability * payout) - 1;
  }
  
  // Confidence score (0-100) based on edge + data completeness
  const edgeContribution = Math.abs(edge) * 3; // Each % edge adds 3 points
  const dataContribution = dataCompleteness * 0.4; // Up to 40 points from data
  const confidenceScore = Math.round(
    Math.min(100, Math.max(0,
      20 + // Base
      edgeContribution +
      dataContribution
    ))
  );
  
  // Volatility assessment
  let volatilityScore: 'low' | 'medium' | 'high' = 'medium';
  if (cal?.player_recent_std !== undefined && cal?.player_recent_avg !== undefined) {
    const cv = cal.player_recent_std / cal.player_recent_avg; // Coefficient of variation
    if (cv < 0.15) volatilityScore = 'low';
    else if (cv > 0.30) volatilityScore = 'high';
    reasoning.push(`Stat variance: ${volatilityScore} (CV: ${(cv * 100).toFixed(0)}%)`);
  } else if (input.recent_games && input.recent_games.length >= 3) {
    const variance = calculateVariance(input.recent_games);
    const avgValue = input.recent_games.reduce((a, b) => a + b, 0) / input.recent_games.length;
    const cv = Math.sqrt(variance) / avgValue;
    
    if (cv < 0.15) volatilityScore = 'low';
    else if (cv > 0.30) volatilityScore = 'high';
    
    reasoning.push(`Stat variance: ${volatilityScore}`);
  }
  
  // Recommendation
  let recommendation: 'strong_play' | 'lean' | 'pass' | 'avoid';
  if (edge >= 5 && confidenceScore >= 70) {
    recommendation = 'strong_play';
  } else if (edge >= 2 && confidenceScore >= 50) {
    recommendation = 'lean';
  } else if (edge >= 0) {
    recommendation = 'pass';
  } else {
    recommendation = 'avoid';
  }
  
  return {
    estimated_probability: Math.round(estimatedProbability * 100) / 100,
    confidence_score: confidenceScore,
    volatility_score: volatilityScore,
    simulated_roi: Math.round(simulatedRoi * 1000) / 1000,
    break_even_probability: Math.round(breakEven * 100) / 100,
    edge: Math.round(edge * 10) / 10,
    recommendation,
    reasoning,
    calibration_factors: calibrationFactors,
    data_completeness: dataCompleteness,
  };
};

// Calculate variance
const calculateVariance = (values: number[]): number => {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
};

// Simulate a pick'em entry (power play)
export const simulatePowerEntry = (
  legs: SimulationResult[],
  platform: 'prizepicks' | 'underdog' = 'prizepicks'
): {
  combined_probability: number;
  expected_value: number;
  simulated_roi: number;
  is_profitable: boolean;
  payout_multiplier: number;
  recommendation: string;
} => {
  const numLegs = legs.length;
  const multiplier = POWER_ENTRY_PAYOUTS[numLegs] || Math.pow(2, numLegs - 1);
  
  // Combined probability is product of individual probabilities
  const combinedProbability = legs.reduce(
    (acc, leg) => acc * leg.estimated_probability,
    1
  );
  
  // Expected value: (probability * payout) - (1 - probability) * stake
  // Assuming $1 stake
  const expectedValue = (combinedProbability * multiplier) - 1;
  const simulatedRoi = expectedValue;
  const isProfitable = expectedValue > 0;
  
  let recommendation = '';
  if (expectedValue > 0.5) {
    recommendation = 'Strong +EV entry - consider max sizing';
  } else if (expectedValue > 0.1) {
    recommendation = 'Slight edge - proceed with caution';
  } else if (expectedValue > 0) {
    recommendation = 'Marginal edge - small play only';
  } else {
    recommendation = 'Negative EV - avoid this combination';
  }
  
  return {
    combined_probability: Math.round(combinedProbability * 10000) / 10000,
    expected_value: Math.round(expectedValue * 100) / 100,
    simulated_roi: Math.round(simulatedRoi * 100) / 100,
    is_profitable: isProfitable,
    payout_multiplier: multiplier,
    recommendation,
  };
};

// Simulate a flex entry
export const simulateFlexEntry = (
  legs: SimulationResult[],
  platform: 'prizepicks' | 'underdog' = 'prizepicks'
): {
  expected_value: number;
  simulated_roi: number;
  scenario_payouts: { correct: number; probability: number; payout: number; ev_contribution: number }[];
  recommendation: string;
} => {
  const numLegs = legs.length;
  const flexPayouts = FLEX_ENTRY_PAYOUTS[numLegs] || [];
  
  if (flexPayouts.length === 0) {
    return {
      expected_value: 0,
      simulated_roi: 0,
      scenario_payouts: [],
      recommendation: `Flex entries not available for ${numLegs}-leg plays`,
    };
  }
  
  // Calculate probability of each scenario using binomial distribution
  const probs = legs.map(l => l.estimated_probability);
  const avgProb = probs.reduce((a, b) => a + b, 0) / probs.length;
  
  const scenarioPayouts = flexPayouts.map(fp => {
    // Simplified binomial probability
    const k = fp.correct;
    const n = numLegs;
    const binomialCoeff = factorial(n) / (factorial(k) * factorial(n - k));
    const probability = binomialCoeff * Math.pow(avgProb, k) * Math.pow(1 - avgProb, n - k);
    const evContribution = probability * fp.payout;
    
    return {
      correct: fp.correct,
      probability: Math.round(probability * 10000) / 10000,
      payout: fp.payout,
      ev_contribution: Math.round(evContribution * 1000) / 1000,
    };
  });
  
  const totalEV = scenarioPayouts.reduce((sum, s) => sum + s.ev_contribution, 0);
  const expectedValue = totalEV - 1; // Subtract stake
  
  let recommendation = '';
  if (expectedValue > 0.2) {
    recommendation = 'Flex entry has significant edge';
  } else if (expectedValue > 0) {
    recommendation = 'Flex entry is marginally profitable';
  } else {
    recommendation = 'Flex entry is -EV, consider power play or pass';
  }
  
  return {
    expected_value: Math.round(expectedValue * 100) / 100,
    simulated_roi: Math.round(expectedValue * 100) / 100,
    scenario_payouts: scenarioPayouts,
    recommendation,
  };
};

// Helper factorial function
const factorial = (n: number): number => {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
};

// Compare platforms for the same prop
export const comparePlatforms = (
  prop: PlayerPropInput,
  sportsbook_odds: number,
  pickem_platform: 'prizepicks' | 'underdog' = 'prizepicks'
): {
  sportsbook_ev: number;
  pickem_ev: number;
  best_venue: 'sportsbook' | 'pickem';
  reasoning: string;
} => {
  const simulation = simulatePlayerProp(prop);
  
  // Sportsbook EV
  const sportsbookBreakEven = calculateBreakEven(sportsbook_odds);
  const sportsbookEV = simulation.estimated_probability - sportsbookBreakEven;
  
  // Pick'em EV (assuming ~1.9x payout for single leg equivalent)
  const pickemBreakEven = 0.526; // ~52.6% to break even at 1.9x
  const pickemEV = simulation.estimated_probability - pickemBreakEven;
  
  const bestVenue = sportsbookEV > pickemEV ? 'sportsbook' : 'pickem';
  
  return {
    sportsbook_ev: Math.round(sportsbookEV * 1000) / 1000,
    pickem_ev: Math.round(pickemEV * 1000) / 1000,
    best_venue: bestVenue,
    reasoning: bestVenue === 'sportsbook'
      ? `Sportsbook offers ${Math.round((sportsbookEV - pickemEV) * 1000) / 10}% better edge`
      : `Pick'em platform offers ${Math.round((pickemEV - sportsbookEV) * 1000) / 10}% better edge`,
  };
};

// Generate confidence label
export const getConfidenceLabel = (score: number): 'low' | 'medium' | 'high' => {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
};

// Batch simulation summary
export interface BatchSimulationSummary {
  total_bets: number;
  average_confidence: number;
  average_edge: number;
  average_simulated_roi: number;
  strong_plays: number;
  leans: number;
  passes: number;
  avoids: number;
  by_platform: Record<string, { count: number; avg_edge: number }>;
  by_stat_type: Record<string, { count: number; avg_edge: number }>;
  top_props: { input: PlayerPropInput; result: SimulationResult }[];
  props_to_avoid: { input: PlayerPropInput; result: SimulationResult }[];
}

export const generateBatchSummary = (
  simulations: { input: PlayerPropInput; result: SimulationResult }[]
): BatchSimulationSummary => {
  const total = simulations.length;
  if (total === 0) {
    return {
      total_bets: 0,
      average_confidence: 0,
      average_edge: 0,
      average_simulated_roi: 0,
      strong_plays: 0,
      leans: 0,
      passes: 0,
      avoids: 0,
      by_platform: {},
      by_stat_type: {},
      top_props: [],
      props_to_avoid: [],
    };
  }
  
  const avgConfidence = simulations.reduce((s, x) => s + x.result.confidence_score, 0) / total;
  const avgEdge = simulations.reduce((s, x) => s + x.result.edge, 0) / total;
  const avgRoi = simulations.reduce((s, x) => s + x.result.simulated_roi, 0) / total;
  
  const strongPlays = simulations.filter(s => s.result.recommendation === 'strong_play').length;
  const leans = simulations.filter(s => s.result.recommendation === 'lean').length;
  const passes = simulations.filter(s => s.result.recommendation === 'pass').length;
  const avoids = simulations.filter(s => s.result.recommendation === 'avoid').length;
  
  // Group by platform
  const byPlatform: Record<string, { count: number; total_edge: number }> = {};
  simulations.forEach(s => {
    const p = s.input.platform;
    if (!byPlatform[p]) byPlatform[p] = { count: 0, total_edge: 0 };
    byPlatform[p].count++;
    byPlatform[p].total_edge += s.result.edge;
  });
  
  // Group by stat type
  const byStatType: Record<string, { count: number; total_edge: number }> = {};
  simulations.forEach(s => {
    const st = s.input.stat_type;
    if (!byStatType[st]) byStatType[st] = { count: 0, total_edge: 0 };
    byStatType[st].count++;
    byStatType[st].total_edge += s.result.edge;
  });
  
  // Top props (sorted by edge)
  const sorted = [...simulations].sort((a, b) => b.result.edge - a.result.edge);
  const topProps = sorted.slice(0, 5);
  const propsToAvoid = sorted.slice(-5).filter(s => s.result.edge < 0).reverse();
  
  return {
    total_bets: total,
    average_confidence: Math.round(avgConfidence * 10) / 10,
    average_edge: Math.round(avgEdge * 10) / 10,
    average_simulated_roi: Math.round(avgRoi * 1000) / 1000,
    strong_plays: strongPlays,
    leans,
    passes,
    avoids,
    by_platform: Object.fromEntries(
      Object.entries(byPlatform).map(([k, v]) => [k, { count: v.count, avg_edge: Math.round(v.total_edge / v.count * 10) / 10 }])
    ),
    by_stat_type: Object.fromEntries(
      Object.entries(byStatType).map(([k, v]) => [k, { count: v.count, avg_edge: Math.round(v.total_edge / v.count * 10) / 10 }])
    ),
    top_props: topProps,
    props_to_avoid: propsToAvoid,
  };
};
