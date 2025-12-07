import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/integrations/supabase/client';

export interface Business {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  member_role: string;
  subscription_tier: string;
  theme_config: any;
  settings: any;
}

interface BusinessState {
  businesses: Business[];
  selectedBusiness: Business | null;
  loading: boolean;
  initialized: boolean;
  
  // Actions
  setBusinesses: (businesses: Business[]) => void;
  setSelectedBusiness: (business: Business | null) => void;
  switchBusiness: (businessId: string) => void;
  fetchBusinesses: () => Promise<void>;
  ensureBusinessSelected: () => void;
}

export const useBusinessStore = create<BusinessState>()(
  persist(
    (set, get) => ({
      businesses: [],
      selectedBusiness: null,
      loading: true,
      initialized: false,

      setBusinesses: (businesses) => set({ businesses }),
      
      setSelectedBusiness: (business) => set({ selectedBusiness: business }),
      
      switchBusiness: (businessId) => {
        const { businesses } = get();
        const business = businesses.find(b => b.id === businessId);
        if (business) {
          set({ selectedBusiness: business });
        }
      },

      ensureBusinessSelected: () => {
        const { businesses, selectedBusiness } = get();
        if (!selectedBusiness && businesses.length > 0) {
          set({ selectedBusiness: businesses[0] });
        }
      },

      fetchBusinesses: async () => {
        set({ loading: true });
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            set({ loading: false, initialized: true });
            return;
          }

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

          set({ businesses: businessList });

          // Auto-select first business if none selected
          const { selectedBusiness } = get();
          if (!selectedBusiness && businessList.length > 0) {
            // Check if previously selected business still exists
            const savedId = localStorage.getItem('selectedBusinessId');
            const savedBusiness = savedId ? businessList.find(b => b.id === savedId) : null;
            set({ selectedBusiness: savedBusiness || businessList[0] });
          }
        } catch (error) {
          console.error('Error fetching businesses:', error);
        } finally {
          set({ loading: false, initialized: true });
        }
      },
    }),
    {
      name: 'business-store',
      partialize: (state) => ({ 
        selectedBusiness: state.selectedBusiness 
      }),
    }
  )
);
