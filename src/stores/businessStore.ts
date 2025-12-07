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
        // Auto-select first business if none selected and businesses exist
        if (!selectedBusiness && businesses.length > 0) {
          set({ selectedBusiness: businesses[0] });
        }
        // Also verify current selection still exists in list
        if (selectedBusiness && businesses.length > 0) {
          const stillExists = businesses.find(b => b.id === selectedBusiness.id);
          if (!stillExists) {
            set({ selectedBusiness: businesses[0] });
          }
        }
      },

      fetchBusinesses: async () => {
        const { initialized, loading } = get();
        
        // Prevent duplicate fetches
        if (initialized && !loading) {
          get().ensureBusinessSelected();
          return;
        }
        
        set({ loading: true });
        try {
          // Fetch all active businesses directly - no user membership required
          const { data, error } = await supabase
            .from('businesses')
            .select('*')
            .eq('is_active', true)
            .order('name');

          if (error) throw error;

          const businessList = (data || []).map((b: any) => ({
            id: b.id,
            name: b.name,
            slug: b.slug,
            logo_url: b.logo_url,
            member_role: 'member',
            subscription_tier: b.subscription_tier || 'free',
            theme_config: b.theme_config || {},
            settings: b.settings || {}
          })) as Business[];

          set({ businesses: businessList });

          // Auto-select business immediately after fetching
          const { selectedBusiness } = get();
          if (businessList.length > 0) {
            if (!selectedBusiness) {
              // No business selected, pick first one
              set({ selectedBusiness: businessList[0] });
            } else {
              // Verify selected business still exists
              const stillExists = businessList.find(b => b.id === selectedBusiness.id);
              if (!stillExists) {
                set({ selectedBusiness: businessList[0] });
              }
            }
          }
        } catch (error) {
          console.error('Error fetching businesses:', error);
          // Even on error, set empty list and stop loading
          set({ businesses: [] });
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
