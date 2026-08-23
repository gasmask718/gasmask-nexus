import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { t, detectLanguage, isRTL, SupportedLanguage, getAvailableLanguages } from '@/lib/i18n';
import { supabase } from '@/integrations/supabase/client';

const LS_KEY = 'preferred_language';

export function useTranslation() {
  const { data } = useCurrentUserProfile();
  const queryClient = useQueryClient();
  const [language, setLanguage] = useState<SupportedLanguage>(() => {
    // Instant hydration from localStorage so toggle survives reloads even
    // before the profile query resolves.
    if (typeof window !== 'undefined') {
      const cached = window.localStorage.getItem(LS_KEY) as SupportedLanguage | null;
      if (cached === 'en' || cached === 'es' || cached === 'ar' || cached === 'fr') return cached;
    }
    return 'en';
  });
  const [dialect, setDialect] = useState<string>('en_standard');

  // Priority: user profile > localStorage > browser default
  useEffect(() => {
    if (data?.profile?.preferred_language) {
      const next = data.profile.preferred_language as SupportedLanguage;
      setLanguage(next);
      try { window.localStorage.setItem(LS_KEY, next); } catch {}
    } else if (typeof window !== 'undefined' && !window.localStorage.getItem(LS_KEY)) {
      setLanguage(detectLanguage());
    }
  }, [data?.profile?.preferred_language]);

  const translate = useCallback((key: string, params?: Record<string, string | number>): string => {
    let str = t(key, language);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        // Double-brace first: replacing {k} inside {{k}} would leave stray
        // braces behind ("Welcome to {Office}").
        str = str.split(`{{${k}}}`).join(String(v)).split(`{${k}}`).join(String(v));
      }
    }
    return str;
  }, [language]);

  const changeLanguage = useCallback(async (newLang: SupportedLanguage, newDialect?: string) => {
    // 1) Flip UI instantly
    setLanguage(newLang);
    if (newDialect) setDialect(newDialect);

    // 2) Persist locally (instant on next mount)
    try { window.localStorage.setItem(LS_KEY, newLang); } catch {}

    // 3) Persist per-user in DB (best-effort — UI does not block on this)
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('user_profiles')
          .update({ preferred_language: newLang, updated_at: new Date().toISOString() })
          .eq('user_id', user.id);
        // Mirror to legacy profiles table when present (best-effort)
        await supabase
          .from('profiles')
          .update({ preferred_language: newLang })
          .eq('id', user.id);
        queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
      }
    } catch (e) {
      // Non-fatal: localStorage still holds the choice.
      console.warn('[useTranslation] failed to persist preferred_language', e);
    }
  }, [queryClient]);

  const getLanguageProfile = useCallback(async (code: string, dialectCode?: string) => {
    const query = supabase
      .from('language_profiles')
      .select('*')
      .eq('code', code);
    if (dialectCode) query.eq('dialect_code', dialectCode);
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
