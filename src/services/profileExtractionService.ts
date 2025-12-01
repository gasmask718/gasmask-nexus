// ═══════════════════════════════════════════════════════════════════════════════
// AI PROFILE EXTRACTION SERVICE — Converts raw notes into structured store profiles
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

// Types for extracted profile data
export interface PersonalProfile {
  owner_name?: string;
  nicknames?: string[];
  background_notes?: string;
  communication_style?: string;
  loyalty_triggers?: string[];
  frustration_triggers?: string[];
  favorite_products?: string[];
  restock_habits_summary?: string;
  personal_rapport_notes?: string;
  [key: string]: string | string[] | undefined;
}

export interface OperationalProfile {
  store_type?: string;
  average_monthly_spend?: number;
  typical_order_pattern?: string;
  preferred_brands?: string[];
  payment_preferences?: string;
  delivery_preference?: string;
  delivery_window?: string;
  inventory_style?: string;
  promo_preference?: string;
  ambassador_potential?: boolean;
  ambassador_potential_note?: string;
  can_host_posters?: boolean;
  wants_affiliate_system?: boolean;
  [key: string]: string | string[] | number | boolean | undefined;
}

export interface RedFlags {
  notes: string[];
  [key: string]: string[];
}

export interface Opportunities {
  notes: string[];
  [key: string]: string[];
}

export interface ExtractedProfile {
  personal_profile: PersonalProfile;
  operational_profile: OperationalProfile;
  red_flags: RedFlags;
  opportunities: Opportunities;
  extraction_confidence: number;
  source_notes_count: number;
}

// Grabba brand keywords for context
const GRABBA_BRANDS = ['gasmask', 'hotmama', 'hot mama', 'scalati', 'hot scalati', 'grabba', 'grabba r us'];

/**
 * Extract structured profile from raw notes using AI
 */
export async function extractStoreProfileFromNotes(params: {
  storeId: string;
  notes: string[];
  storeName?: string;
}): Promise<ExtractedProfile> {
  const { storeId, notes, storeName } = params;
  
  // Combine all notes into a single text block
  const combinedNotes = notes.filter(n => n && n.trim()).join('\n\n---\n\n');
  
  if (!combinedNotes.trim()) {
    return getEmptyProfile(0);
  }

  try {
    // Call AI extraction edge function
    const { data, error } = await supabase.functions.invoke('extract-store-profile', {
      body: {
        storeId,
        storeName: storeName || 'Unknown Store',
        notesText: combinedNotes,
        notesCount: notes.length
      }
    });

    if (error) {
      console.error('[ProfileExtraction] Edge function error:', error);
      return extractProfileLocally(combinedNotes, notes.length);
    }

    if (data?.profile) {
      return {
        ...data.profile,
        source_notes_count: notes.length
      };
    }

    // Fallback to local extraction if edge function doesn't return profile
    return extractProfileLocally(combinedNotes, notes.length);
    
  } catch (e) {
    console.error('[ProfileExtraction] Error calling AI:', e);
    return extractProfileLocally(combinedNotes, notes.length);
  }
}

/**
 * Local keyword-based extraction when AI is unavailable
 */
