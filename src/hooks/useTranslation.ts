import { useState, useEffect, useCallback } from 'react';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { t, detectLanguage, isRTL, SupportedLanguage, getAvailableLanguages } from '@/lib/i18n';

export function useTranslation() {
  const { data } = useCurrentUserProfile();
  const [language, setLanguage] = useState<SupportedLanguage>('en');
  
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
  
  const changeLanguage = useCallback((newLang: SupportedLanguage) => {
    setLanguage(newLang);
    // Could also persist to user profile here
  }, []);
  
  return {
    t: translate,
    language,
    setLanguage: changeLanguage,
    isRTL: isRTL(language),
    availableLanguages: getAvailableLanguages(),
  };
}
