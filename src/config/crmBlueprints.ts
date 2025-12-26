/**
 * CRM Blueprint System
 * Business-configurable CRM framework with entity types, fields, pipelines
 */

// ============================================
// PARTNER PROMO CATEGORIES (TopTier specific)
// ============================================
export const TOPTIER_PARTNER_CATEGORIES = [
  { value: 'car_decor_promo', label: 'Car Decor Promo', icon: 'Car' },
  { value: 'exotic_rental_car_promo', label: 'Exotic Rental Car Promo', icon: 'Sparkles' },
  { value: 'room_decor_promo', label: 'Room Decor Promo', icon: 'Home' },
  { value: 'helicopter_promo', label: 'Helicopter Promo', icon: 'Plane' },
  { value: 'private_chef_promo', label: 'Private Chef Promo', icon: 'ChefHat' },
  { value: 'black_trucks_promo', label: 'Black Trucks Promo', icon: 'Truck' },
  { value: 'sprinter_van_promo', label: 'Sprinter Van Promo', icon: 'Bus' },
  { value: 'party_bus_promo', label: 'Party Bus Promo', icon: 'PartyPopper' },
  { value: 'security_promo', label: 'Security Promo', icon: 'Shield' },
  { value: 'hotel_rooms', label: 'Hotel Rooms', icon: 'Hotel' },
  { value: 'luxury_residences', label: 'Mansions / Homes / Condos / Penthouses', icon: 'Castle' },
  { value: 'eventspaces_rooftop', label: 'Event Spaces (Rooftop)', icon: 'Building2' },
  { value: 'photography_videography', label: 'Photography / Videography', icon: 'Camera' },
  { value: 'amusementparks_affiliate', label: 'Amusement Parks (Affiliate Links & Commissions)', icon: 'Ferris' },
  { value: 'yachts', label: 'Yachts', icon: 'Ship' },
  { value: 'car_jetskis', label: 'Car Jet Skis', icon: 'Waves' },
  { value: 'restaurant_decor_reservations', label: 'Restaurant Decor & Reservations', icon: 'Utensils' },
  { value: 'club_lounge_package', label: 'Club / Lounge Package (Decorated Section + DJ Shoutout + Black Truck + Cake)', icon: 'Music' },
  { value: 'other', label: 'Other / Custom', icon: 'MoreHorizontal' },
] as const;

// Alias for backwards compatibility
export const TOPTIER_PROMO_CATEGORIES = TOPTIER_PARTNER_CATEGORIES;

export type PartnerCategoryValue = typeof TOPTIER_PARTNER_CATEGORIES[number]['value'];
export type PromoCategoryValue = PartnerCategoryValue;

// ============================================
// EXTENDED ENTITY TYPES
// ============================================
export type ExtendedEntityType = 
  | 'partner'
  | 'influencer' 
  | 'customer'
  | 'client'           // Funding clients
  | 'model'            // PlayBoxxx models
  | 'vendor'           // UnforgettableTimes vendors
  | 'event_hall'       // UnforgettableTimes
  | 'rental_company'   // UnforgettableTimes
  | 'supplier'         // General suppliers
  | 'staff'            // Staff/contractors
  | 'booking'          // General bookings
  | 'event_booking'    // UnforgettableTimes events
  | 'funding_application' // Funding deals
  | 'collab'           // PlayBoxxx collabs
  | 'promo_campaign'   // TopTier campaigns
  | 'task'
  | 'note'
  | 'interaction'
  | 'asset'
  | 'media';           // Media vault items

// ============================================
// PIPELINE STAGES
// ============================================
export const TOPTIER_BOOKING_PIPELINE = [
  { value: 'new_lead', label: 'New Lead', color: '#94a3b8' },
  { value: 'qualified', label: 'Qualified', color: '#60a5fa' },
  { value: 'quote_sent', label: 'Quote Sent', color: '#a78bfa' },
  { value: 'deposit_paid', label: 'Deposit Paid', color: '#fbbf24' },
  { value: 'confirmed', label: 'Confirmed', color: '#34d399' },
  { value: 'in_progress', label: 'In Progress', color: '#22d3ee' },
  { value: 'completed', label: 'Completed', color: '#22c55e' },
  { value: 'follow_up', label: 'Follow-Up', color: '#f97316' },
  { value: 'cancelled', label: 'Cancelled', color: '#ef4444' },
];

export const FUNDING_APPLICATION_PIPELINE = [
  { value: 'intake', label: 'Intake', color: '#94a3b8' },
  { value: 'document_collection', label: 'Document Collection', color: '#60a5fa' },
  { value: 'underwriting', label: 'Underwriting', color: '#a78bfa' },
  { value: 'submission', label: 'Submission', color: '#fbbf24' },
  { value: 'offers_received', label: 'Offers Received', color: '#34d399' },
  { value: 'client_accepted', label: 'Client Accepted', color: '#22d3ee' },
  { value: 'funded', label: 'Funded', color: '#22c55e' },
  { value: 'closed_lost', label: 'Closed/Lost', color: '#ef4444' },
];

export const UNFORGETTABLE_EVENT_PIPELINE = [
  { value: 'inquiry', label: 'Inquiry', color: '#94a3b8' },
  { value: 'quote_sent', label: 'Quote Sent', color: '#60a5fa' },
  { value: 'deposit_paid', label: 'Deposit Paid', color: '#a78bfa' },
  { value: 'vendor_assigned', label: 'Vendor Assigned', color: '#fbbf24' },
  { value: 'final_payment_pending', label: 'Final Payment Pending', color: '#f97316' },
  { value: 'event_scheduled', label: 'Event Scheduled', color: '#34d399' },
  { value: 'event_complete', label: 'Event Complete', color: '#22c55e' },
  { value: 'post_event_followup', label: 'Post-Event Follow-up', color: '#22d3ee' },
];

export const PLAYBOXXX_MODEL_PIPELINE = [
  { value: 'new_lead', label: 'New Lead', color: '#94a3b8' },
  { value: 'verified', label: 'Verified', color: '#60a5fa' },
  { value: 'onboarded', label: 'Onboarded', color: '#a78bfa' },
  { value: 'active', label: 'Active', color: '#22c55e' },
  { value: 'featured', label: 'Featured', color: '#fbbf24' },
  { value: 'paused', label: 'Paused', color: '#f97316' },
  { value: 'offboarded', label: 'Offboarded', color: '#ef4444' },
];

