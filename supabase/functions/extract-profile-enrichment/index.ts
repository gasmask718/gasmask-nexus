import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Detection patterns
const PHONE_REGEX = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const ADDRESS_REGEX = /\d{1,5}\s+(?:[A-Z][a-z]+\.?\s+){1,4}(?:St(?:reet)?|Ave(?:nue)?|Blvd|Rd|Road|Dr(?:ive)?|Ln|Lane|Pl(?:ace)?|Ct|Way|Pkwy|Hwy)\b\.?/gi;

const CONTACT_KEYWORDS = [
  'new owner', 'manager is', 'call him', 'call her', 'ask for',
  'owner changed', 'new manager', 'owner is', 'manager name',
  'talk to', 'speak to', 'contact is', 'person is', 'name is',
  'his name', 'her name', 'goes by', 'they call him', 'they call her',
];

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits[0] === '1') return digits.substring(1);
  return digits;
}

interface EnrichmentCandidate {
  enrichment_type: 'new_contact' | 'new_phone' | 'new_email' | 'new_address';
  extracted_value: Record<string, any>;
  confidence_score: number;
  matched_existing: boolean;
  recommended_action: 'create' | 'attach' | 'ignore';
}

function extractContactNames(text: string): Array<{ name: string; role?: string; context: string }> {
  const results: Array<{ name: string; role?: string; context: string }> = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const lower = line.toLowerCase();
    for (const keyword of CONTACT_KEYWORDS) {
      const idx = lower.indexOf(keyword);
      if (idx === -1) continue;

      // Extract text after keyword
      const after = line.substring(idx + keyword.length).trim();
      // Try to get the name (first 1-3 capitalized words)
      const nameMatch = after.match(/^[:\-\s]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/);
      if (nameMatch) {
        const name = nameMatch[1].trim();
        if (name.length >= 2 && name.length <= 40) {
          let role: string | undefined;
          if (lower.includes('owner')) role = 'owner';
          else if (lower.includes('manager')) role = 'manager';
          results.push({ name, role, context: line.trim() });
        }
      }
    }
  }
  return results;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization');

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) throw new Error('Unauthorized');

    const { batch_id } = await req.json();
    if (!batch_id) throw new Error('batch_id required');

    console.log(`[Enrichment] Processing batch ${batch_id}`);

    // Get all events for this batch that have a linked store
    const { data: events, error: eventsError } = await supabase
      .from('audit_note_events')
      .select('id, store_id, raw_line, parsed, confidence_score')
      .eq('batch_id', batch_id)
      .not('store_id', 'is', null);
    if (eventsError) throw eventsError;

    if (!events?.length) {
      return new Response(JSON.stringify({ status: 'no_events', candidates_created: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Group events by store
    const storeEvents: Record<string, typeof events> = {};
    for (const evt of events) {
      const sid = evt.store_id!;
      (storeEvents[sid] = storeEvents[sid] || []).push(evt);
    }

    const storeIds = Object.keys(storeEvents);

    // Fetch existing store data for comparison
    const { data: stores } = await supabase
      .from('store_master')
      .select('id, phone, email, owner_name, address_street')
      .in('id', storeIds);

    const { data: contacts } = await supabase
      .from('store_contacts')
      .select('id, store_id, name, phone, email, role')
      .is('deleted_at', null)
      .in('store_id', storeIds);

    const storeMap = new Map((stores || []).map(s => [s.id, s]));
    const contactMap = new Map<string, typeof contacts>();
    for (const c of (contacts || [])) {
      const arr = contactMap.get(c.store_id) || [];
      arr.push(c);
      contactMap.set(c.store_id, arr);
    }

    const allCandidates: Array<EnrichmentCandidate & { store_id: string }> = [];

    for (const [storeId, evts] of Object.entries(storeEvents)) {
      const store = storeMap.get(storeId);
      const storeContacts = contactMap.get(storeId) || [];
      const fullText = evts.map(e => e.raw_line).join('\n');

      // Collect all existing phones and emails for comparison
      const existingPhones = new Set<string>();
      const existingEmails = new Set<string>();
      const existingNames = new Set<string>();

      if (store?.phone) existingPhones.add(normalizePhone(store.phone));
      if (store?.email) existingEmails.add(store.email.toLowerCase());
      if (store?.owner_name) existingNames.add(store.owner_name.toLowerCase());

      for (const c of storeContacts) {
        if (c.phone) existingPhones.add(normalizePhone(c.phone));
        if (c.email) existingEmails.add(c.email.toLowerCase());
        if (c.name) existingNames.add(c.name.toLowerCase());
      }

      // 1️⃣ Phone Detection
      const phoneMatches = fullText.match(PHONE_REGEX) || [];
      const seenPhones = new Set<string>();
      for (const raw of phoneMatches) {
        const normalized = normalizePhone(raw);
        if (normalized.length < 10 || seenPhones.has(normalized)) continue;
        seenPhones.add(normalized);

        const matched = existingPhones.has(normalized);
        if (!matched) {
          allCandidates.push({
            store_id: storeId,
            enrichment_type: 'new_phone',
            extracted_value: { phone: normalized, raw_match: raw, source_text: fullText.substring(0, 200) },
            confidence_score: 80,
            matched_existing: false,
            recommended_action: 'create',
          });
        }
      }

      // 2️⃣ Email Detection
      const emailMatches = fullText.match(EMAIL_REGEX) || [];
      const seenEmails = new Set<string>();
      for (const email of emailMatches) {
        const lower = email.toLowerCase();
        if (seenEmails.has(lower)) continue;
        seenEmails.add(lower);

        const matched = existingEmails.has(lower);
        if (!matched) {
          allCandidates.push({
            store_id: storeId,
            enrichment_type: 'new_email',
            extracted_value: { email: lower, source_text: fullText.substring(0, 200) },
            confidence_score: 85,
            matched_existing: false,
            recommended_action: 'attach',
          });
        }
      }

      // 3️⃣ Contact Name Detection
      const nameResults = extractContactNames(fullText);
      for (const { name, role, context } of nameResults) {
        const matched = existingNames.has(name.toLowerCase());
        if (!matched) {
          allCandidates.push({
            store_id: storeId,
            enrichment_type: 'new_contact',
            extracted_value: { name, role: role || null, context, source_text: fullText.substring(0, 200) },
            confidence_score: role ? 90 : 75,
            matched_existing: false,
            recommended_action: 'create',
          });
        }
      }

      // 4️⃣ Address Detection
      const addressMatches = fullText.match(ADDRESS_REGEX) || [];
      const seenAddresses = new Set<string>();
      for (const addr of addressMatches) {
        const normalized = addr.trim();
        if (seenAddresses.has(normalized.toLowerCase())) continue;
        seenAddresses.add(normalized.toLowerCase());

        // Check if it matches the store's primary address
        const matchesPrimary = store?.address_street &&
          store.address_street.toLowerCase().includes(normalized.toLowerCase().substring(0, 10));

        if (!matchesPrimary) {
          allCandidates.push({
            store_id: storeId,
            enrichment_type: 'new_address',
            extracted_value: { address: normalized, type: 'secondary', source_text: fullText.substring(0, 200) },
            confidence_score: 65,
            matched_existing: false,
            recommended_action: 'create',
          });
        }
      }
    }

    // Insert candidates
    if (allCandidates.length > 0) {
      const rows = allCandidates.map(c => ({
        batch_id,
        store_id: c.store_id,
        enrichment_type: c.enrichment_type,
        extracted_value: c.extracted_value,
        confidence_score: c.confidence_score,
        matched_existing: c.matched_existing,
        recommended_action: c.recommended_action,
        status: 'pending',
      }));

      const { error: insertError } = await supabase
        .from('audit_profile_enrichment_candidates')
        .insert(rows);
      if (insertError) throw insertError;
    }

    console.log(`[Enrichment] Created ${allCandidates.length} candidates for ${storeIds.length} stores`);

    const summary = {
      new_contacts: allCandidates.filter(c => c.enrichment_type === 'new_contact').length,
      new_phones: allCandidates.filter(c => c.enrichment_type === 'new_phone').length,
      new_emails: allCandidates.filter(c => c.enrichment_type === 'new_email').length,
      new_addresses: allCandidates.filter(c => c.enrichment_type === 'new_address').length,
    };

    return new Response(JSON.stringify({
      status: 'completed',
      candidates_created: allCandidates.length,
      summary,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Enrichment] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
