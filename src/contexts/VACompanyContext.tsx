/**
 * VACompanyContext — which of the nine VA companies the signed-in VA is
 * currently calling for.
 *
 * Source of truth: va_company_memberships (+ va_companies). A VA normally
 * sees only their member companies; a Dynasty Connect membership is the
 * switchboard and unlocks every active company.
 *
 * The selection persists in localStorage so a refresh keeps the VA on the
 * company they were working. Everything company-scoped (caller IDs, lead
 * lists, scripts) keys off `activeCompany`.
 */
import { createContext, useContext, useMemo, useState, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SWITCHBOARD_COMPANY_SLUG } from '@/config/vaCompanies';

export interface VACompany {
  id: string;
  slug: string;
  name: string;
  brand_color: string | null;
  /** Membership role when this company came from the VA's own memberships */
  role?: string;
}

interface VACompanyContextValue {
  /** Companies this VA may call for (all of them for Dynasty Connect members) */
  companies: VACompany[];
  activeCompany: VACompany | null;
  setActiveCompany: (companyId: string) => void;
  /** true when the VA holds a Dynasty Connect membership (switchboard access) */
  isSwitchboard: boolean;
  loading: boolean;
}

const VACompanyContext = createContext<VACompanyContextValue | null>(null);
const STORAGE_KEY = 'va_active_company_id';

export function VACompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const { data, isLoading } = useQuery({
    queryKey: ['va-company-context', user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [membershipsRes, companiesRes] = await Promise.all([
        (supabase as any)
          .from('va_company_memberships')
          .select('company_id, is_primary, va_companies:company_id ( id, slug, name, brand_color, is_active )')
          .eq('user_id', user!.id)
          .eq('is_active', true),
        (supabase as any)
          .from('va_companies')
          .select('id, slug, name, brand_color')
          .eq('is_active', true)
          .order('name'),
      ]);

      const memberships = (membershipsRes.data || []) as any[];
      const roleByCompany = new Map<string, string>(
        memberships.map((m) => [m.company_id as string, m.role as string]),
      );
      const memberCompanies = memberships
        .map((m) => (m.va_companies ? { ...m.va_companies, role: m.role } : null))
        .filter((c) => c && c.is_active) as VACompany[];
      const isSwitchboard = memberships.some(
        (m) => m.va_companies?.slug === SWITCHBOARD_COMPANY_SLUG,
      );
      const allCompanies = ((companiesRes.data || []) as VACompany[]).map((c) => ({
        ...c,
        role: roleByCompany.get(c.id),
      }));

      return {
        companies: isSwitchboard ? allCompanies : memberCompanies,
        isSwitchboard,
        primaryId: (memberships.find((m) => m.is_primary)?.company_id as string) ?? null,
      };
    },
  });

  const companies = data?.companies ?? [];

  const activeCompany = useMemo(() => {
    if (companies.length === 0) return null;
    const stored = activeCompanyId ? companies.find((c) => c.id === activeCompanyId) : null;
    if (stored) return stored;
    const primary = data?.primaryId ? companies.find((c) => c.id === data.primaryId) : null;
    return primary ?? companies[0];
  }, [companies, activeCompanyId, data?.primaryId]);

  const setActiveCompany = (companyId: string) => {
    setActiveCompanyId(companyId);
    try {
      localStorage.setItem(STORAGE_KEY, companyId);
    } catch {
      /* private mode — selection just won't persist */
    }
  };

  return (
    <VACompanyContext.Provider
      value={{
        companies,
        activeCompany,
        setActiveCompany,
        isSwitchboard: data?.isSwitchboard ?? false,
        loading: isLoading,
      }}
    >
      {children}
    </VACompanyContext.Provider>
  );
}

export function useVACompany() {
  const ctx = useContext(VACompanyContext);
  if (!ctx) throw new Error('useVACompany must be used within VACompanyProvider');
  return ctx;
}

/** Null-safe variant for components that may render outside the provider. */
export function useVACompanySafe() {
  return useContext(VACompanyContext);
}
