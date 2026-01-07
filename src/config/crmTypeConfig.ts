// CRM Type Configuration
// Defines how each business type should behave in the CRM

export type CRMBusinessType = 
  | 'store_based'      // Traditional store-focused CRM (Grabba, GasMask, etc.)
  | 'service_based'    // Service companies without stores
  | 'funding'          // Funding/financial companies
  | 'entertainment'    // Entertainment/events businesses
  | 'general';         // Default fallback

export interface CRMTypeConfig {
  type: CRMBusinessType;
  label: string;
  description: string;
  
  // Entity visibility
  showStores: boolean;
  showCompanies: boolean;
  showContacts: boolean;
  showDeals: boolean;
  showInvoices: boolean;
  showInventory: boolean;
  showRoutes: boolean;
  showAmbassadors: boolean;
  
  // Primary entity (what the CRM focuses on)
  primaryEntity: 'store' | 'company' | 'contact' | 'deal';
  
  // Navigation labels
  entityLabels: {
    store: string;
    company: string;
    contact: string;
    deal: string;
  };
  
  // Contact structure
  contactTypes: string[];
  
  // Media/notes features
  showMediaGallery: boolean;
  showVoiceNotes: boolean;
  showNotes: boolean;
  showInteractions: boolean;
}

// Pre-configured business types
export const CRM_TYPE_CONFIGS: Record<string, CRMTypeConfig> = {
  // TOPTIER - Partner/Customer/Influencer based promotional services (NO STORES)
  'toptier': {
    type: 'service_based',
    label: 'TOPTIER',
    description: 'Partner and influencer-based promotional services CRM',
    showStores: false,
    showCompanies: true,
    showContacts: true,
    showDeals: true,
    showInvoices: true,
    showInventory: false,
    showRoutes: false,
    showAmbassadors: true,
    primaryEntity: 'contact',
    entityLabels: {
      store: 'Partner',
      company: 'Partner Company',
      contact: 'Customer/Influencer',
      deal: 'Booking/Promo',
    },
    contactTypes: ['partner', 'customer', 'influencer', 'vendor'],
    showMediaGallery: true,
    showVoiceNotes: true,
    showNotes: true,
    showInteractions: true,
  },
  
  // Funding Company - Deal/lead focused CRM without stores
  'funding': {
    type: 'funding',
    label: 'Funding Company',
    description: 'Financial services CRM',
    showStores: false,
    showCompanies: true,
    showContacts: true,
    showDeals: true,
    showInvoices: true,
    showInventory: false,
    showRoutes: false,
    showAmbassadors: false,
    primaryEntity: 'deal',
    entityLabels: {
      store: 'Client',
      company: 'Company',
      contact: 'Lead',
      deal: 'Funding Deal',
    },
    contactTypes: ['owner', 'applicant', 'referral', 'broker'],
    showMediaGallery: true,
    showVoiceNotes: true,
    showNotes: true,
    showInteractions: true,
  },
  
  // Unforgettable Times - Event/entertainment CRM
  'unforgettable_times': {
    type: 'entertainment',
    label: 'Unforgettable Times',
    description: 'Events and entertainment CRM',
    showStores: false,
    showCompanies: true,
    showContacts: true,
    showDeals: true,
    showInvoices: true,
    showInventory: false,
    showRoutes: false,
    showAmbassadors: true,
    primaryEntity: 'contact',
    entityLabels: {
      store: 'Venue',
      company: 'Venue/Partner',
      contact: 'Client',
      deal: 'Event Booking',
    },
    contactTypes: ['client', 'host', 'vendor', 'promoter', 'talent'],
    showMediaGallery: true,
    showVoiceNotes: true,
    showNotes: true,
    showInteractions: true,
  },
  
  // The Playboxx - Model/content company CRM (NO STORES)
  'playboxx': {
    type: 'entertainment',
    label: 'The Playboxx',
    description: 'Model and content company CRM with models, influencers, and subscribers',
    showStores: false,
    showCompanies: true,
    showContacts: true,
    showDeals: true,
    showInvoices: true,
    showInventory: false,
    showRoutes: false,
    showAmbassadors: true,
    primaryEntity: 'contact',
    entityLabels: {
      store: 'Location',
      company: 'Supplier/Partner',
      contact: 'Model/Influencer/Subscriber',
      deal: 'Collab/Booking',
    },
    contactTypes: ['model', 'influencer', 'subscriber', 'ambassador', 'cameraman', 'hair_nails_makeup', 'supplier'],
    showMediaGallery: true,
    showVoiceNotes: true,
    showNotes: true,
    showInteractions: true,
  },
  
  // Alias for the-playboxxx slug
  'the_playboxxx': {
    type: 'entertainment',
    label: 'The Playboxx',
    description: 'Model and content company CRM with models, influencers, and subscribers',
    showStores: false,
    showCompanies: true,
    showContacts: true,
    showDeals: true,
    showInvoices: true,
    showInventory: false,
    showRoutes: false,
    showAmbassadors: true,
    primaryEntity: 'contact',
    entityLabels: {
      store: 'Location',
      company: 'Supplier/Partner',
      contact: 'Model/Influencer/Subscriber',
      deal: 'Collab/Booking',
    },
    contactTypes: ['model', 'influencer', 'subscriber', 'ambassador', 'cameraman', 'hair_nails_makeup', 'supplier'],
    showMediaGallery: true,
    showVoiceNotes: true,
    showNotes: true,
    showInteractions: true,
  },
  
  // Default/General CRM
  'default': {
    type: 'general',
    label: 'General CRM',
    description: 'General purpose CRM',
    showStores: true,
    showCompanies: true,
    showContacts: true,
    showDeals: true,
    showInvoices: true,
    showInventory: true,
    showRoutes: true,
    showAmbassadors: true,
    primaryEntity: 'contact',
    entityLabels: {
      store: 'Location',
      company: 'Company',
      contact: 'Contact',
      deal: 'Deal',
    },
    contactTypes: ['lead', 'client', 'partner', 'vendor'],
    showMediaGallery: true,
    showVoiceNotes: true,
    showNotes: true,
    showInteractions: true,
  },
};

// Helper to get config for a business
export function getCRMConfig(businessSlug?: string | null, businessModel?: string | null): CRMTypeConfig {
  if (businessSlug) {
    const slug = businessSlug.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
    // Handle specific slug variations
    if (slug === 'the_playboxxx' || slug === 'playboxxx') {
      return CRM_TYPE_CONFIGS['the_playboxxx'] || CRM_TYPE_CONFIGS['playboxx'];
    }
    if (CRM_TYPE_CONFIGS[slug]) {
      return CRM_TYPE_CONFIGS[slug];
    }
  }
  
  if (businessModel) {
    const model = businessModel.toLowerCase();
    if (model.includes('funding') || model.includes('finance')) {
      return CRM_TYPE_CONFIGS['funding'];
    }
    if (model.includes('event') || model.includes('entertainment')) {
      return CRM_TYPE_CONFIGS['unforgettable_times'];
    }
    if (model.includes('playboxx') || model.includes('model') || model.includes('content')) {
      return CRM_TYPE_CONFIGS['the_playboxxx'] || CRM_TYPE_CONFIGS['playboxx'];
    }
    // TOPTIER is now service-based, not store-based
    if (model.includes('toptier') || model.includes('promo') || model.includes('partner')) {
      return CRM_TYPE_CONFIGS['toptier'];
    }
  }
  
  return CRM_TYPE_CONFIGS['default'];
}

// Check if a business requires stores
export function requiresStores(config: CRMTypeConfig): boolean {
  return config.showStores && config.primaryEntity === 'store';
}
