// Solar Property Intelligence Engine - Estimation Logic

export interface SolarEstimate {
  roof_estimated_sqft: number;
  estimated_panel_count: number;
  estimated_system_kw: number;
  estimated_monthly_savings: number;
  sunlight_score: number;
  roof_complexity_score: number;
  confidence_score: number;
  estimated_annual_savings: number;
  estimated_25yr_savings: number;
  estimated_system_cost: number;
  payback_years: number;
}

interface EstimateInput {
  monthly_bill?: number;
  home_sqft?: number;
  state?: string;
}

// State-level solar irradiance multipliers (higher = more sun)
const STATE_SUNLIGHT: Record<string, number> = {
  AZ: 95, NM: 93, NV: 92, CA: 88, TX: 85, FL: 84, CO: 82, UT: 82,
  GA: 78, NC: 77, SC: 78, LA: 80, MS: 79, AL: 78, TN: 75, OK: 80,
  AR: 76, KS: 78, MO: 74, VA: 73, MD: 72, NJ: 71, NY: 68, PA: 69,
  OH: 66, IN: 67, IL: 68, MI: 64, WI: 65, MN: 64, IA: 70, NE: 74,
  SD: 73, ND: 71, MT: 72, WY: 76, ID: 74, OR: 62, WA: 58, HI: 90,
  MA: 69, CT: 69, RI: 68, VT: 64, NH: 65, ME: 63, WV: 68, KY: 70,
  DE: 72, DC: 72, AK: 45,
};

// Average roof usable percentage for solar (typically 30-50% of total roof)
const USABLE_ROOF_PCT = 0.35;
// Average panel wattage (400W panels are standard in 2024+)
const PANEL_WATTS = 400;
// Average sqft per panel
const SQFT_PER_PANEL = 17.5;
// Average cost per watt installed
const COST_PER_WATT = 2.75;

export function calculateSolarEstimate(input: EstimateInput): SolarEstimate {
  const { monthly_bill = 150, home_sqft = 1800, state = 'CA' } = input;
  
  // Estimate roof size from home sqft (roof is ~1.1-1.3x floor area depending on pitch)
  const totalRoofSqft = home_sqft * 1.15;
  const usableRoofSqft = Math.round(totalRoofSqft * USABLE_ROOF_PCT);
  
  // Calculate panels that fit
  const maxPanels = Math.floor(usableRoofSqft / SQFT_PER_PANEL);
  
  // Calculate system size needed based on bill
  // Average electricity cost ~$0.15/kWh, average home uses ~900 kWh/month
  const estimatedKwhUsage = monthly_bill / 0.15;
  // Panels produce ~1.4 kWh/day per panel (varies by location)
  const sunlightScore = STATE_SUNLIGHT[state?.toUpperCase()] || 72;
  const sunMultiplier = sunlightScore / 100;
  const kwhPerPanelPerMonth = (PANEL_WATTS / 1000) * 4.5 * 30 * sunMultiplier; // 4.5 peak sun hours avg
  
  // Panels needed to offset bill
  const panelsNeeded = Math.ceil(estimatedKwhUsage / kwhPerPanelPerMonth);
  const actualPanels = Math.min(panelsNeeded, maxPanels);
  
  // System size
  const systemKw = Number((actualPanels * PANEL_WATTS / 1000).toFixed(1));
  
  // Savings calculation
  const offsetPercentage = Math.min((actualPanels / panelsNeeded) * 100, 100) / 100;
  const monthlySavings = Math.round(monthly_bill * offsetPercentage * 0.85); // 85% efficiency factor
  const annualSavings = monthlySavings * 12;
  const savings25yr = annualSavings * 25 * 1.03; // 3% avg rate increase factor
  
  // System cost (before incentives)
  const systemCost = Math.round(systemKw * 1000 * COST_PER_WATT);
  const afterTaxCredit = Math.round(systemCost * 0.7); // 30% federal ITC
  const paybackYears = Number((afterTaxCredit / annualSavings).toFixed(1));
  
  // Roof complexity (simplified - could be enhanced with satellite data)
  const roofComplexity = 50; // median default
  
  // Confidence score based on data quality
  const confidence = input.monthly_bill ? 80 : 60;
  
  return {
    roof_estimated_sqft: usableRoofSqft,
    estimated_panel_count: actualPanels,
    estimated_system_kw: systemKw,
    estimated_monthly_savings: monthlySavings,
    sunlight_score: sunlightScore,
    roof_complexity_score: roofComplexity,
    confidence_score: confidence,
    estimated_annual_savings: annualSavings,
    estimated_25yr_savings: Math.round(savings25yr),
    estimated_system_cost: afterTaxCredit,
    payback_years: paybackYears,
  };
}
