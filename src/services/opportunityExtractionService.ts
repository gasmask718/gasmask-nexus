// ═══════════════════════════════════════════════════════════════════════════════
// OPPORTUNITY EXTRACTION SERVICE — Detects opportunities from notes/interactions
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';

export interface ExtractedOpportunity {
  opportunity_text: string;
  confidence: number;
}

/**
 * Opportunity detection patterns based on client requirements
 */
const OPPORTUNITY_PATTERNS = {
  wholesaler: [
    /wholesaler/i,
    /wholesale/i,
    /distribute/i,
    /sell to other stores/i,
    /resell/i,
    /wants to be.*wholesaler/i,
    /interested in.*wholesale/i,
  ],
  additional_stores: [
    /family has.*stores/i,
    /family has additional stores/i,
    /other locations/i,
    /multiple stores/i,
    /chain/i,
    /additional stores/i,
    /has stores/i,
    /owns.*stores/i,
  ],
  new_brands: [
    /wants other brands/i,
    /wants.*brand/i,
    /interested in.*brand/i,
    /looking for.*brand/i,
    /wants.*other.*brand/i,
  ],
  flowers: [
    /flowers/i,
    /wants flowers/i,
    /interested in flowers/i,
    /flower/i,
  ],
  expansion: [
    /opening new store/i,
    /expanding/i,
    /new location/i,
    /opening.*location/i,
  ],
};

/**
 * Extract opportunities from text using keyword matching (local fallback)
 */
function extractOpportunitiesLocally(text: string): ExtractedOpportunity[] {
  const opportunities: ExtractedOpportunity[] = [];
  const lowerText = text.toLowerCase();

  // Check for wholesaler opportunities
  if (OPPORTUNITY_PATTERNS.wholesaler.some(pattern => pattern.test(text))) {
    opportunities.push({
      opportunity_text: 'Wants to be a wholesaler',
      confidence: 0.8,
    });
  }

  // Check for additional stores
  if (OPPORTUNITY_PATTERNS.additional_stores.some(pattern => pattern.test(text))) {
    opportunities.push({
      opportunity_text: 'Family has additional stores',
      confidence: 0.8,
    });
  }

  // Check for new brands
  if (OPPORTUNITY_PATTERNS.new_brands.some(pattern => pattern.test(text))) {
    const brandMatch = text.match(/wants.*?brand[^.]*/i);
    if (brandMatch) {
      opportunities.push({
        opportunity_text: brandMatch[0].trim(),
        confidence: 0.7,
      });
    } else {
      opportunities.push({
        opportunity_text: 'Wants other brands',
        confidence: 0.7,
      });
    }
  }

  // Check for flowers
  if (OPPORTUNITY_PATTERNS.flowers.some(pattern => pattern.test(text))) {
    opportunities.push({
      opportunity_text: 'Flowers wanted',
      confidence: 0.8,
    });
  }

  // Check for expansion
  if (OPPORTUNITY_PATTERNS.expansion.some(pattern => pattern.test(text))) {
    opportunities.push({
      opportunity_text: 'Opening new store / Expanding',
      confidence: 0.7,
    });
  }

  return opportunities;
}

/**
 * Extract opportunities from text using AI (via edge function)
 */
async function extractOpportunitiesWithAI(
  text: string,
  storeName?: string
): Promise<ExtractedOpportunity[]> {
  try {
    const { data, error } = await supabase.functions.invoke('extract-store-profile', {
      body: {
        storeId: '',
        storeName: storeName || 'Unknown Store',
        notesText: text,
        notesCount: 1,
        extractOpportunitiesOnly: true, // Flag to indicate we only want opportunities
      },
    });

    if (error) {
      console.error('[OpportunityExtraction] AI error:', error);
      return extractOpportunitiesLocally(text);
    }

    if (data?.opportunities && Array.isArray(data.opportunities.notes)) {
      return data.opportunities.notes.map((opp: string) => ({
        opportunity_text: opp,
        confidence: data.extraction_confidence || 0.7,
      }));
    }

    // Fallback to local extraction
    return extractOpportunitiesLocally(text);
  } catch (e) {
    console.error('[OpportunityExtraction] Error calling AI:', e);
    return extractOpportunitiesLocally(text);
  }
}

