import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BaselineRequest {
  action: "create" | "certify" | "activate" | "list";
  business_id?: string;
  baseline_id?: string;
  baseline_name?: string;
  thresholds?: {
    min_permission_rate?: number;
    max_kill_switch_latency_ms?: number;
    max_confidence_breach_rate?: number;
    max_human_takeover_latency_ms?: number;
    max_unapproved_technique_count?: number;
    min_audit_completeness_rate?: number;
  };
  source_evidence_pack_ids?: string[];
  source_simulation_ids?: string[];
  certified_by?: string;
  certification_notes?: string;
  is_regulator_grade?: boolean;
}

function computeHash(data: unknown): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const request: BaselineRequest = await req.json();
    const { action, business_id } = request;

    switch (action) {
      case "list": {
        const { data: baselines, error } = await supabase
          .from("compliance_baselines")
          .select("*")
          .eq("business_id", business_id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, baselines }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "create": {
        const { 
          baseline_name, 
          thresholds, 
          source_evidence_pack_ids,
          source_simulation_ids 
        } = request;

        // Get current active baseline for version increment
        const { data: currentActive } = await supabase
          .from("compliance_baselines")
          .select("baseline_version")
          .eq("business_id", business_id)
          .eq("is_active", true)
          .single();

        const newVersion = currentActive 
          ? incrementVersion(currentActive.baseline_version)
          : "1.0.0";

        const { data: baseline, error } = await supabase
          .from("compliance_baselines")
          .insert({
            business_id,
            baseline_name: baseline_name || `Baseline ${newVersion}`,
            baseline_version: newVersion,
            is_active: false,
            is_regulator_grade: false,
            min_permission_rate: thresholds?.min_permission_rate ?? 99.0,
            max_kill_switch_latency_ms: thresholds?.max_kill_switch_latency_ms ?? 100,
            max_confidence_breach_rate: thresholds?.max_confidence_breach_rate ?? 1.0,
            max_human_takeover_latency_ms: thresholds?.max_human_takeover_latency_ms ?? 5000,
            max_unapproved_technique_count: thresholds?.max_unapproved_technique_count ?? 0,
            min_audit_completeness_rate: thresholds?.min_audit_completeness_rate ?? 99.0,
            source_evidence_pack_ids: source_evidence_pack_ids || [],
            source_simulation_ids: source_simulation_ids || [],
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ 
            success: true, 
            baseline,
            message: "Baseline created. Certify it to make it active."
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "certify": {
        const { 
          baseline_id, 
          certified_by, 
          certification_notes,
          is_regulator_grade 
        } = request;

        // Get baseline to certify
        const { data: baseline, error: fetchError } = await supabase
          .from("compliance_baselines")
          .select("*")
          .eq("id", baseline_id)
          .single();

        if (fetchError || !baseline) {
          throw new Error("Baseline not found");
        }

        // Create certification hash
        const certificationData = {
          baseline_id,
          thresholds: {
            min_permission_rate: baseline.min_permission_rate,
            max_kill_switch_latency_ms: baseline.max_kill_switch_latency_ms,
            max_confidence_breach_rate: baseline.max_confidence_breach_rate,
            max_human_takeover_latency_ms: baseline.max_human_takeover_latency_ms,
            max_unapproved_technique_count: baseline.max_unapproved_technique_count,
            min_audit_completeness_rate: baseline.min_audit_completeness_rate,
          },
          certified_by,
          certified_at: new Date().toISOString(),
        };

        const certificationHash = computeHash(certificationData);

        // Update baseline with certification
        const { data: certified, error: updateError } = await supabase
          .from("compliance_baselines")
          .update({
            certified_at: certificationData.certified_at,
            certified_by,
            certification_hash: certificationHash,
            certification_notes,
            is_regulator_grade: is_regulator_grade ?? false,
          })
          .eq("id", baseline_id)
          .select()
          .single();

        if (updateError) throw updateError;

        return new Response(
          JSON.stringify({ 
            success: true, 
            baseline: certified,
            certification_hash: certificationHash,
            message: "Baseline certified. Activate it to make it the reference for drift detection."
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "activate": {
        const { baseline_id } = request;

        // Get baseline to activate
        const { data: baseline, error: fetchError } = await supabase
          .from("compliance_baselines")
          .select("*")
          .eq("id", baseline_id)
          .single();

        if (fetchError || !baseline) {
          throw new Error("Baseline not found");
        }

        if (!baseline.certified_at) {
          throw new Error("Cannot activate uncertified baseline");
        }

        // Get current active baseline
        const { data: currentActive } = await supabase
          .from("compliance_baselines")
          .select("id")
          .eq("business_id", baseline.business_id)
          .eq("is_active", true)
          .single();

        // Deactivate current baseline
        if (currentActive) {
          await supabase
            .from("compliance_baselines")
            .update({ is_active: false })
            .eq("id", currentActive.id);
        }

        // Activate new baseline
        const { data: activated, error: updateError } = await supabase
          .from("compliance_baselines")
          .update({ 
            is_active: true,
            supersedes_baseline_id: currentActive?.id,
          })
          .eq("id", baseline_id)
          .select()
          .single();

        if (updateError) throw updateError;

        // Update sentinel status with new baseline
        await supabase
          .from("sentinel_status")
          .upsert({
            business_id: baseline.business_id,
            active_baseline_id: baseline_id,
            compliance_state: "unknown", // Reset until next evaluation
            sentinel_enabled: true,
          }, { onConflict: "business_id" });

        return new Response(
          JSON.stringify({ 
            success: true, 
            baseline: activated,
            superseded_baseline_id: currentActive?.id,
            message: "Baseline activated. Sentinel will now compare against these thresholds."
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Baseline manager error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function incrementVersion(version: string): string {
  const parts = version.split(".").map(Number);
  parts[2] = (parts[2] || 0) + 1;
  if (parts[2] >= 10) {
    parts[2] = 0;
    parts[1] = (parts[1] || 0) + 1;
  }
  if (parts[1] >= 10) {
    parts[1] = 0;
    parts[0] = (parts[0] || 0) + 1;
  }
  return parts.join(".");
}