// ============================================
// FUNDING CLIENT TASK TEMPLATES
// ============================================
export const FUNDING_CLIENT_TASK_TEMPLATES = [
  { label: 'Request ID', category: 'docs', order: 1 },
  { label: 'Request bank statements', category: 'docs', order: 2 },
  { label: 'Verify business registration', category: 'verification', order: 3 },
  { label: 'Submit application', category: 'submission', order: 4 },
  { label: 'Follow up with lender', category: 'follow_up', order: 5 },
  { label: 'Schedule offer review call', category: 'call', order: 6 },
];

// ============================================
// US STATES LIST
// ============================================
export const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
];

// ============================================
// BUSINESS BLUEPRINT INTERFACE
// ============================================
export interface CRMBlueprint {
  businessId: string;
  businessSlug: string;
  businessName: string;
  enabledEntityTypes: ExtendedEntityType[];
  entitySchemas: Record<string, EntitySchema>;
  pipelines: Record<string, PipelineStage[]>;
  profileTabs: Record<string, ProfileTab[]>;
  listViews: Record<string, ListView>;
  kpiConfig: KPIConfig[];
  features: BlueprintFeatures;
}

export interface EntitySchema {
  key: ExtendedEntityType;
  label: string;
  labelPlural: string;
  icon: string;
  color: string;
  tableName: string;
  fields: EntityField[];
  listColumns: string[];
  searchableFields: string[];
}

export interface EntityField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'currency' | 'date' | 'datetime' | 'select' | 'multiselect' | 'phone' | 'email' | 'url' | 'address' | 'boolean' | 'file' | 'image' | 'percentage' | 'json';
  required?: boolean;
  section?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  defaultValue?: any;
  helpText?: string;
  width?: 'full' | 'half' | 'third';
  masked?: boolean; // Only visible to certain roles
  maskedRoles?: string[];
}

export interface PipelineStage {
  value: string;
  label: string;
  color: string;
  order?: number;
}

export interface ProfileTab {
  key: string;
  label: string;
  icon: string;
  enabled: boolean;
  component?: string; // Custom component name
}

export interface ListView {
  defaultColumns: string[];
  defaultSort: { field: string; direction: 'asc' | 'desc' };
  filters: { field: string; label: string; type: 'select' | 'multiselect' | 'text' | 'date_range' }[];
  savedViews?: { name: string; filters: Record<string, any> }[];
}

export interface KPIConfig {
  key: string;
  label: string;
  icon: string;
  entityType?: ExtendedEntityType;
  aggregation: 'count' | 'sum' | 'avg';
  field?: string;
  filter?: Record<string, any>;
  variant: 'cyan' | 'green' | 'amber' | 'purple' | 'red' | 'default';
  clickable: boolean;
  detailsRoute?: string;
}

export interface BlueprintFeatures {
  showStores: boolean;
  showInventory: boolean;
  showRoutes: boolean;
  showBookings: boolean;
  showCommissions: boolean;
  showCalendar: boolean;
  showMediaVault: boolean;
  showWhatsApp: boolean;
  showTaskTemplates: boolean;
  showPipeline: boolean;
}

// ============================================
// BUSINESS-SPECIFIC BLUEPRINTS
// ============================================