function extractProfileLocally(notesText: string, notesCount: number): ExtractedProfile {
  const lowerText = notesText.toLowerCase();
  
  const profile: ExtractedProfile = {
    personal_profile: {},
    operational_profile: {},
    red_flags: { notes: [] },
    opportunities: { notes: [] },
    extraction_confidence: 0.5,
    source_notes_count: notesCount
  };

  // Extract owner name patterns
  const ownerMatch = notesText.match(/owner:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  if (ownerMatch) {
    profile.personal_profile.owner_name = ownerMatch[1];
  }

  // Extract communication preferences
  if (lowerText.includes('text only') || lowerText.includes('prefers text')) {
    profile.personal_profile.communication_style = 'Text messages only';
  } else if (lowerText.includes('call') || lowerText.includes('phone')) {
    profile.personal_profile.communication_style = 'Prefers phone calls';
  }

  // Extract preferred brands
  const preferredBrands: string[] = [];
  if (lowerText.includes('gasmask')) preferredBrands.push('GasMask');
  if (lowerText.includes('hotmama') || lowerText.includes('hot mama')) preferredBrands.push('HotMama');
  if (lowerText.includes('scalati') || lowerText.includes('hot scalati')) preferredBrands.push('Hot Scalati');
  if (lowerText.includes('grabba r us')) preferredBrands.push('Grabba R Us');
  if (preferredBrands.length > 0) {
    profile.operational_profile.preferred_brands = preferredBrands;
  }

  // Extract store type
  if (lowerText.includes('smoke shop')) {
    profile.operational_profile.store_type = 'Smoke Shop';
  } else if (lowerText.includes('deli')) {
    profile.operational_profile.store_type = 'Deli';
  } else if (lowerText.includes('gas station')) {
    profile.operational_profile.store_type = 'Gas Station';
  } else if (lowerText.includes('bodega')) {
    profile.operational_profile.store_type = 'Bodega';
  }

  // Extract payment preferences
  if (lowerText.includes('cash only')) {
    profile.operational_profile.payment_preferences = 'Cash only';
  } else if (lowerText.includes('zelle')) {
    profile.operational_profile.payment_preferences = 'Zelle preferred';
  } else if (lowerText.includes('net') || lowerText.includes('credit')) {
    profile.operational_profile.payment_preferences = 'Net terms / Credit';
  }

  // Extract delivery preferences
  if (lowerText.includes('biker') || lowerText.includes('bike')) {
    profile.operational_profile.delivery_preference = 'Biker delivery';
  } else if (lowerText.includes('truck')) {
    profile.operational_profile.delivery_preference = 'Truck delivery';
  } else if (lowerText.includes('pickup')) {
    profile.operational_profile.delivery_preference = 'Store pickup';
  }

  // Extract time windows
  if (lowerText.includes('morning')) {
    profile.operational_profile.delivery_window = 'Mornings';
  } else if (lowerText.includes('afternoon')) {
    profile.operational_profile.delivery_window = 'Afternoons';
  } else if (lowerText.includes('evening')) {
    profile.operational_profile.delivery_window = 'Evenings';
  }

  // Extract red flags
  if (lowerText.includes('late') && lowerText.includes('pay')) {
    profile.red_flags.notes.push('History of late payments');
  }
  if (lowerText.includes('difficult') || lowerText.includes('rude')) {
    profile.red_flags.notes.push('Difficult to work with');
  }
  if (lowerText.includes('unreliable') || lowerText.includes('no show')) {
    profile.red_flags.notes.push('Unreliable - missed appointments');
  }

  // Extract opportunities
  if (lowerText.includes('expand') || lowerText.includes('grow')) {
    profile.opportunities.notes.push('Interested in expanding product range');
  }
  if (lowerText.includes('ambassador') || lowerText.includes('referral')) {
    profile.operational_profile.ambassador_potential = true;
    profile.opportunities.notes.push('Potential ambassador candidate');
  }
  if (lowerText.includes('poster') || lowerText.includes('display')) {
    profile.operational_profile.can_host_posters = true;
    profile.opportunities.notes.push('Can host marketing materials');
  }
  if (lowerText.includes('bulk') || lowerText.includes('wholesale')) {
    profile.opportunities.notes.push('Interested in bulk/wholesale pricing');
  }

  return profile;
}

/**
 * Get empty profile structure
 */
function getEmptyProfile(notesCount: number): ExtractedProfile {
  return {
    personal_profile: {},
    operational_profile: {},
    red_flags: { notes: [] },
    opportunities: { notes: [] },
    extraction_confidence: 0,
    source_notes_count: notesCount
  };
}

/**
 * Save extracted profile to database
 */
export async function saveExtractedProfile(
  storeId: string,
  profile: ExtractedProfile
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if profile exists
    const { data: existing } = await supabase
      .from('store_extracted_profiles')
      .select('id')
      .eq('store_id', storeId)
      .maybeSingle();

    const profileData = {
      store_id: storeId,
      personal_profile: profile.personal_profile as unknown as Json,
      operational_profile: profile.operational_profile as unknown as Json,
      red_flags: profile.red_flags as unknown as Json,
      opportunities: profile.opportunities as unknown as Json,
      extraction_confidence: profile.extraction_confidence,
      source_notes_count: profile.source_notes_count,
      last_extracted_at: new Date().toISOString()
    };

    if (existing) {
      const { error } = await supabase
        .from('store_extracted_profiles')
        .update(profileData)
        .eq('store_id', storeId);
      
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('store_extracted_profiles')
        .insert([profileData]);
      
      if (error) throw error;
    }

    return { success: true };
  } catch (e: any) {
    console.error('[ProfileExtraction] Save error:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Get extracted profile for a store
 */
export async function getExtractedProfile(storeId: string): Promise<ExtractedProfile | null> {
  try {
    const { data, error } = await supabase
      .from('store_extracted_profiles')
      .select('*')
      .eq('store_id', storeId)
      .maybeSingle();

    if (error || !data) return null;

    const parseJsonField = <T>(field: unknown, defaultValue: T): T => {
      if (!field) return defaultValue;
      if (typeof field === 'object') return field as T;
      return defaultValue;
    };

    return {
      personal_profile: parseJsonField<PersonalProfile>(data.personal_profile, {}),
      operational_profile: parseJsonField<OperationalProfile>(data.operational_profile, {}),
      red_flags: parseJsonField<RedFlags>(data.red_flags, { notes: [] }),
      opportunities: parseJsonField<Opportunities>(data.opportunities, { notes: [] }),
      extraction_confidence: Number(data.extraction_confidence) || 0,
      source_notes_count: data.source_notes_count || 0
    };
  } catch (e) {
    console.error('[ProfileExtraction] Get error:', e);
    return null;
  }
}
