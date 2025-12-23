// CRM Category System
// Dynamic category-based CRM layouts for all business types

export type CRMCategorySlug = 
  // Promotional Services
  | 'toptier_promo'
  | 'car_decor_promo'
  | 'room_decor_promo'
  | 'restaurant_decor'
  | 'club_lounge_packages'
  // Transportation & Luxury
  | 'exotic_rentals'
  | 'black_trucks'
  | 'sprinter_vans'
  | 'party_bus'
  | 'helicopter'
  | 'yachts'
  | 'jetskis'
  // Hospitality & Spaces
  | 'hotel_rooms'
  | 'mansions_homes'
  | 'event_spaces'
  // Media & Entertainment
  | 'photography'
  | 'videography'
  // Affiliate-Based
  | 'amusement_parks'
  | 'affiliate_general'
  // Legacy/Distribution
  | 'store_distribution'
  | 'funding'
  | 'acquisition'
  // Default
  | 'general';

export type EntityType = 
  | 'partner' 
  | 'influencer' 
  | 'customer' 
  | 'vehicle' 
  | 'property' 
  | 'asset'
  | 'booking'
  | 'service'
  | 'affiliate_link'
  | 'store'
  | 'contact'
  | 'deal'
  | 'lead';

export type FieldType = 
  | 'text' 
  | 'textarea' 
  | 'number' 
  | 'currency' 
  | 'date' 
  | 'datetime'
  | 'select' 
  | 'multiselect' 
  | 'phone' 
  | 'email' 
  | 'url'
  | 'address'
  | 'boolean'
  | 'file'
  | 'image'
  | 'percentage';

export interface CRMField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  section?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  defaultValue?: any;
  helpText?: string;
  width?: 'full' | 'half' | 'third';
}

export interface CRMSection {
  key: string;
  label: string;
  icon: string;
  order: number;
  enabled: boolean;
  collapsible?: boolean;
  fields: CRMField[];
}

export interface CRMEntityConfig {
  key: EntityType;
  label: string;
  labelPlural: string;
  icon: string;
  color: string;
  sections: CRMSection[];
  listColumns: string[];
  searchableFields: string[];
}

export interface CRMCategoryConfig {
  slug: CRMCategorySlug;
  name: string;
  description: string;
  icon: string;
  color: string;
  
  // Primary focus of this CRM type
  primaryEntity: EntityType;
  
  // Enabled entities for this category
  entities: CRMEntityConfig[];
  
  // Feature flags
  features: {
    showStores: boolean;
    showInventory: boolean;
    showRoutes: boolean;
    showAmbassadors: boolean;
    showAffiliates: boolean;
    showBookings: boolean;
    showVehicles: boolean;
    showProperties: boolean;
    showCommissions: boolean;
    showCalendar: boolean;
  };
  
  // Shared components always visible
  sharedComponents: {
    contacts: boolean;
    notes: boolean;
    timeline: boolean;
    followUps: boolean;
    media: boolean;
    voiceNotes: boolean;
  };
  
  // Tab configuration
  tabs: {
    key: string;
    label: string;
    icon: string;
    entity?: EntityType;
    enabled: boolean;
  }[];
}

// ============================================
// CATEGORY CONFIGURATIONS
// ============================================

// Shared field definitions for reuse
const CONTACT_FIELDS: CRMField[] = [
  { key: 'name', label: 'Full Name', type: 'text', required: true, width: 'half' },
  { key: 'phone', label: 'Phone', type: 'phone', required: true, width: 'half' },
  { key: 'email', label: 'Email', type: 'email', width: 'half' },
  { key: 'role', label: 'Role', type: 'select', width: 'half', options: [
    { value: 'owner', label: 'Owner' },
    { value: 'manager', label: 'Manager' },
    { value: 'staff', label: 'Staff' },
    { value: 'contact', label: 'Contact' },
  ]},
];

const ADDRESS_FIELDS: CRMField[] = [
  { key: 'address', label: 'Address', type: 'address', width: 'full' },
  { key: 'city', label: 'City', type: 'text', width: 'third' },
  { key: 'state', label: 'State', type: 'text', width: 'third' },
  { key: 'zip', label: 'ZIP', type: 'text', width: 'third' },
];

const PRICING_FIELDS: CRMField[] = [
  { key: 'base_price', label: 'Base Price', type: 'currency', width: 'half' },
  { key: 'deposit_required', label: 'Deposit Required', type: 'currency', width: 'half' },
  { key: 'pricing_notes', label: 'Pricing Notes', type: 'textarea', width: 'full' },
];