export const TOPTIER_BLUEPRINT: CRMBlueprint = {
  businessId: 'toptier',
  businessSlug: 'toptier-experience',
  businessName: 'TopTier Experience',
  enabledEntityTypes: ['partner', 'customer', 'influencer', 'booking', 'promo_campaign', 'task', 'note', 'interaction', 'asset'],
  features: {
    showStores: false,
    showInventory: false,
    showRoutes: false,
    showBookings: true,
    showCommissions: true,
    showCalendar: true,
    showMediaVault: false,
    showWhatsApp: false,
    showTaskTemplates: false,
    showPipeline: true,
  },
  pipelines: {
    booking: TOPTIER_BOOKING_PIPELINE,
  },
  kpiConfig: [
    { key: 'partners', label: 'Partners', icon: 'Users', entityType: 'partner', aggregation: 'count', variant: 'cyan', clickable: true, detailsRoute: '/crm/toptier-experience/partners' },
    { key: 'partners_by_category', label: 'Partners by Category', icon: 'Grid3X3', entityType: 'partner', aggregation: 'count', variant: 'purple', clickable: true, detailsRoute: '/crm/toptier-experience/partners?view=by-category' },
    { key: 'active_promos', label: 'Active Promos', icon: 'Megaphone', entityType: 'promo_campaign', aggregation: 'count', filter: { status: 'active' }, variant: 'amber', clickable: true, detailsRoute: '/crm/toptier-experience/promos' },
    { key: 'bookings', label: 'Active Bookings', icon: 'Calendar', entityType: 'booking', aggregation: 'count', filter: { status: ['confirmed', 'in_progress'] }, variant: 'green', clickable: true, detailsRoute: '/crm/toptier-experience/bookings' },
    { key: 'customers', label: 'Customers', icon: 'UserCheck', entityType: 'customer', aggregation: 'count', variant: 'default', clickable: true, detailsRoute: '/crm/toptier-experience/customers' },
    { key: 'influencers', label: 'Influencers', icon: 'Star', entityType: 'influencer', aggregation: 'count', variant: 'default', clickable: true, detailsRoute: '/crm/toptier-experience/influencers' },
  ],
  entitySchemas: {
    partner: {
      key: 'partner',
      label: 'Partner',
      labelPlural: 'Partners',
      icon: 'Building2',
      color: '#f59e0b',
      tableName: 'crm_partners',
      listColumns: ['company_name', 'partner_category', 'state', 'city', 'commission_rate', 'contract_status'],
      searchableFields: ['company_name', 'contact_name', 'state', 'city'],
      fields: [
        // Basic Information
        { key: 'company_name', label: 'Partner Name', type: 'text', required: true, width: 'half', section: 'basic', placeholder: 'Enter partner/company name' },
        { key: 'contact_name', label: 'Primary Contact', type: 'text', width: 'half', section: 'basic' },
        { key: 'phone', label: 'Phone', type: 'phone', width: 'half', section: 'basic' },
        { key: 'email', label: 'Email', type: 'email', width: 'half', section: 'basic' },
        // Partner Category (REQUIRED)
        { key: 'partner_category', label: 'Partner Category', type: 'select', required: true, width: 'full', section: 'category', options: TOPTIER_PARTNER_CATEGORIES.map(c => ({ value: c.value, label: c.label })), helpText: 'Select the primary service category this partner offers' },
        // Location & Coverage
        { key: 'state', label: 'State', type: 'select', required: true, width: 'half', section: 'coverage', options: US_STATES },
        { key: 'city', label: 'City', type: 'text', required: true, width: 'half', section: 'coverage' },
        { key: 'service_area', label: 'Service Area (Multi-State)', type: 'multiselect', width: 'full', section: 'coverage', options: US_STATES, helpText: 'Select all states where this partner operates' },
        // Pricing & Booking
        { key: 'pricing_range', label: 'Pricing Range', type: 'text', width: 'half', section: 'pricing', placeholder: 'e.g. $500 - $2,000' },
        { key: 'availability_rules', label: 'Availability Rules', type: 'textarea', width: 'half', section: 'pricing', placeholder: 'e.g. Weekends only, 48hr advance notice' },
        { key: 'booking_link', label: 'Booking / Affiliate Link', type: 'url', width: 'full', section: 'pricing' },
        // Commission & Contract
        { key: 'commission_rate', label: 'Commission Rate (%)', type: 'percentage', required: true, width: 'half', section: 'commission' },
        { key: 'contract_status', label: 'Contract Status', type: 'select', width: 'half', section: 'commission', options: [
          { value: 'pending', label: 'Pending' },
          { value: 'active', label: 'Active' },
          { value: 'expired', label: 'Expired' },
          { value: 'terminated', label: 'Terminated' },
        ]},
        { key: 'contract_start_date', label: 'Contract Start Date', type: 'date', width: 'half', section: 'commission' },
        { key: 'contract_end_date', label: 'Contract End Date', type: 'date', width: 'half', section: 'commission' },
        // Notes
        { key: 'notes', label: 'Notes', type: 'textarea', width: 'full', section: 'notes' },
      ],
    },
    customer: {
      key: 'customer',
      label: 'Customer',
      labelPlural: 'Customers',
      icon: 'UserCheck',
      color: '#10b981',
      tableName: 'crm_customers',
      listColumns: ['name', 'phone', 'interest_categories', 'status', 'event_date'],
      searchableFields: ['name', 'phone', 'email'],
      fields: [
        { key: 'name', label: 'Full Name', type: 'text', required: true, width: 'half', section: 'basic' },
        { key: 'phone', label: 'Phone', type: 'phone', required: true, width: 'half', section: 'basic' },
        { key: 'email', label: 'Email', type: 'email', width: 'half', section: 'basic' },
        { key: 'interest_categories', label: 'Interest Categories', type: 'multiselect', width: 'full', section: 'preferences', options: TOPTIER_PARTNER_CATEGORIES.map(c => ({ value: c.value, label: c.label })) },
        { key: 'budget_range', label: 'Budget Range', type: 'select', width: 'half', section: 'preferences', options: [
          { value: 'under_500', label: 'Under $500' },
          { value: '500_1000', label: '$500 - $1,000' },
          { value: '1000_2500', label: '$1,000 - $2,500' },
          { value: '2500_5000', label: '$2,500 - $5,000' },
          { value: '5000_10000', label: '$5,000 - $10,000' },
          { value: 'over_10000', label: 'Over $10,000' },
        ]},
        { key: 'event_date', label: 'Event Date', type: 'date', width: 'half', section: 'preferences' },
        { key: 'preferred_state', label: 'Preferred State', type: 'select', width: 'half', section: 'preferences', options: US_STATES },
        { key: 'preferred_city', label: 'Preferred City', type: 'text', width: 'half', section: 'preferences' },
        { key: 'lead_source', label: 'Lead Source', type: 'select', width: 'half', section: 'status', options: [
          { value: 'instagram', label: 'Instagram' },
          { value: 'referral', label: 'Referral' },
          { value: 'google', label: 'Google' },
          { value: 'website', label: 'Website' },
          { value: 'influencer', label: 'Influencer Referral' },
          { value: 'other', label: 'Other' },
        ]},
        { key: 'status', label: 'Status', type: 'select', width: 'half', section: 'status', options: [
          { value: 'lead', label: 'Lead' },
          { value: 'active', label: 'Active' },
          { value: 'vip', label: 'VIP' },
        ]},
      ],
    },
    influencer: {
      key: 'influencer',
      label: 'Influencer',
      labelPlural: 'Influencers',
      icon: 'Star',
      color: '#ec4899',
      tableName: 'crm_influencers',
      listColumns: ['name', 'platform', 'handle', 'audience_size', 'commission_rate'],
      searchableFields: ['name', 'handle'],
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true, width: 'half', section: 'basic' },
        { key: 'phone', label: 'Phone', type: 'phone', width: 'half', section: 'basic' },
        { key: 'email', label: 'Email', type: 'email', width: 'half', section: 'basic' },
        { key: 'platform', label: 'Platform', type: 'select', width: 'half', section: 'social', options: [
          { value: 'instagram', label: 'Instagram' },
          { value: 'tiktok', label: 'TikTok' },
          { value: 'youtube', label: 'YouTube' },
          { value: 'twitter', label: 'Twitter/X' },
        ]},
        { key: 'handle', label: 'Handle', type: 'text', width: 'half', section: 'social' },
        { key: 'audience_size', label: 'Audience Size', type: 'number', width: 'half', section: 'social' },
        { key: 'engagement_rate', label: 'Engagement Rate (%)', type: 'percentage', width: 'half', section: 'social' },
        { key: 'promo_code', label: 'Promo Code', type: 'text', width: 'half', section: 'commission' },
        { key: 'commission_rate', label: 'Commission Rate (%)', type: 'percentage', width: 'half', section: 'commission' },
        { key: 'payout_method', label: 'Payout Method', type: 'select', width: 'half', section: 'commission', options: [
          { value: 'paypal', label: 'PayPal' },
          { value: 'zelle', label: 'Zelle' },
          { value: 'bank', label: 'Bank Transfer' },
          { value: 'cash', label: 'Cash' },
        ]},
      ],
    },
    booking: {
      key: 'booking',
      label: 'Booking',
      labelPlural: 'Bookings',
      icon: 'Calendar',
      color: '#3b82f6',
      tableName: 'crm_bookings',
      listColumns: ['customer_name', 'event_date', 'partner_categories', 'total_amount', 'status'],
      searchableFields: ['customer_name', 'notes'],
      fields: [
        { key: 'customer_id', label: 'Customer', type: 'select', required: true, width: 'half', section: 'basic' },
        { key: 'event_date', label: 'Event Date', type: 'date', required: true, width: 'half', section: 'basic' },
        { key: 'event_time', label: 'Event Time', type: 'text', width: 'half', section: 'basic', placeholder: 'e.g. 7:00 PM' },
        { key: 'event_location', label: 'Event Location', type: 'text', width: 'half', section: 'basic' },
        // Multi-category package support
        { key: 'partner_categories', label: 'Package Categories', type: 'multiselect', width: 'full', section: 'package', options: TOPTIER_PARTNER_CATEGORIES.map(c => ({ value: c.value, label: c.label })), helpText: 'Select all service categories included in this booking' },
        { key: 'linked_partners', label: 'Linked Partners', type: 'multiselect', width: 'full', section: 'package', helpText: 'Select specific partners for this booking' },
        // Pricing
        { key: 'total_amount', label: 'Total Amount', type: 'currency', width: 'half', section: 'pricing' },
        { key: 'deposit_amount', label: 'Deposit Amount', type: 'currency', width: 'half', section: 'pricing' },
        { key: 'deposit_paid', label: 'Deposit Paid', type: 'boolean', width: 'half', section: 'pricing' },
        { key: 'balance_due', label: 'Balance Due', type: 'currency', width: 'half', section: 'pricing' },
        // Status
        { key: 'status', label: 'Status', type: 'select', width: 'half', section: 'status', options: TOPTIER_BOOKING_PIPELINE.map(s => ({ value: s.value, label: s.label })) },
        { key: 'notes', label: 'Notes', type: 'textarea', width: 'full', section: 'notes' },
      ],
    },
    promo_campaign: {
      key: 'promo_campaign',
      label: 'Promo Campaign',
      labelPlural: 'Promo Campaigns',
      icon: 'Megaphone',
      color: '#8b5cf6',
      tableName: 'crm_promo_campaigns',
      listColumns: ['name', 'promo_category', 'start_date', 'end_date', 'status'],
      searchableFields: ['name', 'description'],
      fields: [
        { key: 'name', label: 'Campaign Name', type: 'text', required: true, width: 'half', section: 'basic' },
        { key: 'description', label: 'Description', type: 'textarea', width: 'full', section: 'basic' },
        // Category must match partner categories
        { key: 'promo_category', label: 'Promo Category', type: 'select', required: true, width: 'half', section: 'category', options: TOPTIER_PARTNER_CATEGORIES.map(c => ({ value: c.value, label: c.label })), helpText: 'Must match partner categories for validation' },
        // Linked entities
        { key: 'linked_partners', label: 'Linked Partners', type: 'multiselect', width: 'full', section: 'links', helpText: 'Partners participating in this promo' },
        { key: 'linked_influencers', label: 'Linked Influencers', type: 'multiselect', width: 'full', section: 'links', helpText: 'Influencers promoting this campaign' },
        // Commission & Tracking
        { key: 'commission_rules', label: 'Commission Rules', type: 'textarea', width: 'full', section: 'commission', placeholder: 'e.g. 10% for first booking, 5% for repeat' },
        { key: 'tracking_link', label: 'Tracking Link', type: 'url', width: 'full', section: 'commission' },
        // Dates
        { key: 'start_date', label: 'Start Date', type: 'date', width: 'half', section: 'dates' },
        { key: 'end_date', label: 'End Date', type: 'date', width: 'half', section: 'dates' },
        // Status
        { key: 'status', label: 'Status', type: 'select', width: 'half', section: 'status', options: [
          { value: 'draft', label: 'Draft' },
          { value: 'active', label: 'Active' },
          { value: 'paused', label: 'Paused' },
          { value: 'ended', label: 'Ended' },
        ]},
      ],
    },
  },
  profileTabs: {
    partner: [
      { key: 'overview', label: 'Overview', icon: 'User', enabled: true },
      { key: 'bookings', label: 'Deals / Bookings', icon: 'Calendar', enabled: true },
      { key: 'campaigns', label: 'Campaigns / Promos', icon: 'Megaphone', enabled: true },
      { key: 'commissions', label: 'Commissions', icon: 'DollarSign', enabled: true },
      { key: 'interactions', label: 'Interactions', icon: 'MessageSquare', enabled: true },
      { key: 'notes', label: 'Notes', icon: 'FileText', enabled: true },
      { key: 'assets', label: 'Assets (Contracts, Media)', icon: 'Folder', enabled: true },
    ],
    customer: [
      { key: 'overview', label: 'Overview', icon: 'User', enabled: true },
      { key: 'bookings', label: 'Bookings', icon: 'Calendar', enabled: true },
      { key: 'interactions', label: 'Interactions', icon: 'MessageSquare', enabled: true },
      { key: 'notes', label: 'Notes', icon: 'FileText', enabled: true },
    ],
    influencer: [
      { key: 'overview', label: 'Overview', icon: 'User', enabled: true },
      { key: 'commissions', label: 'Commissions', icon: 'DollarSign', enabled: true },
      { key: 'referrals', label: 'Referrals', icon: 'Users', enabled: true },
      { key: 'campaigns', label: 'Campaigns', icon: 'Megaphone', enabled: true },
      { key: 'notes', label: 'Notes', icon: 'FileText', enabled: true },
    ],
    booking: [
      { key: 'overview', label: 'Overview', icon: 'Calendar', enabled: true },
      { key: 'partners', label: 'Partners', icon: 'Building2', enabled: true },
      { key: 'payments', label: 'Payments', icon: 'DollarSign', enabled: true },
      { key: 'notes', label: 'Notes', icon: 'FileText', enabled: true },
    ],
    promo_campaign: [
      { key: 'overview', label: 'Overview', icon: 'Megaphone', enabled: true },
      { key: 'partners', label: 'Partners', icon: 'Building2', enabled: true },
      { key: 'influencers', label: 'Influencers', icon: 'Star', enabled: true },
      { key: 'performance', label: 'Performance', icon: 'TrendingUp', enabled: true },
    ],
  },
  listViews: {
    partner: {
      defaultColumns: ['company_name', 'partner_category', 'state', 'city', 'commission_rate', 'contract_status'],
      defaultSort: { field: 'company_name', direction: 'asc' },
      filters: [
        { field: 'partner_category', label: 'Partner Category', type: 'select' },
        { field: 'state', label: 'State', type: 'select' },
        { field: 'city', label: 'City', type: 'text' },
        { field: 'contract_status', label: 'Contract Status', type: 'select' },
      ],
      savedViews: [
        // Partner Directory
        { name: 'Partner Directory', filters: {} },
        // Category-based views (auto-generated per category)
        { name: 'Car Decor Partners', filters: { partner_category: 'car_decor_promo' } },
        { name: 'Exotic Car Rental Partners', filters: { partner_category: 'exotic_rental_car_promo' } },
        { name: 'Room Decor Partners', filters: { partner_category: 'room_decor_promo' } },
        { name: 'Helicopter Partners', filters: { partner_category: 'helicopter_promo' } },
        { name: 'Private Chef Partners', filters: { partner_category: 'private_chef_promo' } },
        { name: 'Black Trucks Partners', filters: { partner_category: 'black_trucks_promo' } },
        { name: 'Sprinter Van Partners', filters: { partner_category: 'sprinter_van_promo' } },
        { name: 'Party Bus Partners', filters: { partner_category: 'party_bus_promo' } },
        { name: 'Security Partners', filters: { partner_category: 'security_promo' } },
        { name: 'Hotel Partners', filters: { partner_category: 'hotel_rooms' } },
        { name: 'Luxury Residences Partners', filters: { partner_category: 'luxury_residences' } },
        { name: 'Event Spaces / Rooftop Partners', filters: { partner_category: 'eventspaces_rooftop' } },
        { name: 'Photography / Videography Partners', filters: { partner_category: 'photography_videography' } },
        { name: 'Amusement Parks Partners', filters: { partner_category: 'amusementparks_affiliate' } },
        { name: 'Yacht Partners', filters: { partner_category: 'yachts' } },
        { name: 'Jet Ski Partners', filters: { partner_category: 'car_jetskis' } },
        { name: 'Restaurant Partners', filters: { partner_category: 'restaurant_decor_reservations' } },
        { name: 'Club / Lounge Partners', filters: { partner_category: 'club_lounge_package' } },
        // Status-based views
        { name: 'Active Contracts', filters: { contract_status: 'active' } },
        { name: 'Pending Contracts', filters: { contract_status: 'pending' } },
        { name: 'Expired Contracts', filters: { contract_status: 'expired' } },
      ],
    },
    customer: {
      defaultColumns: ['name', 'phone', 'interest_categories', 'status'],
      defaultSort: { field: 'created_at', direction: 'desc' },
      filters: [
        { field: 'status', label: 'Status', type: 'select' },
        { field: 'interest_categories', label: 'Interest', type: 'multiselect' },
        { field: 'preferred_state', label: 'Preferred State', type: 'select' },
      ],
      savedViews: [
        { name: 'All Customers', filters: {} },
        { name: 'VIP Customers', filters: { status: 'vip' } },
        { name: 'Active Leads', filters: { status: 'lead' } },
      ],
    },
    influencer: {
      defaultColumns: ['name', 'platform', 'handle', 'audience_size', 'commission_rate'],
      defaultSort: { field: 'audience_size', direction: 'desc' },
      filters: [
        { field: 'platform', label: 'Platform', type: 'select' },
      ],
      savedViews: [
        { name: 'All Influencers', filters: {} },
        { name: 'Instagram Influencers', filters: { platform: 'instagram' } },
        { name: 'TikTok Influencers', filters: { platform: 'tiktok' } },
      ],
    },
    booking: {
      defaultColumns: ['customer_name', 'event_date', 'partner_categories', 'total_amount', 'status'],
      defaultSort: { field: 'event_date', direction: 'asc' },
      filters: [
        { field: 'status', label: 'Status', type: 'select' },
        { field: 'partner_categories', label: 'Categories', type: 'multiselect' },
      ],
      savedViews: [
        { name: 'All Bookings', filters: {} },
        { name: 'Upcoming Events', filters: { status: ['confirmed', 'deposit_paid'] } },
        { name: 'In Progress', filters: { status: 'in_progress' } },
        { name: 'Completed', filters: { status: 'completed' } },
      ],
    },
    promo_campaign: {
      defaultColumns: ['name', 'promo_category', 'start_date', 'end_date', 'status'],
      defaultSort: { field: 'start_date', direction: 'desc' },
      filters: [
        { field: 'promo_category', label: 'Category', type: 'select' },
        { field: 'status', label: 'Status', type: 'select' },
      ],
      savedViews: [
        { name: 'All Campaigns', filters: {} },
        { name: 'Active Promos', filters: { status: 'active' } },
        { name: 'Draft Promos', filters: { status: 'draft' } },
      ],
    },
  },
};

