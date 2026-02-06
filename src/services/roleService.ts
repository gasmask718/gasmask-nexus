import { supabase } from '@/integrations/supabase/client';
import { getRoleRedirectPath as getRedirectFromNav, type OSRole } from '@/config/osNavigation';

// Re-export types aligned with osNavigation
export type PrimaryRole = OSRole;
export type PreferredLanguage = 'en' | 'es' | 'ar' | 'fr';

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  primary_role: PrimaryRole;
  extra_roles: string[];
  preferred_language: PreferredLanguage;
  timezone: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Get redirect path based on role - delegates to centralized osNavigation config
 * Kept for backward compatibility
 */
export function getRoleRedirectPath(primaryRole: PrimaryRole | string): string {
  // Handle legacy role names
  const normalizedRole = normalizeRole(primaryRole);
  return getRedirectFromNav(normalizedRole);
}

/**
 * Normalize legacy role names to current OSRole type
 */
function normalizeRole(role: string): OSRole {
  const roleMap: Record<string, OSRole> = {
    'admin': 'admin',
    'va': 'va',
    'driver': 'driver',
    'biker': 'biker',
    'ambassador': 'ambassador',
    'wholesaler': 'wholesaler',
    'store_owner': 'store',
    'store': 'store',
    'production': 'production',
    'customer': 'customer',
    'ceo': 'ceo',
    'accountant': 'accountant',
    'csr': 'csr',
  };
  return roleMap[role] || 'customer';
}

export function getRoleDisplayName(role: PrimaryRole): string {
  const names: Partial<Record<PrimaryRole, string>> = {
    admin: 'Administrator',
    ceo: 'CEO',
    va: 'Virtual Assistant',
    driver: 'Driver',
    biker: 'Store Checker',
    ambassador: 'Ambassador',
    wholesaler: 'Wholesaler',
    store: 'Store Owner',
    store_owner: 'Store Owner',
    production: 'Production Staff',
    customer: 'Customer',
    accountant: 'Accountant',
    csr: 'Customer Service',
  };
  return names[role] || role;
}

export function getLanguageDisplayName(lang: PreferredLanguage): string {
  const names: Record<PreferredLanguage, string> = {
    en: 'English',
    es: 'Español',
    ar: 'العربية',
    fr: 'Français'
  };
  return names[lang] || lang;
}