// ============================================
// TOPTIER PROMO - Partner/Influencer Based
// ============================================
export const TOPTIER_PROMO_CONFIG: CRMCategoryConfig = {
  slug: 'toptier_promo',
  name: 'TOPTIER PROMO',
  description: 'Partner and influencer-based promotional services',
  icon: 'Sparkles',
  color: '#f59e0b',
  primaryEntity: 'partner',
  
  features: {
    showStores: false,
    showInventory: false,
    showRoutes: false,
    showAmbassadors: true,
    showAffiliates: true,
    showBookings: true,
    showVehicles: false,
    showProperties: false,
    showCommissions: true,
    showCalendar: true,
  },
  
  sharedComponents: {
    contacts: true,
    notes: true,
    timeline: true,
    followUps: true,
    media: true,
    voiceNotes: true,
  },
  
  entities: [
    {
      key: 'partner',
      label: 'Partner',
      labelPlural: 'Partners',
      icon: 'Users',
      color: '#f59e0b',
      listColumns: ['name', 'state', 'category', 'status', 'commission_rate'],
      searchableFields: ['name', 'company', 'state', 'category'],
      sections: [
        {
          key: 'basic_info',
          label: 'Partner Information',
          icon: 'User',
          order: 1,
          enabled: true,
          fields: [
            { key: 'company_name', label: 'Company/Partner Name', type: 'text', required: true, width: 'half' },
            { key: 'contact_name', label: 'Contact Person', type: 'text', width: 'half' },
            { key: 'phone', label: 'Phone', type: 'phone', required: true, width: 'half' },
            { key: 'email', label: 'Email', type: 'email', width: 'half' },
            { key: 'website', label: 'Website', type: 'url', width: 'full' },
          ]
        },
        {
          key: 'coverage',
          label: 'State & Category Coverage',
          icon: 'MapPin',
          order: 2,
          enabled: true,
          fields: [
            { key: 'states_covered', label: 'States Covered', type: 'multiselect', width: 'full', options: [
              { value: 'NY', label: 'New York' },
              { value: 'NJ', label: 'New Jersey' },
              { value: 'CT', label: 'Connecticut' },
              { value: 'PA', label: 'Pennsylvania' },
              { value: 'FL', label: 'Florida' },
              { value: 'CA', label: 'California' },
              { value: 'TX', label: 'Texas' },
              { value: 'GA', label: 'Georgia' },
            ]},
            { key: 'categories', label: 'Service Categories', type: 'multiselect', width: 'full', options: [
              { value: 'car_decor', label: 'Car Decor' },
              { value: 'room_decor', label: 'Room Decor' },
              { value: 'restaurant', label: 'Restaurant Decor' },
              { value: 'club_lounge', label: 'Club/Lounge Packages' },
              { value: 'transportation', label: 'Transportation' },
              { value: 'photography', label: 'Photography/Videography' },
            ]},
          ]
        },
        {
          key: 'commission',
          label: 'Commission & Payments',
          icon: 'DollarSign',
          order: 3,
          enabled: true,
          fields: [
            { key: 'commission_rate', label: 'Commission Rate (%)', type: 'percentage', width: 'half' },
            { key: 'payment_method', label: 'Payment Method', type: 'select', width: 'half', options: [
              { value: 'bank_transfer', label: 'Bank Transfer' },
              { value: 'check', label: 'Check' },
              { value: 'paypal', label: 'PayPal' },
              { value: 'zelle', label: 'Zelle' },
              { value: 'cash', label: 'Cash' },
            ]},
            { key: 'total_earnings', label: 'Total Earnings', type: 'currency', width: 'half' },
            { key: 'pending_payout', label: 'Pending Payout', type: 'currency', width: 'half' },
          ]
        },
      ],
    },
    {
      key: 'influencer',
      label: 'Influencer',
      labelPlural: 'Influencers',
      icon: 'Star',
      color: '#ec4899',
      listColumns: ['name', 'platform', 'followers', 'commission_rate', 'status'],
      searchableFields: ['name', 'handle', 'platform'],
      sections: [
        {
          key: 'basic_info',
          label: 'Influencer Profile',
          icon: 'User',
          order: 1,
          enabled: true,
          fields: [
            { key: 'name', label: 'Name', type: 'text', required: true, width: 'half' },
            { key: 'handle', label: 'Handle/Username', type: 'text', width: 'half' },
            { key: 'phone', label: 'Phone', type: 'phone', width: 'half' },
            { key: 'email', label: 'Email', type: 'email', width: 'half' },
          ]
        },
        {
          key: 'social_reach',
          label: 'Social Reach',
          icon: 'TrendingUp',
          order: 2,
          enabled: true,
          fields: [
            { key: 'platform', label: 'Primary Platform', type: 'select', width: 'half', options: [
              { value: 'instagram', label: 'Instagram' },
              { value: 'tiktok', label: 'TikTok' },
              { value: 'youtube', label: 'YouTube' },
              { value: 'twitter', label: 'Twitter/X' },
              { value: 'facebook', label: 'Facebook' },
            ]},
            { key: 'followers', label: 'Follower Count', type: 'number', width: 'half' },
            { key: 'engagement_rate', label: 'Engagement Rate (%)', type: 'percentage', width: 'half' },
            { key: 'profile_url', label: 'Profile URL', type: 'url', width: 'half' },
          ]
        },
        {
          key: 'commission',
          label: 'Commission',
          icon: 'DollarSign',
          order: 3,
          enabled: true,
          fields: [
            { key: 'commission_rate', label: 'Commission Rate (%)', type: 'percentage', width: 'half' },
            { key: 'referral_code', label: 'Referral Code', type: 'text', width: 'half' },
            { key: 'total_referrals', label: 'Total Referrals', type: 'number', width: 'half' },
            { key: 'total_earnings', label: 'Total Earnings', type: 'currency', width: 'half' },
          ]
        },
      ],
    },
    {
      key: 'customer',
      label: 'Customer',
      labelPlural: 'Customers',
      icon: 'UserCheck',
      color: '#10b981',
      listColumns: ['name', 'phone', 'last_booking', 'total_spent', 'status'],
      searchableFields: ['name', 'phone', 'email'],
      sections: [
        {
          key: 'basic_info',
          label: 'Customer Information',
          icon: 'User',
          order: 1,
          enabled: true,
          fields: CONTACT_FIELDS,
        },
        {
          key: 'booking_history',
          label: 'Booking Summary',
          icon: 'Calendar',
          order: 2,
          enabled: true,
          fields: [
            { key: 'total_bookings', label: 'Total Bookings', type: 'number', width: 'half' },
            { key: 'total_spent', label: 'Total Spent', type: 'currency', width: 'half' },
            { key: 'last_booking_date', label: 'Last Booking', type: 'date', width: 'half' },
            { key: 'preferred_services', label: 'Preferred Services', type: 'multiselect', width: 'full', options: [
              { value: 'car_decor', label: 'Car Decor' },
              { value: 'room_decor', label: 'Room Decor' },
              { value: 'restaurant', label: 'Restaurant' },
              { value: 'transportation', label: 'Transportation' },
            ]},
          ]
        },
      ],
    },
  ],
  
  tabs: [
    { key: 'partners', label: 'Partners', icon: 'Users', entity: 'partner', enabled: true },
    { key: 'influencers', label: 'Influencers', icon: 'Star', entity: 'influencer', enabled: true },
    { key: 'customers', label: 'Customers', icon: 'UserCheck', entity: 'customer', enabled: true },
    { key: 'bookings', label: 'Bookings', icon: 'Calendar', enabled: true },
    { key: 'commissions', label: 'Commissions', icon: 'DollarSign', enabled: true },
  ],
};