export const FUNDING_BLUEPRINT: CRMBlueprint = {
  businessId: 'funding',
  businessSlug: 'usa-funding',
  businessName: 'USA Funding',
  enabledEntityTypes: ['client', 'funding_application', 'task', 'note', 'interaction', 'asset'],
  features: {
    showStores: false,
    showInventory: false,
    showRoutes: false,
    showBookings: false,
    showCommissions: false,
    showCalendar: false,
    showMediaVault: false,
    showWhatsApp: false,
    showTaskTemplates: true,
    showPipeline: true,
  },
  pipelines: {
    funding_application: FUNDING_APPLICATION_PIPELINE,
  },
  kpiConfig: [
    { key: 'clients', label: 'Total Clients', icon: 'Users', entityType: 'client', aggregation: 'count', variant: 'cyan', clickable: true },
    { key: 'active_apps', label: 'Active Applications', icon: 'FileText', entityType: 'funding_application', aggregation: 'count', filter: { status: ['intake', 'document_collection', 'underwriting', 'submission'] }, variant: 'amber', clickable: true },
    { key: 'funded', label: 'Funded This Month', icon: 'CheckCircle', entityType: 'funding_application', aggregation: 'count', filter: { status: 'funded' }, variant: 'green', clickable: true },
    { key: 'pending_tasks', label: 'Pending Tasks', icon: 'ClipboardList', entityType: 'task', aggregation: 'count', filter: { status: 'pending' }, variant: 'purple', clickable: true },
  ],
  entitySchemas: {
    client: {
      key: 'client',
      label: 'Client',
      labelPlural: 'Clients',
      icon: 'User',
      color: '#3b82f6',
      tableName: 'crm_clients',
      listColumns: ['legal_name', 'business_name', 'phone', 'status', 'next_follow_up_date'],
      searchableFields: ['legal_name', 'business_name', 'phone', 'email'],
      fields: [
        { key: 'legal_name', label: 'Legal Name', type: 'text', required: true, width: 'half', section: 'basic' },
        { key: 'business_name', label: 'Business Name', type: 'text', width: 'half', section: 'basic' },
        { key: 'phone', label: 'Phone', type: 'phone', required: true, width: 'half', section: 'basic' },
        { key: 'email', label: 'Email', type: 'email', width: 'half', section: 'basic' },
        { key: 'address', label: 'Address', type: 'address', width: 'full', section: 'basic' },
        { key: 'funding_goal', label: 'Funding Goal', type: 'currency', width: 'half', section: 'funding' },
        { key: 'status', label: 'Status', type: 'select', width: 'half', section: 'funding', options: [
          { value: 'intake', label: 'Intake' },
          { value: 'docs_pending', label: 'Docs Pending' },
          { value: 'submitted', label: 'Submitted' },
          { value: 'approved', label: 'Approved' },
          { value: 'funded', label: 'Funded' },
          { value: 'declined', label: 'Declined' },
        ]},
        { key: 'assigned_case_manager', label: 'Case Manager', type: 'text', width: 'half', section: 'management' },
        { key: 'next_follow_up_date', label: 'Next Follow-up', type: 'date', width: 'half', section: 'management' },
        { key: 'required_docs_status', label: 'Required Docs Status', type: 'json', width: 'full', section: 'documents' },
        { key: 'credit_notes', label: 'Credit Notes', type: 'textarea', width: 'full', section: 'notes', masked: true, maskedRoles: ['admin', 'manager'] },
      ],
    },
    funding_application: {
      key: 'funding_application',
      label: 'Application',
      labelPlural: 'Applications',
      icon: 'FileText',
      color: '#10b981',
      tableName: 'crm_funding_applications',
      listColumns: ['client_name', 'amount_requested', 'status', 'lender', 'created_at'],
      searchableFields: ['client_name', 'lender'],
      fields: [
        { key: 'client_id', label: 'Client', type: 'select', required: true, width: 'half', section: 'basic' },
        { key: 'amount_requested', label: 'Amount Requested', type: 'currency', width: 'half', section: 'basic' },
        { key: 'status', label: 'Status', type: 'select', width: 'half', section: 'basic', options: FUNDING_APPLICATION_PIPELINE.map(s => ({ value: s.value, label: s.label })) },
        { key: 'lender', label: 'Lender', type: 'text', width: 'half', section: 'lender' },
        { key: 'offer_amount', label: 'Offer Amount', type: 'currency', width: 'half', section: 'lender' },
        { key: 'terms', label: 'Terms', type: 'textarea', width: 'full', section: 'lender' },
      ],
    },
  },
  profileTabs: {
    client: [
      { key: 'overview', label: 'Overview', icon: 'User', enabled: true },
      { key: 'tasks', label: 'Checklist', icon: 'ClipboardList', enabled: true },
      { key: 'documents', label: 'Documents', icon: 'FileText', enabled: true },
      { key: 'notes', label: 'Notes', icon: 'MessageSquare', enabled: true },
      { key: 'interactions', label: 'Interactions', icon: 'Phone', enabled: true },
      { key: 'applications', label: 'Applications', icon: 'Folder', enabled: true },
    ],
  },
  listViews: {
    client: {
      defaultColumns: ['legal_name', 'business_name', 'phone', 'status', 'next_follow_up_date'],
      defaultSort: { field: 'next_follow_up_date', direction: 'asc' },
      filters: [
        { field: 'status', label: 'Status', type: 'select' },
      ],
    },
  },
};

