// V9: Relationship Growth Score Service
import { supabase } from "@/integrations/supabase/client";

export type RelationshipScore = {
  score: number; // 0–100
  tier: "Fragile" | "Neutral" | "Strong" | "Elite";
  color: string; // tailwind class
  summary: string;
};

const TIER_CONFIG = {
  Fragile: { color: "bg-red-500/10 text-red-500", min: 0, max: 39 },
  Neutral: { color: "bg-slate-500/10 text-slate-400", min: 40, max: 59 },
  Strong: { color: "bg-emerald-500/10 text-emerald-400", min: 60, max: 79 },
  Elite: { color: "bg-purple-500/10 text-purple-400", min: 80, max: 100 },
};

function getTierFromScore(score: number): { tier: RelationshipScore["tier"]; color: string } {
  if (score >= 80) return { tier: "Elite", color: TIER_CONFIG.Elite.color };
  if (score >= 60) return { tier: "Strong", color: TIER_CONFIG.Strong.color };
  if (score >= 40) return { tier: "Neutral", color: TIER_CONFIG.Neutral.color };
  return { tier: "Fragile", color: TIER_CONFIG.Fragile.color };
}

export async function getStoreRelationshipScore(storeId: string): Promise<RelationshipScore> {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const dateStr = ninetyDaysAgo.toISOString();

  // Fetch interactions in the last 90 days
  const { data: interactions } = await supabase
    .from("contact_interactions")
    .select("id, created_at")
    .eq("store_id", storeId)
    .gte("created_at", dateStr);

  // Fetch orders in the last 90 days (use 'total' column not 'total_amount')
  const { data: orders } = await supabase
    .from("wholesale_orders")
    .select("id, total, created_at")
    .eq("store_id", storeId)
    .gte("created_at", dateStr);

  // Fetch extracted profile for red flags/opportunities
  const { data: profileData } = await supabase
    .from("store_extracted_profiles")
    .select("red_flags, opportunities")
    .eq("store_id", storeId)
    .maybeSingle();

  // Calculate scores
  const interactionCount = interactions?.length || 0;
  const orderCount = orders?.length || 0;
  const totalRevenue = orders?.reduce((sum, o) => sum + Number(o.total || 0), 0) || 0;

  // Extract red flags and opportunities from profile (they are JSON)
  const redFlags = profileData?.red_flags as { notes?: string[] } | null;
  const opportunities = profileData?.opportunities as { notes?: string[] } | null;
  const redFlagCount = redFlags?.notes?.length || 0;
  const opportunityCount = opportunities?.notes?.length || 0;

  // Calculate component scores (each out of 25)
  const interactionScore = Math.min(25, interactionCount * 3); // 8+ interactions = max
  const orderScore = Math.min(25, orderCount * 5); // 5+ orders = max
  const revenueScore = Math.min(25, Math.floor(totalRevenue / 200)); // $5000+ = max
  const riskAdjustment = Math.max(-15, -redFlagCount * 5) + Math.min(15, opportunityCount * 3);

  const rawScore = interactionScore + orderScore + revenueScore + 25 + riskAdjustment;
  const score = Math.max(0, Math.min(100, rawScore));

  const { tier, color } = getTierFromScore(score);

  // Generate summary
  let summary = "";
  if (tier === "Elite") summary = "Excellent relationship with strong engagement and growth";
  else if (tier === "Strong") summary = "Good relationship with regular activity";
  else if (tier === "Neutral") summary = "Moderate engagement, room for growth";
  else summary = "Low engagement, needs attention";

  return { score, tier, color, summary };
}

export async function getRelationshipScoresForStores(
  storeIds: string[]
): Promise<Record<string, RelationshipScore>> {
  if (!storeIds.length) return {};

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const dateStr = ninetyDaysAgo.toISOString();

  // Batch fetch all data
  const [interactionsRes, ordersRes, profilesRes] = await Promise.all([
    supabase
      .from("contact_interactions")
      .select("id, store_id, created_at")
      .in("store_id", storeIds)
      .gte("created_at", dateStr),
    supabase
      .from("wholesale_orders")
      .select("id, store_id, total, created_at")
      .in("store_id", storeIds)
      .gte("created_at", dateStr),
    supabase
      .from("store_extracted_profiles")
      .select("store_id, red_flags, opportunities")
      .in("store_id", storeIds),
  ]);

  // Group by store_id
  const interactionsByStore: Record<string, number> = {};
  const ordersByStore: Record<string, { count: number; revenue: number }> = {};
  const profilesByStore: Record<string, { red_flags: any; opportunities: any }> = {};

  interactionsRes.data?.forEach((i) => {
    interactionsByStore[i.store_id] = (interactionsByStore[i.store_id] || 0) + 1;
  });

  ordersRes.data?.forEach((o) => {
    if (!ordersByStore[o.store_id]) ordersByStore[o.store_id] = { count: 0, revenue: 0 };
    ordersByStore[o.store_id].count++;
    ordersByStore[o.store_id].revenue += Number(o.total || 0);
  });

  profilesRes.data?.forEach((p) => {
    profilesByStore[p.store_id] = { red_flags: p.red_flags, opportunities: p.opportunities };
  });

  // Calculate scores for each store
  const result: Record<string, RelationshipScore> = {};

  for (const storeId of storeIds) {
    const interactionCount = interactionsByStore[storeId] || 0;
    const { count: orderCount = 0, revenue: totalRevenue = 0 } = ordersByStore[storeId] || {};
    const profile = profilesByStore[storeId];
    const redFlagCount = (profile?.red_flags as { notes?: string[] })?.notes?.length || 0;
    const opportunityCount = (profile?.opportunities as { notes?: string[] })?.notes?.length || 0;

    const interactionScore = Math.min(25, interactionCount * 3);
    const orderScore = Math.min(25, orderCount * 5);
    const revenueScore = Math.min(25, Math.floor(totalRevenue / 200));
    const riskAdjustment = Math.max(-15, -redFlagCount * 5) + Math.min(15, opportunityCount * 3);

    const rawScore = interactionScore + orderScore + revenueScore + 25 + riskAdjustment;
    const score = Math.max(0, Math.min(100, rawScore));

    const { tier, color } = getTierFromScore(score);

    let summary = "";
    if (tier === "Elite") summary = "Excellent relationship";
    else if (tier === "Strong") summary = "Good engagement";
    else if (tier === "Neutral") summary = "Moderate activity";
    else summary = "Needs attention";

    result[storeId] = { score, tier, color, summary };
  }

  return result;
}

export async function getRelationshipHealthOverview(): Promise<{
  fragile: number;
  neutral: number;
  strong: number;
  elite: number;
  total: number;
}> {
  // Get all store IDs
  const { data: stores } = await supabase
    .from("store_master")
    .select("id")
    .limit(500);

  if (!stores?.length) {
    return { fragile: 0, neutral: 0, strong: 0, elite: 0, total: 0 };
  }

  const storeIds = stores.map((s) => s.id);
  const scores = await getRelationshipScoresForStores(storeIds);

  const counts = { fragile: 0, neutral: 0, strong: 0, elite: 0 };

  Object.values(scores).forEach((s) => {
    const tierKey = s.tier.toLowerCase() as keyof typeof counts;
    counts[tierKey]++;
  });

  return { ...counts, total: storeIds.length };
}