// ============================================
// EXOTIC RENTALS - Vehicle Based
// ============================================
export const EXOTIC_RENTALS_CONFIG: CRMCategoryConfig = {
  slug: 'exotic_rentals',
  name: 'Exotic Rentals',
  description: 'Luxury vehicle rental management',
  icon: 'Car',
  color: '#ef4444',
  primaryEntity: 'vehicle',
  
  features: {
    showStores: false,
    showInventory: true,
    showRoutes: false,
    showAmbassadors: false,
    showAffiliates: false,
    showBookings: true,
    showVehicles: true,
    showProperties: false,
    showCommissions: false,
    showCalendar: true,
  },
  
  sharedComponents: {
    contacts: true,
    notes: true,
    timeline: true,
    followUps: true,
    media: true,
    voiceNotes: true,
  },
  
  entities: [
    {
      key: 'vehicle',
      label: 'Vehicle',
      labelPlural: 'Vehicles',
      icon: 'Car',
      color: '#ef4444',
      listColumns: ['name', 'type', 'daily_rate', 'status', 'availability'],
      searchableFields: ['name', 'make', 'model', 'plate'],
      sections: [
        {
          key: 'vehicle_info',
          label: 'Vehicle Details',
          icon: 'Car',
          order: 1,
          enabled: true,
          fields: [
            { key: 'name', label: 'Display Name', type: 'text', required: true, width: 'full' },
            { key: 'make', label: 'Make', type: 'text', width: 'third' },
            { key: 'model', label: 'Model', type: 'text', width: 'third' },
            { key: 'year', label: 'Year', type: 'number', width: 'third' },
            { key: 'color', label: 'Color', type: 'text', width: 'half' },
            { key: 'plate', label: 'License Plate', type: 'text', width: 'half' },
            { key: 'vin', label: 'VIN', type: 'text', width: 'full' },
          ]
        },
        {
          key: 'specifications',
          label: 'Specifications',
          icon: 'Settings',
          order: 2,
          enabled: true,
          fields: [
            { key: 'seats', label: 'Seats', type: 'number', width: 'third' },
            { key: 'doors', label: 'Doors', type: 'number', width: 'third' },
            { key: 'transmission', label: 'Transmission', type: 'select', width: 'third', options: [
              { value: 'automatic', label: 'Automatic' },
              { value: 'manual', label: 'Manual' },
            ]},
            { key: 'fuel_type', label: 'Fuel Type', type: 'select', width: 'half', options: [
              { value: 'gasoline', label: 'Gasoline' },
              { value: 'diesel', label: 'Diesel' },
              { value: 'electric', label: 'Electric' },
              { value: 'hybrid', label: 'Hybrid' },
            ]},
            { key: 'mileage', label: 'Current Mileage', type: 'number', width: 'half' },
          ]
        },
        {
          key: 'pricing',
          label: 'Pricing',
          icon: 'DollarSign',
          order: 3,
          enabled: true,
          fields: [
            { key: 'hourly_rate', label: 'Hourly Rate', type: 'currency', width: 'third' },
            { key: 'daily_rate', label: 'Daily Rate', type: 'currency', width: 'third' },
            { key: 'weekly_rate', label: 'Weekly Rate', type: 'currency', width: 'third' },
            { key: 'deposit', label: 'Security Deposit', type: 'currency', width: 'half' },
            { key: 'insurance_fee', label: 'Insurance Fee', type: 'currency', width: 'half' },
          ]
        },
        {
          key: 'availability',
          label: 'Availability',
          icon: 'Calendar',
          order: 4,
          enabled: true,
          fields: [
            { key: 'status', label: 'Status', type: 'select', width: 'half', options: [
              { value: 'available', label: 'Available' },
              { value: 'rented', label: 'Currently Rented' },
              { value: 'maintenance', label: 'In Maintenance' },
              { value: 'reserved', label: 'Reserved' },
            ]},
            { key: 'location', label: 'Current Location', type: 'text', width: 'half' },
          ]
        },
      ],
    },
    {
      key: 'booking',
      label: 'Rental',
      labelPlural: 'Rentals',
      icon: 'Calendar',
      color: '#3b82f6',
      listColumns: ['customer', 'vehicle', 'start_date', 'end_date', 'total', 'status'],
      searchableFields: ['customer_name', 'vehicle_name', 'confirmation_number'],
      sections: [
        {
          key: 'booking_info',
          label: 'Rental Details',
          icon: 'Calendar',
          order: 1,
          enabled: true,
          fields: [
            { key: 'vehicle_id', label: 'Vehicle', type: 'select', required: true, width: 'full' },
            { key: 'customer_id', label: 'Customer', type: 'select', required: true, width: 'full' },
            { key: 'pickup_date', label: 'Pickup Date', type: 'datetime', required: true, width: 'half' },
            { key: 'return_date', label: 'Return Date', type: 'datetime', required: true, width: 'half' },
            { key: 'pickup_location', label: 'Pickup Location', type: 'text', width: 'half' },
            { key: 'return_location', label: 'Return Location', type: 'text', width: 'half' },
          ]
        },
        {
          key: 'payment',
          label: 'Payment',
          icon: 'CreditCard',
          order: 2,
          enabled: true,
          fields: [
            { key: 'rental_total', label: 'Rental Total', type: 'currency', width: 'third' },
            { key: 'deposit_collected', label: 'Deposit Collected', type: 'currency', width: 'third' },
            { key: 'balance_due', label: 'Balance Due', type: 'currency', width: 'third' },
            { key: 'payment_status', label: 'Payment Status', type: 'select', width: 'half', options: [
              { value: 'pending', label: 'Pending' },
              { value: 'deposit_paid', label: 'Deposit Paid' },
              { value: 'paid', label: 'Fully Paid' },
              { value: 'refunded', label: 'Refunded' },
            ]},
          ]
        },
      ],
    },
    {
      key: 'customer',
      label: 'Customer',
      labelPlural: 'Customers',
      icon: 'User',
      color: '#10b981',
      listColumns: ['name', 'phone', 'license_verified', 'total_rentals', 'status'],
      searchableFields: ['name', 'phone', 'email', 'drivers_license'],
      sections: [
        {
          key: 'basic_info',
          label: 'Customer Information',
          icon: 'User',
          order: 1,
          enabled: true,
          fields: [
            ...CONTACT_FIELDS,
            { key: 'date_of_birth', label: 'Date of Birth', type: 'date', width: 'half' },
          ]
        },
        {
          key: 'verification',
          label: 'Verification',
          icon: 'Shield',
          order: 2,
          enabled: true,
          fields: [
            { key: 'drivers_license', label: "Driver's License #", type: 'text', width: 'half' },
            { key: 'license_state', label: 'License State', type: 'text', width: 'half' },
            { key: 'license_expiry', label: 'License Expiry', type: 'date', width: 'half' },
            { key: 'license_verified', label: 'License Verified', type: 'boolean', width: 'half' },
            { key: 'insurance_verified', label: 'Insurance Verified', type: 'boolean', width: 'half' },
          ]
        },
      ],
    },
  ],
  
  tabs: [
    { key: 'vehicles', label: 'Fleet', icon: 'Car', entity: 'vehicle', enabled: true },
    { key: 'rentals', label: 'Rentals', icon: 'Calendar', entity: 'booking', enabled: true },
    { key: 'customers', label: 'Customers', icon: 'User', entity: 'customer', enabled: true },
    { key: 'calendar', label: 'Calendar', icon: 'CalendarDays', enabled: true },
  ],
};