export const UNFORGETTABLE_BLUEPRINT: CRMBlueprint = {
  businessId: 'unforgettable',
  businessSlug: 'unforgettable-times',
  businessName: 'Unforgettable Times',
  enabledEntityTypes: ['vendor', 'event_hall', 'rental_company', 'supplier', 'staff', 'customer', 'event_booking', 'task', 'note', 'interaction', 'asset'],
  features: {
    showStores: false,
    showInventory: false,
    showRoutes: false,
    showBookings: true,
    showCommissions: false,
    showCalendar: true,
    showMediaVault: false,
    showWhatsApp: false,
    showTaskTemplates: true,
    showPipeline: true,
  },
  pipelines: {
    event_booking: UNFORGETTABLE_EVENT_PIPELINE,
  },
  kpiConfig: [
    { key: 'vendors', label: 'Total Vendors', icon: 'Building', entityType: 'vendor', aggregation: 'count', variant: 'cyan', clickable: true },
    { key: 'events', label: 'Upcoming Events', icon: 'Calendar', entityType: 'event_booking', aggregation: 'count', filter: { status: ['deposit_paid', 'vendor_assigned', 'event_scheduled'] }, variant: 'amber', clickable: true },
    { key: 'staff', label: 'Staff Members', icon: 'Users', entityType: 'staff', aggregation: 'count', variant: 'purple', clickable: true },
    { key: 'completed', label: 'Events Completed', icon: 'CheckCircle', entityType: 'event_booking', aggregation: 'count', filter: { status: 'event_complete' }, variant: 'green', clickable: true },
  ],
  entitySchemas: {
    vendor: {
      key: 'vendor',
      label: 'Vendor',
      labelPlural: 'Vendors',
      icon: 'Building',
      color: '#8b5cf6',
      tableName: 'crm_vendors',
      listColumns: ['name', 'category', 'city', 'availability', 'rating'],
      searchableFields: ['name', 'city'],
      fields: [
        { key: 'name', label: 'Vendor Name', type: 'text', required: true, width: 'half', section: 'basic' },
        { key: 'category', label: 'Category', type: 'select', width: 'half', section: 'basic', options: [
          { value: 'event_hall', label: 'Event Hall' },
          { value: 'rental_company', label: 'Rental Company' },
          { value: 'party_items_supplier', label: 'Party Items Supplier' },
          { value: 'staff_vendor', label: 'Staff Vendor' },
        ]},
        { key: 'contact_name', label: 'Contact Name', type: 'text', width: 'half', section: 'contact' },
        { key: 'phone', label: 'Phone', type: 'phone', width: 'half', section: 'contact' },
        { key: 'email', label: 'Email', type: 'email', width: 'half', section: 'contact' },
        { key: 'address', label: 'Address', type: 'address', width: 'full', section: 'location' },
        { key: 'city', label: 'City', type: 'text', width: 'half', section: 'location' },
        { key: 'state', label: 'State', type: 'select', width: 'half', section: 'location', options: US_STATES },
        { key: 'availability', label: 'Availability', type: 'text', width: 'half', section: 'details' },
        { key: 'pricing_range', label: 'Pricing Range', type: 'text', width: 'half', section: 'details' },
        { key: 'rating', label: 'Rating', type: 'number', width: 'half', section: 'details' },
      ],
    },
    staff: {
      key: 'staff',
      label: 'Staff Member',
      labelPlural: 'Staff',
      icon: 'UserCog',
      color: '#f59e0b',
      tableName: 'crm_staff',
      listColumns: ['name', 'role', 'phone', 'availability', 'rate'],
      searchableFields: ['name', 'phone'],
      fields: [
        { key: 'name', label: 'Full Name', type: 'text', required: true, width: 'half', section: 'basic' },
        { key: 'role', label: 'Role', type: 'select', width: 'half', section: 'basic', options: [
          { value: 'server', label: 'Server' },
          { value: 'bartender', label: 'Bartender' },
          { value: 'dj', label: 'DJ' },
          { value: 'photographer', label: 'Photographer' },
          { value: 'videographer', label: 'Videographer' },
          { value: 'coordinator', label: 'Coordinator' },
          { value: 'security', label: 'Security' },
        ]},
        { key: 'phone', label: 'Phone', type: 'phone', width: 'half', section: 'contact' },
        { key: 'email', label: 'Email', type: 'email', width: 'half', section: 'contact' },
        { key: 'availability', label: 'Availability', type: 'text', width: 'half', section: 'work' },
        { key: 'rate', label: 'Hourly Rate', type: 'currency', width: 'half', section: 'work' },
      ],
    },
    event_booking: {
      key: 'event_booking',
      label: 'Event Booking',
      labelPlural: 'Event Bookings',
      icon: 'Calendar',
      color: '#10b981',
      tableName: 'crm_event_bookings',
      listColumns: ['client_name', 'event_type', 'event_date', 'guest_count', 'status'],
      searchableFields: ['client_name', 'event_type'],
      fields: [
        { key: 'client_id', label: 'Client', type: 'select', required: true, width: 'half', section: 'basic' },
        { key: 'event_type', label: 'Event Type', type: 'select', width: 'half', section: 'basic', options: [
          { value: 'birthday', label: 'Birthday Party' },
          { value: 'wedding', label: 'Wedding' },
          { value: 'corporate', label: 'Corporate Event' },
          { value: 'baby_shower', label: 'Baby Shower' },
          { value: 'graduation', label: 'Graduation' },
          { value: 'other', label: 'Other' },
        ]},
        { key: 'event_date', label: 'Event Date', type: 'datetime', width: 'half', section: 'details' },
        { key: 'guest_count', label: 'Guest Count', type: 'number', width: 'half', section: 'details' },
        { key: 'location', label: 'Location', type: 'text', width: 'full', section: 'details' },
        { key: 'budget', label: 'Budget', type: 'currency', width: 'half', section: 'financial' },
        { key: 'deposit_paid', label: 'Deposit Paid', type: 'currency', width: 'half', section: 'financial' },
        { key: 'status', label: 'Status', type: 'select', width: 'half', section: 'status', options: UNFORGETTABLE_EVENT_PIPELINE.map(s => ({ value: s.value, label: s.label })) },
        { key: 'vendors_linked', label: 'Linked Vendors', type: 'multiselect', width: 'full', section: 'vendors' },
        { key: 'staff_assigned', label: 'Assigned Staff', type: 'multiselect', width: 'full', section: 'staff' },
      ],
    },
  },
  profileTabs: {
    vendor: [
      { key: 'overview', label: 'Overview', icon: 'Building', enabled: true },
      { key: 'events', label: 'Events', icon: 'Calendar', enabled: true },
      { key: 'notes', label: 'Notes', icon: 'FileText', enabled: true },
      { key: 'contracts', label: 'Contracts', icon: 'File', enabled: true },
    ],
    event_booking: [
      { key: 'overview', label: 'Overview', icon: 'Calendar', enabled: true },
      { key: 'vendors', label: 'Vendors', icon: 'Building', enabled: true },
      { key: 'staff', label: 'Staff', icon: 'Users', enabled: true },
      { key: 'checklist', label: 'Checklist', icon: 'ClipboardList', enabled: true },
      { key: 'notes', label: 'Notes', icon: 'FileText', enabled: true },
    ],
  },
  listViews: {
    vendor: {
      defaultColumns: ['name', 'category', 'city', 'availability', 'rating'],
      defaultSort: { field: 'name', direction: 'asc' },
      filters: [
        { field: 'category', label: 'Category', type: 'select' },
        { field: 'state', label: 'State', type: 'select' },
      ],
    },
    event_booking: {
      defaultColumns: ['client_name', 'event_type', 'event_date', 'guest_count', 'status'],
      defaultSort: { field: 'event_date', direction: 'asc' },
      filters: [
        { field: 'status', label: 'Status', type: 'select' },
        { field: 'event_type', label: 'Event Type', type: 'select' },
      ],
    },
  },
};

