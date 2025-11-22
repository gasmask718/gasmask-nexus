import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { source, filters } = await req.json();

    console.log(`Scraping leads from source: ${source}`);

    // This is a placeholder for actual lead scraping logic
    // In production, this would integrate with real data sources
    const mockLeads = [
      {
        address: "123 Main St",
        city: "Atlanta",
        state: "GA",
        zip_code: "30301",
        lead_source: source || "probate",
        property_type: "single_family",
        owner_name: "John Smith",
        owner_phone: "(404) 555-0100",
        estimated_value: 250000,
        distress_signals: ["probate", "vacant"],
      },
      {
        address: "456 Oak Ave",
        city: "Atlanta",
        state: "GA",
        zip_code: "30302",
        lead_source: source || "tax_delinquent",
        property_type: "multi_family",
        owner_name: "Jane Doe",
        owner_email: "jane@example.com",
        estimated_value: 450000,
        distress_signals: ["tax_delinquent", "high_equity"],
      },
    ];

    // Insert leads into database
    const { data, error } = await supabase
      .from("leads_raw")
      .insert(mockLeads)
      .select();

    if (error) throw error;

    console.log(`Successfully scraped ${data.length} leads`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        count: data.length,
        leads: data 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error scraping leads:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});