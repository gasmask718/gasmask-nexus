import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ActiveFlashSale {
  id: string;
  name: string;
  discount_pct: number;
  starts_at: string;
  ends_at: string;
  product_ids: string[] | null;
  category_filter: string | null;
  show_countdown: boolean | null;
  banner_text: string | null;
  status: string;
}

export function useActiveFlashSale() {
  return useQuery<ActiveFlashSale | null>({
    queryKey: ["dd-active-flash-sale"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dd_flash_sales" as never)
        .select("*")
        .eq("status", "active")
        .lte("starts_at", new Date().toISOString())
        .gt("ends_at", new Date().toISOString())
        .order("ends_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return (data as ActiveFlashSale | null) ?? null;
    },
  });
}

export function flashSaleAppliesToProduct(
  sale: ActiveFlashSale | null | undefined,
  product: { id?: string | null; category?: string | null } | null | undefined,
): boolean {
  if (!sale || !product) return false;
  const ids = sale.product_ids ?? [];
  if (ids.length > 0) {
    return !!product.id && ids.includes(product.id);
  }
  if (sale.category_filter) {
    return (product.category ?? "").toLowerCase() === sale.category_filter.toLowerCase();
  }
  // No product filter and no category filter → sitewide
  return true;
}

export function flashSalePrice(originalPrice: number, discountPct: number): number {
  const pct = Math.max(0, Math.min(100, Number(discountPct) || 0));
  return Math.max(0, originalPrice * (1 - pct / 100));
}

export function useCountdown(endIso: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endIso) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [endIso]);
  if (!endIso) return { ms: 0, label: "", expired: true };
  const ms = Math.max(0, new Date(endIso).getTime() - now);
  const expired = ms <= 0;
  const s = Math.floor(ms / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return { ms, label: `${hh}:${mm}:${ss}`, expired };
}