export const PLAYBOXXX_BLUEPRINT: CRMBlueprint = {
  businessId: 'playboxxx',
  businessSlug: 'the-playboxxx',
  businessName: 'The PlayBoxxx',
  enabledEntityTypes: ['model', 'influencer', 'supplier', 'collab', 'interaction', 'task', 'note', 'asset', 'media'],
  features: {
    showStores: false,
    showInventory: false,
    showRoutes: false,
    showBookings: true,
    showCommissions: true,
    showCalendar: false,
    showMediaVault: true,
    showWhatsApp: true,
    showTaskTemplates: false,
    showPipeline: true,
  },
  pipelines: {
    model: PLAYBOXXX_MODEL_PIPELINE,
  },
  kpiConfig: [
    { key: 'models', label: 'Total Models', icon: 'Users', entityType: 'model', aggregation: 'count', variant: 'pink' as any, clickable: true },
    { key: 'active', label: 'Active Models', icon: 'UserCheck', entityType: 'model', aggregation: 'count', filter: { status: 'active' }, variant: 'green', clickable: true },
    { key: 'featured', label: 'Featured', icon: 'Star', entityType: 'model', aggregation: 'count', filter: { status: 'featured' }, variant: 'amber', clickable: true },
    { key: 'collabs', label: 'Active Collabs', icon: 'Briefcase', entityType: 'collab', aggregation: 'count', filter: { status: 'active' }, variant: 'purple', clickable: true },
  ],
  entitySchemas: {
    model: {
      key: 'model',
      label: 'Model',
      labelPlural: 'Models',
      icon: 'User',
      color: '#ec4899',
      tableName: 'crm_models',
      listColumns: ['stage_name', 'country', 'city', 'status', 'verification_status'],
      searchableFields: ['stage_name', 'country', 'city'],
      fields: [
        { key: 'stage_name', label: 'Stage Name', type: 'text', required: true, width: 'half', section: 'basic' },
        { key: 'real_name', label: 'Real Name', type: 'text', width: 'half', section: 'basic', masked: true, maskedRoles: ['admin'] },
        { key: 'country', label: 'Country', type: 'text', width: 'half', section: 'location' },
        { key: 'city', label: 'City', type: 'text', width: 'half', section: 'location' },
        { key: 'languages', label: 'Languages', type: 'multiselect', width: 'full', section: 'location', options: [
          { value: 'english', label: 'English' },
          { value: 'spanish', label: 'Spanish' },
          { value: 'portuguese', label: 'Portuguese' },
          { value: 'french', label: 'French' },
          { value: 'russian', label: 'Russian' },
          { value: 'other', label: 'Other' },
        ]},
        { key: 'whatsapp_number', label: 'WhatsApp Number', type: 'phone', required: true, width: 'half', section: 'contact' },
        { key: 'social_handles', label: 'Social Handles', type: 'json', width: 'full', section: 'contact', helpText: 'Instagram, Twitter, OnlyFans, etc.' },
        { key: 'content_categories', label: 'Content Categories', type: 'multiselect', width: 'full', section: 'content' },
        { key: 'availability', label: 'Availability', type: 'text', width: 'half', section: 'work' },
        { key: 'rates', label: 'Rates', type: 'text', width: 'half', section: 'work' },
        { key: 'verification_status', label: 'Verification Status', type: 'select', width: 'half', section: 'status', options: [
          { value: 'pending', label: 'Pending' },
          { value: 'verified', label: 'Verified' },
          { value: 'rejected', label: 'Rejected' },
        ]},
        { key: 'contract_status', label: 'Contract Status', type: 'select', width: 'half', section: 'status', options: [
          { value: 'none', label: 'None' },
          { value: 'pending', label: 'Pending' },
          { value: 'signed', label: 'Signed' },
          { value: 'expired', label: 'Expired' },
        ]},
        { key: 'status', label: 'Lifecycle Status', type: 'select', width: 'half', section: 'status', options: PLAYBOXXX_MODEL_PIPELINE.map(s => ({ value: s.value, label: s.label })) },
        { key: 'payout_method', label: 'Payout Method', type: 'select', width: 'half', section: 'financial', options: [
          { value: 'crypto', label: 'Crypto' },
          { value: 'wire', label: 'Wire Transfer' },
          { value: 'paypal', label: 'PayPal' },
          { value: 'other', label: 'Other' },
        ]},
        { key: 'internal_risk_flags', label: 'Risk Flags', type: 'textarea', width: 'full', section: 'admin', masked: true, maskedRoles: ['admin'] },
      ],
    },
    collab: {
      key: 'collab',
      label: 'Collaboration',
      labelPlural: 'Collaborations',
      icon: 'Briefcase',
      color: '#8b5cf6',
      tableName: 'crm_collabs',
      listColumns: ['model_name', 'type', 'start_date', 'status', 'revenue'],
      searchableFields: ['model_name', 'type'],
      fields: [
        { key: 'model_id', label: 'Model', type: 'select', required: true, width: 'half', section: 'basic' },
        { key: 'type', label: 'Collaboration Type', type: 'select', width: 'half', section: 'basic', options: [
          { value: 'content', label: 'Content Creation' },
          { value: 'promo', label: 'Promotion' },
          { value: 'exclusive', label: 'Exclusive Contract' },
          { value: 'one_time', label: 'One-Time' },
        ]},
        { key: 'start_date', label: 'Start Date', type: 'date', width: 'half', section: 'dates' },
        { key: 'end_date', label: 'End Date', type: 'date', width: 'half', section: 'dates' },
        { key: 'revenue', label: 'Revenue', type: 'currency', width: 'half', section: 'financial' },
        { key: 'payout', label: 'Model Payout', type: 'currency', width: 'half', section: 'financial' },
        { key: 'status', label: 'Status', type: 'select', width: 'half', section: 'status', options: [
          { value: 'pending', label: 'Pending' },
          { value: 'active', label: 'Active' },
          { value: 'completed', label: 'Completed' },
          { value: 'cancelled', label: 'Cancelled' },
        ]},
      ],
    },
  },
  profileTabs: {
    model: [
      { key: 'overview', label: 'Overview', icon: 'User', enabled: true },
      { key: 'whatsapp', label: 'WhatsApp', icon: 'MessageCircle', enabled: true, component: 'WhatsAppTimeline' },
      { key: 'media', label: 'Media Vault', icon: 'Image', enabled: true, component: 'MediaVault' },
      { key: 'contracts', label: 'Contracts', icon: 'FileText', enabled: true },
      { key: 'collabs', label: 'Collabs', icon: 'Briefcase', enabled: true },
      { key: 'notes', label: 'Notes', icon: 'MessageSquare', enabled: true },
    ],
  },
  listViews: {
    model: {
      defaultColumns: ['stage_name', 'country', 'city', 'status', 'verification_status'],
      defaultSort: { field: 'created_at', direction: 'desc' },
      filters: [
        { field: 'status', label: 'Status', type: 'select' },
        { field: 'verification_status', label: 'Verification', type: 'select' },
        { field: 'country', label: 'Country', type: 'text' },
      ],
    },
    collab: {
      defaultColumns: ['model_name', 'type', 'start_date', 'status', 'revenue'],
      defaultSort: { field: 'start_date', direction: 'desc' },
      filters: [
        { field: 'status', label: 'Status', type: 'select' },
        { field: 'type', label: 'Type', type: 'select' },
      ],
    },
  },
};

