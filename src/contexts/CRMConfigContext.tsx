import { createContext, useContext, ReactNode, useMemo } from 'react';
import { useBusinessStore } from '@/stores/businessStore';
import { getCRMConfig, CRMTypeConfig } from '@/config/crmTypeConfig';

interface CRMConfigContextValue {
  config: CRMTypeConfig;
  isStoreBasedCRM: boolean;
  primaryEntityLabel: string;
}

const CRMConfigContext = createContext<CRMConfigContextValue | null>(null);

export function CRMConfigProvider({ children }: { children: ReactNode }) {
  const { selectedBusiness } = useBusinessStore();
  
  const value = useMemo(() => {
    const config = getCRMConfig(
      selectedBusiness?.slug,
      (selectedBusiness as any)?.business_model
    );
    
    return {
      config,
      isStoreBasedCRM: config.showStores && config.primaryEntity === 'store',
      primaryEntityLabel: config.entityLabels[config.primaryEntity],
    };
  }, [selectedBusiness?.slug, (selectedBusiness as any)?.business_model]);
  
  return (
    <CRMConfigContext.Provider value={value}>
      {children}
    </CRMConfigContext.Provider>
  );
}

export function useCRMConfig() {
  const context = useContext(CRMConfigContext);
  if (!context) {
    // Return default config if not wrapped in provider
    const defaultConfig = getCRMConfig();
    return {
      config: defaultConfig,
      isStoreBasedCRM: true,
      primaryEntityLabel: 'Contact',
    };
  }
  return context;
}