// ============================================
// HOTEL ROOMS / MANSIONS - Property Based
// ============================================
export const PROPERTY_RENTALS_CONFIG: CRMCategoryConfig = {
  slug: 'mansions_homes',
  name: 'Mansions & Properties',
  description: 'Luxury property and vacation rental management',
  icon: 'Building',
  color: '#8b5cf6',
  primaryEntity: 'property',
  
  features: {
    showStores: false,
    showInventory: false,
    showRoutes: false,
    showAmbassadors: false,
    showAffiliates: false,
    showBookings: true,
    showVehicles: false,
    showProperties: true,
    showCommissions: false,
    showCalendar: true,
  },
  
  sharedComponents: {
    contacts: true,
    notes: true,
    timeline: true,
    followUps: true,
    media: true,
    voiceNotes: true,
  },
  
  entities: [
    {
      key: 'property',
      label: 'Property',
      labelPlural: 'Properties',
      icon: 'Building',
      color: '#8b5cf6',
      listColumns: ['name', 'type', 'location', 'nightly_rate', 'status'],
      searchableFields: ['name', 'address', 'city'],
      sections: [
        {
          key: 'property_info',
          label: 'Property Details',
          icon: 'Building',
          order: 1,
          enabled: true,
          fields: [
            { key: 'name', label: 'Property Name', type: 'text', required: true, width: 'full' },
            { key: 'type', label: 'Property Type', type: 'select', width: 'half', options: [
              { value: 'mansion', label: 'Mansion' },
              { value: 'penthouse', label: 'Penthouse' },
              { value: 'condo', label: 'Condo' },
              { value: 'home', label: 'Home' },
              { value: 'hotel_room', label: 'Hotel Room' },
              { value: 'rooftop', label: 'Rooftop Space' },
            ]},
            { key: 'status', label: 'Status', type: 'select', width: 'half', options: [
              { value: 'available', label: 'Available' },
              { value: 'booked', label: 'Booked' },
              { value: 'maintenance', label: 'Maintenance' },
              { value: 'blocked', label: 'Blocked' },
            ]},
            ...ADDRESS_FIELDS,
          ]
        },
        {
          key: 'amenities',
          label: 'Amenities & Features',
          icon: 'Sparkles',
          order: 2,
          enabled: true,
          fields: [
            { key: 'bedrooms', label: 'Bedrooms', type: 'number', width: 'third' },
            { key: 'bathrooms', label: 'Bathrooms', type: 'number', width: 'third' },
            { key: 'max_guests', label: 'Max Guests', type: 'number', width: 'third' },
            { key: 'sqft', label: 'Square Feet', type: 'number', width: 'half' },
            { key: 'amenities', label: 'Amenities', type: 'multiselect', width: 'full', options: [
              { value: 'pool', label: 'Pool' },
              { value: 'hot_tub', label: 'Hot Tub' },
              { value: 'gym', label: 'Gym' },
              { value: 'parking', label: 'Parking' },
              { value: 'wifi', label: 'WiFi' },
              { value: 'kitchen', label: 'Full Kitchen' },
              { value: 'view', label: 'Scenic View' },
              { value: 'security', label: '24/7 Security' },
            ]},
          ]
        },
        {
          key: 'pricing',
          label: 'Pricing',
          icon: 'DollarSign',
          order: 3,
          enabled: true,
          fields: [
            { key: 'nightly_rate', label: 'Nightly Rate', type: 'currency', width: 'third' },
            { key: 'weekend_rate', label: 'Weekend Rate', type: 'currency', width: 'third' },
            { key: 'weekly_rate', label: 'Weekly Rate', type: 'currency', width: 'third' },
            { key: 'cleaning_fee', label: 'Cleaning Fee', type: 'currency', width: 'half' },
            { key: 'security_deposit', label: 'Security Deposit', type: 'currency', width: 'half' },
            { key: 'minimum_nights', label: 'Minimum Nights', type: 'number', width: 'half' },
          ]
        },
      ],
    },
  ],
  
  tabs: [
    { key: 'properties', label: 'Properties', icon: 'Building', entity: 'property', enabled: true },
    { key: 'reservations', label: 'Reservations', icon: 'Calendar', entity: 'booking', enabled: true },
    { key: 'guests', label: 'Guests', icon: 'Users', entity: 'customer', enabled: true },
    { key: 'calendar', label: 'Calendar', icon: 'CalendarDays', enabled: true },
  ],
};