// ============================================
// BLUEPRINT REGISTRY
// ============================================
export const CRM_BLUEPRINTS: Record<string, CRMBlueprint> = {
  'toptier-experience': TOPTIER_BLUEPRINT,
  'usa-funding': FUNDING_BLUEPRINT,
  'unforgettable-times': UNFORGETTABLE_BLUEPRINT,
  'the-playboxxx': PLAYBOXXX_BLUEPRINT,
};

export function getCRMBlueprint(businessSlug: string): CRMBlueprint | null {
  return CRM_BLUEPRINTS[businessSlug] || null;
}

export function getDefaultBlueprint(): CRMBlueprint {
  return {
    businessId: 'default',
    businessSlug: 'default',
    businessName: 'General CRM',
    enabledEntityTypes: ['customer', 'task', 'note', 'interaction'],
    features: {
      showStores: true,
      showInventory: false,
      showRoutes: false,
      showBookings: false,
      showCommissions: false,
      showCalendar: false,
      showMediaVault: false,
      showWhatsApp: false,
      showTaskTemplates: false,
      showPipeline: false,
    },
    pipelines: {},
    kpiConfig: [
      { key: 'customers', label: 'Customers', icon: 'Users', entityType: 'customer', aggregation: 'count', variant: 'cyan', clickable: true },
    ],
    entitySchemas: {},
    profileTabs: {},
    listViews: {},
  };
}
