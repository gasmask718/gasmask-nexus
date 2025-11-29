import { supabase } from '@/integrations/supabase/client';

export type PrimaryRole = 'admin' | 'va' | 'driver' | 'biker' | 'ambassador' | 'wholesaler' | 'store_owner' | 'production';
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

export function getRoleRedirectPath(primaryRole: PrimaryRole): string {
  switch (primaryRole) {
    case 'admin':
    case 'va':
      return '/';
    case 'driver':
      return '/portal/driver';
    case 'biker':
      return '/portal/biker';
    case 'ambassador':
      return '/portal/ambassador';
    case 'wholesaler':
      return '/portal/wholesaler';
    case 'store_owner':
      return '/portal/store';
    case 'production':
      return '/portal/production';
    default:
      return '/portal/home';
  }
}

export function getRoleDisplayName(role: PrimaryRole): string {
  const names: Record<PrimaryRole, string> = {
    admin: 'Administrator',
    va: 'Virtual Assistant',
    driver: 'Driver',
    biker: 'Store Checker',
    ambassador: 'Ambassador',
    wholesaler: 'Wholesaler',
    store_owner: 'Store Owner',
    production: 'Production Staff'
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
    case 'driver':
      result = await supabase
        .from('driver_profiles')
        .insert({ user_id: userId, ...data })
        .select()
        .single();
      break;
    case 'biker':
      result = await supabase
        .from('biker_profiles')
        .insert({ user_id: userId, ...data })
        .select()
        .single();
      break;
    case 'ambassador':
      result = await supabase
        .from('ambassador_profiles')
        .insert({ user_id: userId, referral_code: generateReferralCode(), ...data })
        .select()
        .single();
      break;
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
    default:
      return null;
  }

  if (result?.error) throw result.error;
  return result?.data;
}

function generateReferralCode(): string {
  return 'AMB-' + Math.random().toString(36).substring(2, 8).toUpperCase();
}