// ============================================
// AFFILIATE - Commission Tracking Based
// ============================================
export const AFFILIATE_CONFIG: CRMCategoryConfig = {
  slug: 'amusement_parks',
  name: 'Amusement Parks (Affiliate)',
  description: 'Affiliate link and commission tracking',
  icon: 'Link',
  color: '#06b6d4',
  primaryEntity: 'affiliate_link',
  
  features: {
    showStores: false,
    showInventory: false,
    showRoutes: false,
    showAmbassadors: true,
    showAffiliates: true,
    showBookings: false,
    showVehicles: false,
    showProperties: false,
    showCommissions: true,
    showCalendar: false,
  },
  
  sharedComponents: {
    contacts: true,
    notes: true,
    timeline: true,
    followUps: true,
    media: false,
    voiceNotes: false,
  },
  
  entities: [
    {
      key: 'affiliate_link',
      label: 'Affiliate Link',
      labelPlural: 'Affiliate Links',
      icon: 'Link',
      color: '#06b6d4',
      listColumns: ['name', 'park', 'clicks', 'conversions', 'commission_earned'],
      searchableFields: ['name', 'park_name', 'tracking_code'],
      sections: [
        {
          key: 'link_info',
          label: 'Link Details',
          icon: 'Link',
          order: 1,
          enabled: true,
          fields: [
            { key: 'name', label: 'Link Name', type: 'text', required: true, width: 'full' },
            { key: 'park_name', label: 'Park/Venue Name', type: 'text', required: true, width: 'half' },
            { key: 'tracking_code', label: 'Tracking Code', type: 'text', width: 'half' },
            { key: 'affiliate_url', label: 'Affiliate URL', type: 'url', width: 'full' },
            { key: 'landing_page', label: 'Landing Page', type: 'url', width: 'full' },
          ]
        },
        {
          key: 'performance',
          label: 'Performance',
          icon: 'TrendingUp',
          order: 2,
          enabled: true,
          fields: [
            { key: 'clicks', label: 'Total Clicks', type: 'number', width: 'third' },
            { key: 'conversions', label: 'Conversions', type: 'number', width: 'third' },
            { key: 'conversion_rate', label: 'Conversion Rate', type: 'percentage', width: 'third' },
          ]
        },
        {
          key: 'commission',
          label: 'Commission',
          icon: 'DollarSign',
          order: 3,
          enabled: true,
          fields: [
            { key: 'commission_rate', label: 'Commission Rate (%)', type: 'percentage', width: 'half' },
            { key: 'commission_type', label: 'Commission Type', type: 'select', width: 'half', options: [
              { value: 'percentage', label: 'Percentage of Sale' },
              { value: 'fixed', label: 'Fixed Per Sale' },
              { value: 'cpc', label: 'Cost Per Click' },
            ]},
            { key: 'total_earned', label: 'Total Earned', type: 'currency', width: 'half' },
            { key: 'pending_payout', label: 'Pending Payout', type: 'currency', width: 'half' },
          ]
        },
      ],
    },
  ],
  
  tabs: [
    { key: 'links', label: 'Affiliate Links', icon: 'Link', entity: 'affiliate_link', enabled: true },
    { key: 'conversions', label: 'Conversions', icon: 'TrendingUp', enabled: true },
    { key: 'payouts', label: 'Payouts', icon: 'DollarSign', enabled: true },
    { key: 'analytics', label: 'Analytics', icon: 'BarChart3', enabled: true },
  ],
};

