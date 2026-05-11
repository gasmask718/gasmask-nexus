import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import vaEn from '@/i18n/va-en.json';
import vaEs from '@/i18n/va-es.json';

type VALanguage = 'en' | 'es';

interface VASessionState {
  language: VALanguage;
  twilioNumberId: string | null;
  twilioNumber: string | null;
  sessionId: string | null;
  isOnboarded: boolean;
}

interface VASessionContextType extends VASessionState {
  t: (key: string) => string;
  setLanguage: (lang: VALanguage) => void;
  startSession: (numberId: string, numberPhone: string, lang: VALanguage) => Promise<void>;
  switchNumber: (numberId: string, numberPhone: string) => Promise<void>;
  endSession: () => Promise<void>;
}

const translations: Record<VALanguage, Record<string, string>> = { en: vaEn, es: vaEs };

const VASessionContext = createContext<VASessionContextType | undefined>(undefined);

export function VASessionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<VASessionState>({
    language: 'en',
    twilioNumberId: null,
    twilioNumber: null,
    sessionId: null,
    isOnboarded: false,
  });

  const t = useCallback((key: string): string => {
    return translations[state.language]?.[key] || translations.en[key] || key;
  }, [state.language]);

  const setLanguage = useCallback((lang: VALanguage) => {
    setState(prev => ({ ...prev, language: lang }));
  }, []);

  const startSession = useCallback(async (numberId: string, numberPhone: string, lang: VALanguage) => {
    if (!user) return;

    // Note: dc_phone_numbers does not track in_use; "currently active" is
    // derived from va_sessions.is_active in the brandaro_number_last_sessions view.


    // Create session record
    const { data } = await (supabase as any)
      .from('va_sessions')
      .insert({
        va_id: user.id,
        twilio_number_id: numberId,
        language: lang,
        is_active: true,
      })
      .select('id')
      .single();

    setState({
      language: lang,
      twilioNumberId: numberId,
      twilioNumber: numberPhone,
      sessionId: data?.id || null,
      isOnboarded: true,
    });
  }, [user]);

  // Swap the active caller-ID number mid-session without ending it.
  // Releases the previously held number, locks the new one, and updates the
  // active va_sessions row so server-side dialers see the new caller-ID.
  const switchNumber = useCallback(async (numberId: string, numberPhone: string) => {
    if (!user) return;
    const prevId = state.twilioNumberId;
    if (prevId === numberId) return;

    // End any prior active session for this VA so the audit view reflects the swap.
    if (state.sessionId) {
      try {
        await (supabase as any)
          .from('va_sessions')
          .update({ is_active: false, ended_at: new Date().toISOString() })
          .eq('id', state.sessionId);
      } catch (_) { /* best effort */ }
    }

    // Open a fresh session record on the new caller-ID so "Currently Active"
    // and "Last user" both attribute correctly in the audit log.
    let newSessionId: string | null = null;
    try {
      const { data } = await (supabase as any)
        .from('va_sessions')
        .insert({
          va_id: user.id,
          twilio_number_id: numberId,
          language: state.language,
          is_active: true,
        })
        .select('id')
        .single();
      newSessionId = data?.id ?? null;
    } catch (_) { /* best effort */ }

    if (state.sessionId) {
      try {
        await (supabase as any)
          .from('va_sessions')
          .update({ twilio_number_id: numberId })
          .eq('id', state.sessionId);
      } catch (_) { /* best effort */ }
    }

    setState(prev => ({
      ...prev,
      twilioNumberId: numberId,
      twilioNumber: numberPhone,
    }));
  }, [user, state.twilioNumberId, state.sessionId]);

  const endSession = useCallback(async () => {
    const numberId = state.twilioNumberId;
    const sessId = state.sessionId;

    // Clear state immediately so UI updates fast
    setState({
      language: 'en',
      twilioNumberId: null,
      twilioNumber: null,
      sessionId: null,
      isOnboarded: false,
    });

    // Release number
    if (numberId) {
      await (supabase as any)
        .from('brandaro_phone_numbers')
        .update({ in_use: false, assigned_va_id: null })
        .eq('id', numberId);
    }

    // End session record
    if (sessId) {
      await (supabase as any)
        .from('va_sessions')
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq('id', sessId);
    }
  }, [state.twilioNumberId, state.sessionId]);

  // Cleanup on unmount / page close — use fetch with keepalive (sendBeacon alternative that supports headers)
  useEffect(() => {
    const cleanup = () => {
      if (state.twilioNumberId) {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/brandaro_phone_numbers?id=eq.${state.twilioNumberId}`;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        try {
          fetch(url, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'apikey': anonKey,
              'Authorization': `Bearer ${anonKey}`,
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify({ in_use: false, assigned_va_id: null }),
            keepalive: true,
          });
        } catch (_) { /* best effort */ }
      }
      if (state.sessionId) {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/va_sessions?id=eq.${state.sessionId}`;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        try {
          fetch(url, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'apikey': anonKey,
              'Authorization': `Bearer ${anonKey}`,
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify({ is_active: false, ended_at: new Date().toISOString() }),
            keepalive: true,
          });
        } catch (_) { /* best effort */ }
      }
    };
    window.addEventListener('beforeunload', cleanup);
    return () => window.removeEventListener('beforeunload', cleanup);
  }, [state.twilioNumberId, state.sessionId]);

  return (
    <VASessionContext.Provider value={{ ...state, t, setLanguage, startSession, switchNumber, endSession }}>
      {children}
    </VASessionContext.Provider>
  );
}

export function useVASession() {
  const ctx = useContext(VASessionContext);
  if (!ctx) throw new Error('useVASession must be used inside VASessionProvider');
  return ctx;
}
