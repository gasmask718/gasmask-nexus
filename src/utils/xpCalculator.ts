import { supabase } from "@/integrations/supabase/client";

export const XP_RULES = {
  STORE_VISIT: 10,
  DELIVERY: 20,
  CLEAN_AUDIT: 30,
  ON_TIME_ARRIVAL: 10,
  ROUTE_COMPLETED: 50,
  MISSION_COMPLETED: 100,
  BONUS: 25,
};

export const TIER_THRESHOLDS = {
  bronze: { min: 0, max: 499 },
  silver: { min: 500, max: 1499 },
  gold: { min: 1500, max: 4999 },
  diamond: { min: 5000, max: Infinity },
};

export const calculateTier = (totalXP: number): string => {
  if (totalXP >= TIER_THRESHOLDS.diamond.min) return "diamond";
  if (totalXP >= TIER_THRESHOLDS.gold.min) return "gold";
  if (totalXP >= TIER_THRESHOLDS.silver.min) return "silver";
  return "bronze";
};

export const awardXP = async (
  driverId: string,
  xpAmount: number,
  source: string
): Promise<void> => {
  try {
    // Insert XP record
    const { error: xpError } = await supabase
      .from("driver_xp")
      .insert({
        driver_id: driverId,
        xp_amount: xpAmount,
        source,
      });

    if (xpError) throw xpError;

    // Get current total XP
    const { data: xpData } = await supabase
      .from("driver_xp")
      .select("xp_amount")
      .eq("driver_id", driverId);

    const totalXP = xpData?.reduce((sum, x) => sum + x.xp_amount, 0) || 0;
    const newTier = calculateTier(totalXP);

    // Update or create driver_rewards
    const { data: existingReward } = await supabase
      .from("driver_rewards")
      .select("*")
      .eq("driver_id", driverId)
      .maybeSingle();

    if (existingReward) {
      await supabase
        .from("driver_rewards")
        .update({
          total_xp: totalXP,
          calculated_tier: newTier,
          last_updated: new Date().toISOString(),
        })
        .eq("driver_id", driverId);
    } else {
      await supabase
        .from("driver_rewards")
        .insert({
          driver_id: driverId,
          total_xp: totalXP,
          calculated_tier: newTier,
        });
    }

    console.log(`Awarded ${xpAmount} XP to driver ${driverId}. Total: ${totalXP}, Tier: ${newTier}`);
  } catch (error) {
    console.error("Error awarding XP:", error);
    throw error;
  }
};