// ============================================
// YACHTS - Asset Based
// ============================================
export const YACHTS_CONFIG: CRMCategoryConfig = {
  slug: 'yachts',
  name: 'Yachts',
  description: 'Yacht and boat charter management',
  icon: 'Ship',
  color: '#0ea5e9',
  primaryEntity: 'asset',
  
  features: {
    showStores: false,
    showInventory: false,
    showRoutes: true,
    showAmbassadors: false,
    showAffiliates: false,
    showBookings: true,
    showVehicles: false,
    showProperties: false,
    showCommissions: false,
    showCalendar: true,
  },
  
  sharedComponents: {
    contacts: true,
    notes: true,
    timeline: true,
    followUps: true,
    media: true,
    voiceNotes: true,
  },
  
  entities: [
    {
      key: 'asset',
      label: 'Yacht',
      labelPlural: 'Yachts',
      icon: 'Ship',
      color: '#0ea5e9',
      listColumns: ['name', 'length', 'capacity', 'hourly_rate', 'status'],
      searchableFields: ['name', 'make', 'model'],
      sections: [
        {
          key: 'yacht_info',
          label: 'Yacht Details',
          icon: 'Ship',
          order: 1,
          enabled: true,
          fields: [
            { key: 'name', label: 'Yacht Name', type: 'text', required: true, width: 'full' },
            { key: 'make', label: 'Make', type: 'text', width: 'half' },
            { key: 'model', label: 'Model', type: 'text', width: 'half' },
            { key: 'year', label: 'Year', type: 'number', width: 'third' },
            { key: 'length', label: 'Length (ft)', type: 'number', width: 'third' },
            { key: 'capacity', label: 'Passenger Capacity', type: 'number', width: 'third' },
          ]
        },
        {
          key: 'crew',
          label: 'Crew & Equipment',
          icon: 'Users',
          order: 2,
          enabled: true,
          fields: [
            { key: 'captain_included', label: 'Captain Included', type: 'boolean', width: 'half' },
            { key: 'crew_size', label: 'Crew Size', type: 'number', width: 'half' },
            { key: 'amenities', label: 'Amenities', type: 'multiselect', width: 'full', options: [
              { value: 'bar', label: 'Full Bar' },
              { value: 'kitchen', label: 'Kitchen/Galley' },
              { value: 'entertainment', label: 'Entertainment System' },
              { value: 'jet_ski', label: 'Jet Ski' },
              { value: 'snorkeling', label: 'Snorkeling Gear' },
              { value: 'fishing', label: 'Fishing Equipment' },
            ]},
          ]
        },
        {
          key: 'pricing',
          label: 'Pricing',
          icon: 'DollarSign',
          order: 3,
          enabled: true,
          fields: [
            { key: 'hourly_rate', label: 'Hourly Rate', type: 'currency', width: 'third' },
            { key: 'half_day_rate', label: 'Half Day Rate', type: 'currency', width: 'third' },
            { key: 'full_day_rate', label: 'Full Day Rate', type: 'currency', width: 'third' },
            { key: 'fuel_policy', label: 'Fuel Policy', type: 'select', width: 'half', options: [
              { value: 'included', label: 'Fuel Included' },
              { value: 'extra', label: 'Fuel Extra' },
              { value: 'bring_back_full', label: 'Return Full' },
            ]},
            { key: 'deposit', label: 'Security Deposit', type: 'currency', width: 'half' },
          ]
        },
      ],
    },
  ],
  
  tabs: [
    { key: 'fleet', label: 'Fleet', icon: 'Ship', entity: 'asset', enabled: true },
    { key: 'charters', label: 'Charters', icon: 'Calendar', entity: 'booking', enabled: true },
    { key: 'clients', label: 'Clients', icon: 'Users', entity: 'customer', enabled: true },
    { key: 'routes', label: 'Routes', icon: 'MapPin', enabled: true },
  ],
};

// ============================================
// STORE DISTRIBUTION - Legacy Store Based
// ============================================
export const STORE_DISTRIBUTION_CONFIG: CRMCategoryConfig = {
  slug: 'store_distribution',
  name: 'Store Distribution',
  description: 'Traditional store-based distribution CRM',
  icon: 'Store',
  color: '#22c55e',
  primaryEntity: 'store',
  
  features: {
    showStores: true,
    showInventory: true,
    showRoutes: true,
    showAmbassadors: true,
    showAffiliates: false,
    showBookings: false,
    showVehicles: false,
    showProperties: false,
    showCommissions: false,
    showCalendar: false,
  },
  
  sharedComponents: {
    contacts: true,
    notes: true,
    timeline: true,
    followUps: true,
    media: true,
    voiceNotes: true,
  },
  
  entities: [
    {
      key: 'store',
      label: 'Store',
      labelPlural: 'Stores',
      icon: 'Store',
      color: '#22c55e',
      listColumns: ['name', 'address', 'borough', 'status', 'last_order'],
      searchableFields: ['name', 'address', 'phone'],
      sections: [
        {
          key: 'store_info',
          label: 'Store Information',
          icon: 'Store',
          order: 1,
          enabled: true,
          fields: [
            { key: 'name', label: 'Store Name', type: 'text', required: true, width: 'full' },
            ...ADDRESS_FIELDS,
            { key: 'phone', label: 'Phone', type: 'phone', width: 'half' },
            { key: 'borough', label: 'Borough/Region', type: 'text', width: 'half' },
          ]
        },
        {
          key: 'business_info',
          label: 'Business Details',
          icon: 'Building2',
          order: 2,
          enabled: true,
          fields: [
            { key: 'store_type', label: 'Store Type', type: 'select', width: 'half', options: [
              { value: 'smoke_shop', label: 'Smoke Shop' },
              { value: 'convenience', label: 'Convenience Store' },
              { value: 'bodega', label: 'Bodega' },
              { value: 'distributor', label: 'Distributor' },
            ]},
            { key: 'status', label: 'Status', type: 'select', width: 'half', options: [
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'prospect', label: 'Prospect' },
              { value: 'churned', label: 'Churned' },
            ]},
          ]
        },
      ],
    },
  ],
  
  tabs: [
    { key: 'stores', label: 'Stores', icon: 'Store', entity: 'store', enabled: true },
    { key: 'orders', label: 'Orders', icon: 'ShoppingCart', entity: 'deal', enabled: true },
    { key: 'inventory', label: 'Inventory', icon: 'Package', enabled: true },
    { key: 'routes', label: 'Routes', icon: 'Map', enabled: true },
    { key: 'contacts', label: 'Contacts', icon: 'Users', entity: 'contact', enabled: true },
  ],
};

