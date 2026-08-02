import { supabase } from "@/integrations/supabase/client";

/**
 * SINGLE SOURCE OF TRUTH for commission rates.
 *
 * Never hardcode a commission percentage anywhere in the app.
 * Always call resolveCommissionRate() (which delegates to the
 * public.get_commission_rate SQL resolver).
 *
 * Precedence: order override > seller > category > platform default.
 */
export type CommissionScope = "platform" | "category" | "seller" | "order";

export interface CommissionRateRow {
  id: string;
  scope: CommissionScope;
  scope_id: string | null;
  rate_pct: number;
  effective_from: string;
  active: boolean;
  note: string | null;
  needs_confirmation: boolean;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function resolveCommissionRate(params: {
  sellerId?: string | null;
  categoryId?: string | null;
  orderId?: string | null;
}): Promise<number | null> {
  const { data, error } = await (supabase as any).rpc("get_commission_rate", {
    p_seller_id: params.sellerId ?? null,
    p_category_id: params.categoryId ?? null,
    p_order_id: params.orderId ?? null,
  });
  if (error) throw error;
  return data === null || data === undefined ? null : Number(data);
}

export const SCOPE_LABEL: Record<CommissionScope, string> = {
  platform: "Platform default",
  category: "Category",
  seller: "Seller",
  order: "Order override",
};

export const SCOPE_PRECEDENCE: CommissionScope[] = ["order", "seller", "category", "platform"];