/**
 * Save extracted opportunities to database
 */
async function saveOpportunities(
  storeMasterId: string,
  opportunities: ExtractedOpportunity[],
  sourceNoteId?: string,
  sourceInteractionId?: string
): Promise<{ success: boolean; saved: number; skipped: number }> {
  if (opportunities.length === 0) {
    return { success: true, saved: 0, skipped: 0 };
  }

  let saved = 0;
  let skipped = 0;

  for (const opp of opportunities) {
    try {
      // Check if opportunity already exists (to avoid duplicates)
      const { data: existing } = await supabase
        .from('store_opportunities')
        .select('id')
        .eq('store_id', storeMasterId)
        .eq('opportunity_text', opp.opportunity_text)
        .eq('is_completed', false)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      // Insert new opportunity
      const { error } = await supabase.from('store_opportunities').insert({
        store_id: storeMasterId,
        opportunity_text: opp.opportunity_text,
        source: 'ai_extracted',
        detected_from_note_id: sourceNoteId || null,
        detected_from_interaction_id: sourceInteractionId || null,
        is_completed: false,
      });

      if (error) {
        console.error('[OpportunityExtraction] Error saving opportunity:', error);
        skipped++;
      } else {
        saved++;
      }
    } catch (e) {
      console.error('[OpportunityExtraction] Error processing opportunity:', e);
      skipped++;
    }
  }

  return { success: true, saved, skipped };
}

/**
 * Extract and save opportunities from a note
 */
export async function extractOpportunitiesFromNote(
  storeMasterId: string,
  noteId: string,
  noteText: string,
  storeName?: string
): Promise<{ success: boolean; saved: number; skipped: number }> {
  try {
    // Try AI extraction first
    const opportunities = await extractOpportunitiesWithAI(noteText, storeName);

    // Save opportunities to database
    const result = await saveOpportunities(storeMasterId, opportunities, noteId);

    if (result.saved > 0) {
      console.log(`[OpportunityExtraction] Saved ${result.saved} opportunities from note ${noteId}`);
    }

    return result;
  } catch (e) {
    console.error('[OpportunityExtraction] Error extracting from note:', e);
    return { success: false, saved: 0, skipped: 0 };
  }
}

/**
 * Extract and save opportunities from an interaction
 */
export async function extractOpportunitiesFromInteraction(
  storeMasterId: string,
  interactionId: string,
  interactionText: string,
  storeName?: string
): Promise<{ success: boolean; saved: number; skipped: number }> {
  try {
    // Combine subject and summary for better extraction
    const textToAnalyze = interactionText;

    // Try AI extraction first
    const opportunities = await extractOpportunitiesWithAI(textToAnalyze, storeName);

    // Save opportunities to database
    const result = await saveOpportunities(storeMasterId, opportunities, undefined, interactionId);

    if (result.saved > 0) {
      console.log(`[OpportunityExtraction] Saved ${result.saved} opportunities from interaction ${interactionId}`);
    }

    return result;
  } catch (e) {
    console.error('[OpportunityExtraction] Error extracting from interaction:', e);
    return { success: false, saved: 0, skipped: 0 };
  }
}

/**
 * Extract opportunities from combined text (for batch processing)
 */
export async function extractOpportunitiesFromText(
  storeMasterId: string,
  text: string,
  storeName?: string
): Promise<{ success: boolean; saved: number; skipped: number }> {
  try {
    const opportunities = await extractOpportunitiesWithAI(text, storeName);
    const result = await saveOpportunities(storeMasterId, opportunities);

    return result;
  } catch (e) {
    console.error('[OpportunityExtraction] Error extracting from text:', e);
    return { success: false, saved: 0, skipped: 0 };
  }
}

