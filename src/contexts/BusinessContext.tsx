import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

  const fetchBusinesses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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

      // Load saved business from localStorage or use first one
      const savedBusinessId = localStorage.getItem('currentBusinessId');
      const businessToSet = savedBusinessId 
        ? businessList.find(b => b.id === savedBusinessId) || businessList[0]
        : businessList[0];

      if (businessToSet) {
        setCurrentBusiness(businessToSet);
        localStorage.setItem('currentBusinessId', businessToSet.id);
      }
    } catch (error: any) {
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
    setLoading(true);
    await fetchBusinesses();
  };

  useEffect(() => {
    fetchBusinesses();
  }, []);

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