// ============================================
// PHOTOGRAPHY/VIDEOGRAPHY - Service Based
// ============================================
export const PHOTOGRAPHY_CONFIG: CRMCategoryConfig = {
  slug: 'photography',
  name: 'Photography & Videography',
  description: 'Photography and videography service management',
  icon: 'Camera',
  color: '#f97316',
  primaryEntity: 'service',
  
  features: {
    showStores: false,
    showInventory: true,
    showRoutes: false,
    showAmbassadors: false,
    showAffiliates: false,
    showBookings: true,
    showVehicles: false,
    showProperties: false,
    showCommissions: false,
    showCalendar: true,
  },
  
  sharedComponents: {
    contacts: true,
    notes: true,
    timeline: true,
    followUps: true,
    media: true,
    voiceNotes: true,
  },
  
  entities: [
    {
      key: 'service',
      label: 'Package',
      labelPlural: 'Packages',
      icon: 'Package',
      color: '#f97316',
      listColumns: ['name', 'type', 'duration', 'price', 'status'],
      searchableFields: ['name', 'description'],
      sections: [
        {
          key: 'package_info',
          label: 'Package Details',
          icon: 'Package',
          order: 1,
          enabled: true,
          fields: [
            { key: 'name', label: 'Package Name', type: 'text', required: true, width: 'full' },
            { key: 'type', label: 'Service Type', type: 'select', width: 'half', options: [
              { value: 'photo', label: 'Photography' },
              { value: 'video', label: 'Videography' },
              { value: 'both', label: 'Photo & Video' },
              { value: 'drone', label: 'Drone' },
            ]},
            { key: 'duration_hours', label: 'Duration (hours)', type: 'number', width: 'half' },
            { key: 'description', label: 'Description', type: 'textarea', width: 'full' },
          ]
        },
        {
          key: 'deliverables',
          label: 'Deliverables',
          icon: 'Image',
          order: 2,
          enabled: true,
          fields: [
            { key: 'photo_count', label: 'Photos Included', type: 'number', width: 'third' },
            { key: 'video_length', label: 'Video Length (min)', type: 'number', width: 'third' },
            { key: 'turnaround_days', label: 'Turnaround (days)', type: 'number', width: 'third' },
            { key: 'includes', label: 'Includes', type: 'multiselect', width: 'full', options: [
              { value: 'raw_files', label: 'Raw Files' },
              { value: 'editing', label: 'Professional Editing' },
              { value: 'prints', label: 'Prints' },
              { value: 'album', label: 'Album' },
              { value: 'highlight_reel', label: 'Highlight Reel' },
            ]},
          ]
        },
        {
          key: 'pricing',
          label: 'Pricing',
          icon: 'DollarSign',
          order: 3,
          enabled: true,
          fields: [
            { key: 'base_price', label: 'Base Price', type: 'currency', width: 'half' },
            { key: 'deposit_required', label: 'Deposit Required', type: 'currency', width: 'half' },
            { key: 'extra_hour_rate', label: 'Extra Hour Rate', type: 'currency', width: 'half' },
          ]
        },
      ],
    },
  ],
  
  tabs: [
    { key: 'packages', label: 'Packages', icon: 'Package', entity: 'service', enabled: true },
    { key: 'sessions', label: 'Sessions', icon: 'Calendar', entity: 'booking', enabled: true },
    { key: 'clients', label: 'Clients', icon: 'Users', entity: 'customer', enabled: true },
    { key: 'portfolio', label: 'Portfolio', icon: 'Image', enabled: true },
    { key: 'equipment', label: 'Equipment', icon: 'Camera', enabled: true },
  ],
};