export async function getCurrentUserProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { profile: null, roleProfile: null };

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!profile) return { profile: null, roleProfile: null };

  let roleProfile = null;
  const role = profile.primary_role as PrimaryRole;

  switch (role) {
    case 'driver':
      const { data: driverProfile } = await supabase
        .from('driver_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      roleProfile = driverProfile;
      break;
    case 'biker':
      const { data: bikerProfile } = await supabase
        .from('biker_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      roleProfile = bikerProfile;
      break;
    case 'ambassador':
      const { data: ambassadorProfile } = await supabase
        .from('ambassador_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      roleProfile = ambassadorProfile;
      break;
    case 'wholesaler':
      const { data: wholesalerProfile } = await supabase
        .from('wholesaler_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      roleProfile = wholesalerProfile;
      break;
    case 'store_owner':
      const { data: storeProfile } = await supabase
        .from('store_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      roleProfile = storeProfile;
      break;
    case 'production':
      const { data: productionProfile } = await supabase
        .from('production_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      roleProfile = productionProfile;
      break;
    case 'va':
      const { data: vaProfile } = await supabase
        .from('va_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      roleProfile = vaProfile;
      break;
    case 'customer':
      const { data: customerProfile } = await supabase
        .from('customer_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      roleProfile = customerProfile;
      break;
  }

  return { profile: profile as UserProfile, roleProfile };
}

export async function createUserProfile(
  userId: string,
  data: {
    full_name?: string;
    phone?: string;
    primary_role: PrimaryRole;
    preferred_language?: PreferredLanguage;
  }
) {
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .insert({
      user_id: userId,
      full_name: data.full_name,
      phone: data.phone,
      primary_role: data.primary_role,
      preferred_language: data.preferred_language || 'en'
    })
    .select()
    .single();

  if (error) throw error;
  return profile;
}

export async function createRoleProfile(
  userId: string,
  role: PrimaryRole,
  data: Record<string, any>
) {
  let result;
  
  switch (role) {
    case 'driver': {
      result = await supabase
        .from('driver_profiles')
        .insert({ user_id: userId, ...data })
        .select()
        .single();
      
      // Link to operational drivers table
      await linkOperationalRecord('drivers', userId, data);
      break;
    }
    case 'biker': {
      result = await supabase
        .from('biker_profiles')
        .insert({ user_id: userId, ...data })
        .select()
        .single();
      
      // Link to operational bikers table
      await linkOperationalRecord('bikers', userId, data);
      break;
    }
    case 'ambassador': {
      const referralCode = generateReferralCode();
      const trackingCode = 'AMB-' + Math.random().toString(36).substring(2, 10).toUpperCase();
      
      // Create row in ambassador_profiles (legacy/secondary)
      result = await supabase
        .from('ambassador_profiles')
        .insert({ user_id: userId, referral_code: referralCode, ...data })
        .select()
        .single();
      
      // CRITICAL: Also create row in ambassadors table (operational/primary)
      // This is required for lead conversion, store assignments, and all ambassador operations
      const { error: ambassadorError } = await supabase
        .from('ambassadors')
        .insert({ 
          user_id: userId, 
          tracking_code: trackingCode,
          referral_code: referralCode,
          is_active: true,
          tier: 'starter',
          total_earnings: 0,
          name: data.name || null,
          state: data.state || null
        });
      
      if (ambassadorError) {
        console.error('Failed to create ambassadors record:', ambassadorError);
        // Don't throw - the profile was created, we can recover
      }
      break;
    }
    case 'wholesaler':
      result = await supabase
        .from('wholesaler_profiles' as any)
        .insert({ user_id: userId, ...data })
        .select()
        .single();
      break;
    case 'store_owner':
      result = await supabase
        .from('store_profiles' as any)
        .insert({ user_id: userId, ...data })
        .select()
        .single();
      break;
    case 'production':
      result = await supabase
        .from('production_profiles' as any)
        .insert({ user_id: userId, ...data })
        .select()
        .single();
      break;
    case 'va':
      result = await supabase
        .from('va_profiles')
        .insert({ user_id: userId, ...data })
        .select()
        .single();
      break;
    case 'customer':
      result = await supabase
        .from('customer_profiles')
        .insert({ user_id: userId, ...data })
        .select()
        .single();
      break;
    default:
      return null;
  }

  if (result?.error) throw result.error;
  return result?.data;
}

function generateReferralCode(): string {
  return 'AMB-' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * Link auth user to an existing operational record (bikers/drivers) by email/phone match,
 * or create a new operational record if no match found.
 */
async function linkOperationalRecord(
  table: 'bikers' | 'drivers',
  userId: string,
  data: Record<string, any>
) {
  try {
    // Get user email from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, name')
      .eq('id', userId)
      .single();

    const email = profile?.email || data.email;
    const name = profile?.name || data.name;

    // Try to find existing record by email match
    if (email) {
      const { data: existing } = await supabase
        .from(table)
        .select('id, user_id')
        .eq('email', email)
        .is('user_id', null)
        .limit(1);

      if (existing && existing.length > 0) {
        // Link existing record to this auth user
        await supabase
          .from(table)
          .update({ user_id: userId })
          .eq('id', existing[0].id);
        
        // Also update the profile name to match the operational record name
        const { data: opRecord } = await supabase
          .from(table)
          .select('full_name')
          .eq('id', existing[0].id)
          .single();
        
        if (opRecord?.full_name && profile?.name === 'New User') {
          await supabase
            .from('profiles')
            .update({ name: opRecord.full_name })
            .eq('id', userId);
        }
        
        console.log(`Linked ${table} record ${existing[0].id} to user ${userId}`);
        return;
      }
    }

    // No existing record found — create new operational record
    const defaultBusinessId = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
    
    await supabase
      .from(table)
      .insert({
        user_id: userId,
        full_name: name || 'New User',
        email: email || null,
        phone: data.phone || null,
        business_id: data.business_id || defaultBusinessId,
        status: 'active',
      });

    console.log(`Created new ${table} record for user ${userId}`);
  } catch (error) {
    console.error(`Failed to link/create ${table} record:`, error);
    // Don't throw — the profile was created, this is a safety net
  }
}

/**
 * Auto-heal: ensure biker/driver has linked operational record.
 * Call this on portal login to fix any unlinked records.
 */
export async function ensureBikerRecord(userId: string): Promise<void> {
  try {
    // Check if already linked
    const { data: existing } = await supabase
      .from('bikers')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (existing && existing.length > 0) return; // Already linked

    // Not linked — try to link or create
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, name')
      .eq('id', userId)
      .single();

    await linkOperationalRecord('bikers', userId, {
      email: profile?.email,
      name: profile?.name,
    });
  } catch (error) {
    console.error('ensureBikerRecord failed:', error);
  }
}

/**
 * Auto-heal: ensure driver has linked operational record.
 */
export async function ensureDriverRecord(userId: string): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from('drivers')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (existing && existing.length > 0) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('email, name')
      .eq('id', userId)
      .single();

    await linkOperationalRecord('drivers', userId, {
      email: profile?.email,
      name: profile?.name,
    });
  } catch (error) {
    console.error('ensureDriverRecord failed:', error);
  }
}
