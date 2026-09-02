import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface Business {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  member_role: string;
  subscription_tier: string;
  theme_config: any;
  settings: any;
}

interface BusinessContextType {
  currentBusiness: Business | null;
  businesses: Business[];
  loading: boolean;
  switchBusiness: (businessId: string) => void;
  refreshBusinesses: () => Promise<void>;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export function BusinessProvider({ children }: { children: ReactNode }) {
  const [currentBusiness, setCurrentBusiness] = useState<Business | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const fetchBusinesses = async () => {
    try {
      if (!user) {
        setCurrentBusiness(null);
        setBusinesses([]);
        setLoading(false);
        return;
      }

      // Never blank out an already-resolved business while refetching —
      // guards read currentBusiness and would redirect on a transient null.

      const { data, error } = await supabase
        .rpc('get_user_businesses', { user_id: user.id });

      if (error) throw error;

      const businessList = (data || []).map((b: any) => ({
        id: b.business_id,
        name: b.business_name,
        slug: b.business_slug,
        logo_url: b.logo_url,
        member_role: b.member_role,
        subscription_tier: 'free',
        theme_config: {},
        settings: {}
      })) as Business[];
      setBusinesses(businessList);

      // Keep the business the user is already working in if it is still valid.
      // Otherwise fall back to the persisted selection, then the first business.
      const savedBusinessId = localStorage.getItem('currentBusinessId');
      const stillValid = currentBusiness
        ? businessList.find(b => b.id === currentBusiness.id)
        : undefined;
      const businessToSet =
        stillValid ||
        (savedBusinessId ? businessList.find(b => b.id === savedBusinessId) : undefined) ||
        businessList[0];

      if (businessToSet) {
        setCurrentBusiness(businessToSet);
        localStorage.setItem('currentBusinessId', businessToSet.id);
      }
    } catch (error: any) {
      // Transient fetch failure: keep the previously resolved context rather
      // than dropping the user out of their business.
      toast({
        title: 'Error loading businesses',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const switchBusiness = (businessId: string) => {
    const business = businesses.find(b => b.id === businessId);
    if (business) {
      setCurrentBusiness(business);
      localStorage.setItem('currentBusinessId', businessId);
      toast({
        title: 'Business switched',
        description: `Now viewing ${business.name}`
      });
    }
  };

  const refreshBusinesses = async () => {
    // Do NOT flip `loading` back on here — guards treat that as "unresolved"
    // and would blank/redirect the page during a background refresh.
    await fetchBusinesses();
  };

  useEffect(() => {
    if (authLoading) return;
    fetchBusinesses();
  }, [authLoading, user?.id]);

  return (
    <BusinessContext.Provider value={{
      currentBusiness,
      businesses,
      loading,
      switchBusiness,
      refreshBusinesses
    }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const context = useContext(BusinessContext);
  if (context === undefined) {
    throw new Error('useBusiness must be used within a BusinessProvider');
  }
  return context;
}
