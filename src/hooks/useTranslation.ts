import { useState, useEffect, useCallback } from 'react';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { t, detectLanguage, isRTL, SupportedLanguage, getAvailableLanguages } from '@/lib/i18n';
import { supabase } from '@/integrations/supabase/client';

export function useTranslation() {
  const { data } = useCurrentUserProfile();
  const [language, setLanguage] = useState<SupportedLanguage>('en');
  const [dialect, setDialect] = useState<string>('en_standard');
  
  useEffect(() => {
    // Priority: user profile > browser > fallback
    if (data?.profile?.preferred_language) {
      setLanguage(data.profile.preferred_language as SupportedLanguage);
    } else {
      setLanguage(detectLanguage());
    }
  }, [data?.profile?.preferred_language]);
  
  const translate = useCallback((key: string): string => {
    return t(key, language);
  }, [language]);
  
  const changeLanguage = useCallback((newLang: SupportedLanguage, newDialect?: string) => {
    setLanguage(newLang);
    if (newDialect) {
      setDialect(newDialect);
    }
    // Could also persist to user profile here
  }, []);

  // Get language profile from DB
  const getLanguageProfile = useCallback(async (code: string, dialectCode?: string) => {
    const query = supabase
      .from('language_profiles')
      .select('*')
      .eq('code', code);
    
    if (dialectCode) {
      query.eq('dialect_code', dialectCode);
    }
    
    const { data } = await query.limit(1).single();
    return data;
  }, []);
  
  return {
    t: translate,
    language,
    dialect,
    setLanguage: changeLanguage,
    isRTL: isRTL(language),
    availableLanguages: getAvailableLanguages(),
    getLanguageProfile,
  };
}
