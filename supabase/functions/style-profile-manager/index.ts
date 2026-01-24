import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * STYLE PROFILE MANAGER
 * 
 * Manages sales style profiles with strict boundary enforcement.
 * 
 * CORE RULE: AI may learn style, not strategy.
 * AI may imitate tone, not intent.
 * AI may propose changes, never apply them.
 * 
 * Styles only affect:
 * - Word choice
 * - Sentence rhythm
 * - Politeness markers
 * 
 * Styles NEVER affect:
 * - Disclosure text
 * - Permission question
 * - Escalation triggers
 * - Forbidden behavior list
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StyleRequest {
  action: 'list' | 'get' | 'create' | 'propose_update' | 'approve' | 'reject' | 'activate' | 'deactivate' | 'validate_style' | 'get_for_session';
  style_id?: string;
  business_id?: string;
  session_id?: string;
  // Style data
  style_data?: {
    name: string;
    description?: string;
    pace?: 'slow' | 'moderate' | 'fast';
    warmth?: number;
    confidence?: number;
    formality?: number;
    energy?: number;
    vocabulary_level?: 'simple' | 'standard' | 'professional';
    politeness_markers?: string[];
    preferred_phrases?: string[];
    avoided_phrases?: string[];
    approved_campaign_types?: string[];
  };
  // Attribution
  attribution?: {
    human_coach_name: string;
    source_type: 'call_recording' | 'script' | 'training_session' | 'live_observation';
    source_reference?: string;
    training_start_date: string;
    training_end_date?: string;
    technique_notes?: string;
  };
  // Promotion
  promotion_request_id?: string;
  review_notes?: string;
}

