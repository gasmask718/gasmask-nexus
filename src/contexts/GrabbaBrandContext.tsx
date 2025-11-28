import { createContext, useContext, useState, ReactNode } from 'react';
import { GRABBA_BRANDS, GrabbaBrand, GRABBA_BRAND_CONFIG } from '@/config/grabbaBrands';

// ═══════════════════════════════════════════════════════════════════════════════
// GRABBA BRAND CONTEXT
// Unified brand filtering across all Grabba floors
// ═══════════════════════════════════════════════════════════════════════════════

export type BrandFilterValue = GrabbaBrand | 'all';

interface GrabbaBrandContextType {
  selectedBrand: BrandFilterValue;
  setSelectedBrand: (brand: BrandFilterValue) => void;
  brandFilter: GrabbaBrand[];
  getBrandQuery: () => GrabbaBrand[];
  isBrandSelected: (brand: GrabbaBrand) => boolean;
  getBrandConfig: (brand: GrabbaBrand) => typeof GRABBA_BRAND_CONFIG[GrabbaBrand];
  allBrands: readonly GrabbaBrand[];
}

const GrabbaBrandContext = createContext<GrabbaBrandContextType | undefined>(undefined);

export function GrabbaBrandProvider({ children }: { children: ReactNode }) {
  const [selectedBrand, setSelectedBrand] = useState<BrandFilterValue>('all');

  // Returns array of brands to filter by
  const brandFilter = selectedBrand === 'all' 
    ? [...GRABBA_BRANDS] 
    : [selectedBrand];

  // For Supabase queries - returns brands to filter
  const getBrandQuery = (): GrabbaBrand[] => {
    return selectedBrand === 'all' ? [...GRABBA_BRANDS] : [selectedBrand];
  };

  const isBrandSelected = (brand: GrabbaBrand): boolean => {
    return selectedBrand === 'all' || selectedBrand === brand;
  };

  const getBrandConfigFn = (brand: GrabbaBrand) => {
    return GRABBA_BRAND_CONFIG[brand] || GRABBA_BRAND_CONFIG.gasmask;
  };

  return (
    <GrabbaBrandContext.Provider
      value={{
        selectedBrand,
        setSelectedBrand,
        brandFilter,
        getBrandQuery,
        isBrandSelected,
        getBrandConfig: getBrandConfigFn,
        allBrands: GRABBA_BRANDS,
      }}
    >
      {children}
    </GrabbaBrandContext.Provider>
  );
}

export function useGrabbaBrand() {
  const context = useContext(GrabbaBrandContext);
  if (!context) {
    throw new Error('useGrabbaBrand must be used within a GrabbaBrandProvider');
  }
  return context;
}

// Standalone hook for components that need brand filtering without full context
export function useGrabbaBrandFilter() {
  const [selectedBrand, setSelectedBrand] = useState<BrandFilterValue>('all');
  
  const brandFilter = selectedBrand === 'all' 
    ? [...GRABBA_BRANDS] 
    : [selectedBrand];

  const getBrandQuery = (): GrabbaBrand[] => {
    return selectedBrand === 'all' ? [...GRABBA_BRANDS] : [selectedBrand];
  };

  return {
    selectedBrand,
    setSelectedBrand,
    brandFilter,
    getBrandQuery,
    allBrands: GRABBA_BRANDS,
    config: GRABBA_BRAND_CONFIG,
  };
}
