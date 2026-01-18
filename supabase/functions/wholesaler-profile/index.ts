import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// The 4 Grabba brands - always return all 4
const GRABBA_BRANDS = [
  { key: 'grabba', name: 'Grabba' },
  { key: 'hot grabba', name: 'Hot Grabba' },
  { key: 'dark grabba', name: 'Dark Grabba' },
  { key: 'grabba leaf', name: 'Grabba Leaf' },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const wholesalerId = url.pathname.split('/').pop();

    if (!wholesalerId) {
      return new Response(
        JSON.stringify({ error: "Wholesaler ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch wholesaler profile from wholesale_hubs
    const { data: wholesaler, error: wholesalerError } = await supabase
      .from('wholesale_hubs')
      .select('*')
      .eq('id', wholesalerId)
      .maybeSingle();

    if (wholesalerError) {
      throw new Error(`Failed to fetch wholesaler: ${wholesalerError.message}`);
    }

    if (!wholesaler) {
      return new Response(
        JSON.stringify({ error: "Wholesaler not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================
    // TERRITORY COVERAGE - Derived from wholesaler_store_map + stores
    // ============================================
    const { data: storeMappings, error: mappingError } = await supabase
      .from('wholesaler_store_map')
      .select(`
        id,
        is_active,
        store_id,
        stores!inner (
          id,
          name,
          status,
          address_city,
          address_state,
          address_zip,
          type
        )
      `)
      .eq('wholesaler_id', wholesalerId);

    if (mappingError) {
      console.error('Error fetching store mappings:', mappingError);
    }

    const mappings = storeMappings || [];
    const totalStores = mappings.length;
    const activeStores = mappings.filter((m: any) => 
      m.is_active && m.stores?.status === 'active'
    ).length;
    const dormantStores = totalStores - activeStores;

    // Extract unique boros (cities), neighborhoods, zips
    const boros = [...new Set(mappings.map((m: any) => m.stores?.address_city).filter(Boolean))];
    const neighborhoods: string[] = []; // Would need neighborhood column
    const zips = [...new Set(mappings.map((m: any) => m.stores?.address_zip).filter(Boolean))];

    // Coverage score: simple % of active stores
    const coverageScore = totalStores > 0 
      ? Math.round((activeStores / totalStores) * 100)
      : 0;

    const territoryCoverage = {
      totalStores,
      activeStores,
      dormantStores,
      boros,
      neighborhoods,
      zips,
      coverageScore,
      stores: mappings.map((m: any) => ({
        id: m.stores?.id,
        name: m.stores?.name,
        status: m.stores?.status,
        city: m.stores?.address_city,
        isActive: m.is_active,
      })),
    };

    // ============================================
    // TUBES SOLD BY BRAND - From wholesale_orders
    // Always returns all 4 brands with LEFT JOIN semantics
    // ============================================
    const { data: brandSales, error: brandError } = await supabase
      .from('wholesale_orders')
      .select('brand, tubes_total, created_at')
      .eq('wholesaler_id', wholesalerId)
      .not('brand', 'is', null);

    if (brandError) {
      console.error('Error fetching brand sales:', brandError);
    }

    const salesData = brandSales || [];
    
    // Aggregate by brand
    const brandAggregates: Record<string, { tubesSold: number; lastSoldAt: string | null; orderCount: number }> = {};
    
    salesData.forEach((order: any) => {
      const brandKey = order.brand?.toLowerCase() || '';
      if (!brandAggregates[brandKey]) {
        brandAggregates[brandKey] = { tubesSold: 0, lastSoldAt: null, orderCount: 0 };
      }
      brandAggregates[brandKey].tubesSold += order.tubes_total || 0;
      brandAggregates[brandKey].orderCount += 1;
      
      // Track most recent sale
      if (!brandAggregates[brandKey].lastSoldAt || 
          new Date(order.created_at) > new Date(brandAggregates[brandKey].lastSoldAt!)) {
        brandAggregates[brandKey].lastSoldAt = order.created_at;
      }
    });

    // Build tubesSoldByBrand array - ALWAYS include all 4 brands
    const tubesSoldByBrand = GRABBA_BRANDS.map(brand => {
      const agg = brandAggregates[brand.key] || { tubesSold: 0, lastSoldAt: null, orderCount: 0 };
      return {
        brandKey: brand.key,
        brandName: brand.name,
        tubesSold: agg.tubesSold,
        lastSoldAt: agg.lastSoldAt,
        orderCount: agg.orderCount,
      };
    });

    // ============================================
    // RESPONSE
    // ============================================
    const response = {
      wholesaler: {
        id: wholesaler.id,
        name: wholesaler.name,
        status: wholesaler.status || 'active',
        city: wholesaler.city,
        state: wholesaler.state,
        phone: wholesaler.phone,
        email: wholesaler.email,
      },
      territoryCoverage,
      tubesSoldByBrand,
    };

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error("Error in wholesaler-profile:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