// Compute SHA-256 hash for signatures
async function computeHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Auth required for modifications
    const authHeader = req.headers.get("authorization");
    let userId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    const body: StyleRequest = await req.json();
    const { action, style_id, business_id, session_id, style_data, attribution } = body;

    switch (action) {
      case 'list': {
        const { data: styles, error } = await supabase
          .from("sales_style_profiles")
          .select(`
            *,
            style_technique_attribution (
              human_coach_name,
              source_type,
              sample_count
            )
          `)
          .eq("business_id", business_id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, styles }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'get': {
        const { data: style, error } = await supabase
          .from("sales_style_profiles")
          .select(`
            *,
            style_technique_attribution (*),
            style_promotion_requests (*)
          `)
          .eq("id", style_id)
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, style }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'create': {
        if (!userId) {
          return new Response(
            JSON.stringify({ success: false, error: "Authentication required" }),
            { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        if (!style_data || !attribution) {
          return new Response(
            JSON.stringify({ success: false, error: "style_data and attribution required" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // Create style profile
        const { data: style, error: styleError } = await supabase
          .from("sales_style_profiles")
          .insert({
            business_id,
            name: style_data.name,
            description: style_data.description,
            pace: style_data.pace || 'moderate',
            warmth: style_data.warmth || 5,
            confidence: style_data.confidence || 7,
            formality: style_data.formality || 5,
            energy: style_data.energy || 5,
            vocabulary_level: style_data.vocabulary_level || 'standard',
            politeness_markers: style_data.politeness_markers,
            preferred_phrases: style_data.preferred_phrases,
            avoided_phrases: style_data.avoided_phrases,
            approved_campaign_types: style_data.approved_campaign_types || ['product_launch', 'b2b_outreach'],
            created_by: userId,
            owner_user_id: userId,
            is_active: false,
            is_approved: false
          })
          .select()
          .single();

        if (styleError) throw styleError;

        // Create attribution (MANDATORY - no anonymous styles)
        const signatureData = JSON.stringify({
          style_id: style.id,
          coach: attribution.human_coach_name,
          source: attribution.source_type,
          date: attribution.training_start_date
        });
        const signatureHash = await computeHash(signatureData);

        await supabase.from("style_technique_attribution").insert({
          style_id: style.id,
          human_coach_id: userId,
          human_coach_name: attribution.human_coach_name,
          source_type: attribution.source_type,
          source_reference: attribution.source_reference,
          training_start_date: attribution.training_start_date,
          training_end_date: attribution.training_end_date,
          technique_notes: attribution.technique_notes,
          signature_hash: signatureHash
        });

        // Create promotion request (requires human approval to activate)
        await supabase.from("style_promotion_requests").insert({
          style_id: style.id,
          business_id,
          request_type: 'activate',
          requested_changes: style_data,
          ai_reasoning: 'New style profile created - awaiting human approval',
          proposed_by_ai: false,
          status: 'pending'
        });

        return new Response(
          JSON.stringify({
            success: true,
            style_id: style.id,
            message: "Style created - awaiting human approval to activate",
            requires_approval: true
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'propose_update': {
        // AI or user proposes changes - but CANNOT apply them
        const { data: currentStyle } = await supabase
          .from("sales_style_profiles")
          .select("*")
          .eq("id", style_id)
          .single();

        if (!currentStyle) {
          return new Response(
            JSON.stringify({ success: false, error: "Style not found" }),
            { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // Create diff
        const proposedChanges = style_data;

        // Create promotion request
        const { data: request, error } = await supabase
          .from("style_promotion_requests")
          .insert({
            style_id,
            business_id: currentStyle.business_id,
            request_type: 'modify',
            requested_changes: proposedChanges,
            ai_reasoning: body.review_notes || 'Style modification proposed',
            proposed_by_ai: !userId,
            status: 'pending',
            rollback_window_hours: 48
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({
            success: true,
            request_id: request.id,
            message: "Modification proposed - awaiting human approval",
            current_style: currentStyle,
            proposed_changes: proposedChanges
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'approve': {
        if (!userId) {
          return new Response(
            JSON.stringify({ success: false, error: "Human authentication required for approval" }),
            { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        const { data: request } = await supabase
          .from("style_promotion_requests")
          .select("*")
          .eq("id", body.promotion_request_id)
          .single();

        if (!request) {
          return new Response(
            JSON.stringify({ success: false, error: "Promotion request not found" }),
            { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // Create cryptographic signature
        const signatureData = JSON.stringify({
          request_id: request.id,
          style_id: request.style_id,
          approved_by: userId,
          approved_at: new Date().toISOString(),
          changes: request.requested_changes
        });
        const signatureHash = await computeHash(signatureData);

        // Update request
        await supabase
          .from("style_promotion_requests")
          .update({
            status: 'approved',
            reviewed_by: userId,
            reviewed_at: new Date().toISOString(),
            review_notes: body.review_notes,
            human_signature_hash: signatureHash,
            signature_verified: true,
            rollback_expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
          })
          .eq("id", body.promotion_request_id);

        // Apply changes based on request type
        if (request.request_type === 'activate') {
          await supabase
            .from("sales_style_profiles")
            .update({
              is_active: true,
              is_approved: true,
              approved_by: userId,
              approved_at: new Date().toISOString()
            })
            .eq("id", request.style_id);
        } else if (request.request_type === 'modify' && request.requested_changes) {
          await supabase
            .from("sales_style_profiles")
            .update({
              ...request.requested_changes,
              updated_at: new Date().toISOString()
            })
            .eq("id", request.style_id);
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: "Style approved and changes applied",
            signature_hash: signatureHash,
            rollback_available_until: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'reject': {
        if (!userId) {
          return new Response(
            JSON.stringify({ success: false, error: "Human authentication required" }),
            { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        await supabase
          .from("style_promotion_requests")
          .update({
            status: 'rejected',
            reviewed_by: userId,
            reviewed_at: new Date().toISOString(),
            review_notes: body.review_notes
          })
          .eq("id", body.promotion_request_id);

        return new Response(
          JSON.stringify({ success: true, message: "Style promotion rejected" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'validate_style': {
        // Check if style violates any hard boundaries
        const { data: style } = await supabase
          .from("sales_style_profiles")
          .select("*")
          .eq("id", style_id)
          .single();

        if (!style) {
          return new Response(
            JSON.stringify({ success: false, error: "Style not found" }),
            { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        const violations: string[] = [];

        // Check forbidden patterns
        const forbiddenPatterns = style.forbidden_patterns || [];
        const preferredPhrases = style.preferred_phrases || [];
        const avoidedPhrases = style.avoided_phrases || [];

        // Ensure no urgency/pressure in preferred phrases
        const urgencyWords = ['limited time', 'act now', 'hurry', 'dont miss', 'exclusive offer', 'only today'];
        for (const phrase of preferredPhrases) {
          for (const urgent of urgencyWords) {
            if (phrase.toLowerCase().includes(urgent)) {
              violations.push(`Urgency pattern detected in preferred phrases: "${phrase}"`);
            }
          }
        }

        // Validate it doesn't try to modify hard boundaries
        if (style_data) {
          // These would be attempts to modify immutable aspects
          if ('disclosure_override' in style_data) {
            violations.push("Cannot override disclosure text");
          }
          if ('skip_permission' in style_data) {
            violations.push("Cannot skip permission phase");
          }
        }

        return new Response(
          JSON.stringify({
            success: violations.length === 0,
            valid: violations.length === 0,
            violations,
            style_id: style.id
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'get_for_session': {
        // Get style to apply for a given session
        const { data: session } = await supabase
          .from("ai_call_sessions")
          .select("business_id, style_profile_id, campaign_id")
          .eq("id", session_id)
          .single();

        if (!session) {
          return new Response(
            JSON.stringify({ success: false, error: "Session not found" }),
            { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // Get assigned style or default
        let styleQuery = supabase
          .from("sales_style_profiles")
          .select("*")
          .eq("is_active", true)
          .eq("is_approved", true);

        if (session.style_profile_id) {
          styleQuery = styleQuery.eq("id", session.style_profile_id);
        } else {
          styleQuery = styleQuery.eq("business_id", session.business_id).limit(1);
        }

        const { data: style } = await styleQuery.single();

        return new Response(
          JSON.stringify({
            success: true,
            style: style || null,
            session_id,
            note: style ? "Active style applied" : "No active style - using defaults"
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: "Invalid action" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
    }

  } catch (error: any) {
    console.error("❌ Error in style-profile-manager:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