// ============================================
// MASTER CATEGORY REGISTRY
// ============================================
export const CRM_CATEGORY_CONFIGS: Record<CRMCategorySlug, CRMCategoryConfig> = {
  'toptier_promo': TOPTIER_PROMO_CONFIG,
  'car_decor_promo': { ...TOPTIER_PROMO_CONFIG, slug: 'car_decor_promo', name: 'Car Decor Promo' },
  'room_decor_promo': { ...TOPTIER_PROMO_CONFIG, slug: 'room_decor_promo', name: 'Room Decor Promo' },
  'restaurant_decor': { ...TOPTIER_PROMO_CONFIG, slug: 'restaurant_decor', name: 'Restaurant Decor' },
  'club_lounge_packages': { ...TOPTIER_PROMO_CONFIG, slug: 'club_lounge_packages', name: 'Club/Lounge Packages' },
  'exotic_rentals': EXOTIC_RENTALS_CONFIG,
  'black_trucks': { ...EXOTIC_RENTALS_CONFIG, slug: 'black_trucks', name: 'Black Trucks', icon: 'Truck' },
  'sprinter_vans': { ...EXOTIC_RENTALS_CONFIG, slug: 'sprinter_vans', name: 'Sprinter Vans', icon: 'Bus' },
  'party_bus': { ...EXOTIC_RENTALS_CONFIG, slug: 'party_bus', name: 'Party Bus', icon: 'Bus' },
  'helicopter': { ...EXOTIC_RENTALS_CONFIG, slug: 'helicopter', name: 'Helicopter', icon: 'Plane' },
  'yachts': YACHTS_CONFIG,
  'jetskis': { ...YACHTS_CONFIG, slug: 'jetskis', name: 'Jet Skis', icon: 'Waves' },
  'hotel_rooms': { ...PROPERTY_RENTALS_CONFIG, slug: 'hotel_rooms', name: 'Hotel Rooms' },
  'mansions_homes': PROPERTY_RENTALS_CONFIG,
  'event_spaces': { ...PROPERTY_RENTALS_CONFIG, slug: 'event_spaces', name: 'Event Spaces', icon: 'Building2' },
  'photography': PHOTOGRAPHY_CONFIG,
  'videography': { ...PHOTOGRAPHY_CONFIG, slug: 'videography', name: 'Videography' },
  'amusement_parks': AFFILIATE_CONFIG,
  'affiliate_general': { ...AFFILIATE_CONFIG, slug: 'affiliate_general', name: 'Affiliate Program' },
  'store_distribution': STORE_DISTRIBUTION_CONFIG,
  'funding': {
    slug: 'funding',
    name: 'Funding & Finance',
    description: 'Financial services and funding CRM',
    icon: 'Banknote',
    color: '#10b981',
    primaryEntity: 'deal',
    features: {
      showStores: false,
      showInventory: false,
      showRoutes: false,
      showAmbassadors: false,
      showAffiliates: false,
      showBookings: false,
      showVehicles: false,
      showProperties: false,
      showCommissions: true,
      showCalendar: false,
    },
    sharedComponents: {
      contacts: true,
      notes: true,
      timeline: true,
      followUps: true,
      media: true,
      voiceNotes: true,
    },
    entities: [],
    tabs: [
      { key: 'leads', label: 'Leads', icon: 'Users', entity: 'lead', enabled: true },
      { key: 'deals', label: 'Deals', icon: 'Banknote', entity: 'deal', enabled: true },
      { key: 'pipeline', label: 'Pipeline', icon: 'GitBranch', enabled: true },
    ],
  },
  'acquisition': {
    slug: 'acquisition',
    name: 'Acquisition',
    description: 'Property and asset acquisition CRM',
    icon: 'Target',
    color: '#6366f1',
    primaryEntity: 'deal',
    features: {
      showStores: false,
      showInventory: false,
      showRoutes: false,
      showAmbassadors: false,
      showAffiliates: false,
      showBookings: false,
      showVehicles: false,
      showProperties: true,
      showCommissions: false,
      showCalendar: false,
    },
    sharedComponents: {
      contacts: true,
      notes: true,
      timeline: true,
      followUps: true,
      media: true,
      voiceNotes: true,
    },
    entities: [],
    tabs: [
      { key: 'leads', label: 'Leads', icon: 'Target', entity: 'lead', enabled: true },
      { key: 'properties', label: 'Properties', icon: 'Building', entity: 'property', enabled: true },
      { key: 'deals', label: 'Deals', icon: 'Handshake', entity: 'deal', enabled: true },
    ],
  },
  'general': {
    slug: 'general',
    name: 'General CRM',
    description: 'General purpose CRM',
    icon: 'LayoutGrid',
    color: '#6b7280',
    primaryEntity: 'contact',
    features: {
      showStores: true,
      showInventory: true,
      showRoutes: true,
      showAmbassadors: true,
      showAffiliates: true,
      showBookings: true,
      showVehicles: false,
      showProperties: false,
      showCommissions: false,
      showCalendar: true,
    },
    sharedComponents: {
      contacts: true,
      notes: true,
      timeline: true,
      followUps: true,
      media: true,
      voiceNotes: true,
    },
    entities: [],
    tabs: [
      { key: 'contacts', label: 'Contacts', icon: 'Users', entity: 'contact', enabled: true },
      { key: 'companies', label: 'Companies', icon: 'Building2', enabled: true },
      { key: 'deals', label: 'Deals', icon: 'Handshake', entity: 'deal', enabled: true },
    ],
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get CRM category config by slug
 */
export function getCRMCategoryConfig(slug: CRMCategorySlug): CRMCategoryConfig {
  return CRM_CATEGORY_CONFIGS[slug] || CRM_CATEGORY_CONFIGS['general'];
}

/**
 * Map business type/industry to CRM category
 */
export function inferCRMCategory(
  businessType?: string | null,
  industry?: string | null,
  slug?: string | null
): CRMCategorySlug {
  // Direct slug mapping
  if (slug) {
    const normalizedSlug = slug.toLowerCase().replace(/[\s-]/g, '_');
    
    // TopTier Experience -> TOPTIER PROMO (no stores)
    if (normalizedSlug.includes('toptier') && !normalizedSlug.includes('distribution')) {
      return 'toptier_promo';
    }
    
    // Unforgettable Times -> Club/Events
    if (normalizedSlug.includes('unforgettable')) {
      return 'club_lounge_packages';
    }
    
    // PlayBoxxx -> Entertainment
    if (normalizedSlug.includes('playbox')) {
      return 'club_lounge_packages';
    }
    
    // Check for specific categories in CRM_CATEGORY_CONFIGS
    if (normalizedSlug in CRM_CATEGORY_CONFIGS) {
      return normalizedSlug as CRMCategorySlug;
    }
  }
  
  // Industry-based inference
  if (industry) {
    const ind = industry.toLowerCase();
    
    if (ind.includes('tobacco') || ind.includes('distribution')) {
      return 'store_distribution';
    }
    if (ind.includes('events') || ind.includes('hospitality')) {
      return 'club_lounge_packages';
    }
    if (ind.includes('funding') || ind.includes('credit')) {
      return 'funding';
    }
    if (ind.includes('real_estate') || ind.includes('acquisition')) {
      return 'acquisition';
    }
    if (ind.includes('transport') || ind.includes('luxury')) {
      return 'exotic_rentals';
    }
    if (ind.includes('rental')) {
      return 'mansions_homes';
    }
  }
  
  // Business type inference
  if (businessType) {
    const bt = businessType.toLowerCase();
    
    if (bt === 'consumer_goods') return 'store_distribution';
    if (bt === 'services') return 'toptier_promo';
    if (bt === 'events') return 'club_lounge_packages';
    if (bt === 'financial_services') return 'funding';
    if (bt === 'acquisition') return 'acquisition';
    if (bt === 'platform') return 'toptier_promo';
  }
  
  return 'general';
}

/**
 * Get all available categories for admin dropdown
 */
export function getAllCRMCategories(): { slug: CRMCategorySlug; name: string; icon: string }[] {
  return Object.values(CRM_CATEGORY_CONFIGS).map(config => ({
    slug: config.slug,
    name: config.name,
    icon: config.icon,
  }));
}

/**
 * Check if a category requires stores
 */
export function categoryRequiresStores(slug: CRMCategorySlug): boolean {
  const config = getCRMCategoryConfig(slug);
  return config.features.showStores && config.primaryEntity === 'store';
}

/**
 * Get visible tabs for a category
 */
export function getCategoryTabs(slug: CRMCategorySlug) {
  const config = getCRMCategoryConfig(slug);
  return config.tabs.filter(tab => tab.enabled);
}

/**
 * Get entity configuration for a category
 */
export function getCategoryEntity(slug: CRMCategorySlug, entityKey: EntityType): CRMEntityConfig | undefined {
  const config = getCRMCategoryConfig(slug);
  return config.entities.find(e => e.key === entityKey);
}
