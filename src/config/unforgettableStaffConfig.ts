/**
 * Unforgettable Times Staff Configuration
 * Complete role hierarchy, categories, and metadata for event staff management
 */

import { 
  Crown, Briefcase, Calendar, Users, Building2, Truck, Package, 
  Music, Mic2, UtensilsCrossed, Wine, Shield, Car, Camera, 
  Video, DollarSign, FileText, Megaphone, Smartphone, Headphones,
  type LucideIcon 
} from 'lucide-react';

// Staff Role Type
export type UTStaffRole = 
  // Core Leadership
  | 'owner_managing_director'
  | 'operations_director'
  | 'event_production_manager'
  // Event Planning & Client Experience
  | 'event_coordinator_lead'
  | 'event_coordinator_assistant'
  | 'client_success_manager'
  // Venue & Partner Management
  | 'venue_relations_manager'
  | 'vendor_relations_manager'
  | 'partner_onboarding_specialist'
  // Rentals & Party Inventory
  | 'rental_operations_manager'
  | 'inventory_coordinator'
  | 'setup_crew_lead'
  | 'setup_crew_member'
  // Entertainment & Experience
  | 'dj_coordinator'
  | 'dj'
  | 'mc_host'
  | 'live_performer'
  // Food & Bar Services
  | 'catering_coordinator'
  | 'bartending_manager'
  | 'bartender'
  | 'server'
  // Security & Safety
  | 'security_coordinator'
  | 'security_guard'
  | 'event_safety_supervisor'
  // Logistics & Transport
  | 'logistics_manager'
  | 'driver'
  | 'loader_runner'
  // Media & Content
  | 'photography_coordinator'
  | 'photographer'
  | 'videographer'
  | 'content_editor'
  // Admin, Finance & Support
  | 'finance_manager'
  | 'accounts_payable_receivable'
  | 'contracts_compliance_admin'
  | 'crm_data_manager'
  // Marketing & Growth
  | 'marketing_manager'
  | 'social_media_manager'
  | 'influencer_ambassador_coordinator'
  // Virtual & Remote Support
  | 'virtual_assistant'
  | 'customer_support_rep';

export type UTStaffCategory = 'internal_staff' | 'event_staff' | 'vendor' | 'partner';
export type UTEmploymentType = 'full_time' | 'part_time' | 'contractor' | '1099_hourly' | 'per_event';
export type UTStaffStatus = 'active' | 'inactive' | 'pending' | 'on_leave' | 'terminated';

// Department groupings for organizational structure
export interface StaffDepartment {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  roles: UTStaffRole[];
}

export const STAFF_DEPARTMENTS: StaffDepartment[] = [
  {
    id: 'leadership',
    name: 'Core Leadership',
    description: 'Executive team driving vision and operations',
    icon: Crown,
    color: 'text-amber-500',
    roles: ['owner_managing_director', 'operations_director', 'event_production_manager']
  },
  {
    id: 'event_planning',
    name: 'Event Planning & Client Experience',
    description: 'Client-facing planners and coordinators',
    icon: Calendar,
    color: 'text-pink-500',
    roles: ['event_coordinator_lead', 'event_coordinator_assistant', 'client_success_manager']
  },
  {
    id: 'venue_partner',
    name: 'Venue & Partner Management',
    description: 'Venue and vendor relationship managers',
    icon: Building2,
    color: 'text-purple-500',
    roles: ['venue_relations_manager', 'vendor_relations_manager', 'partner_onboarding_specialist']
  },
  {
    id: 'rentals',
    name: 'Rentals & Party Inventory',
    description: 'Equipment and inventory management',
    icon: Package,
    color: 'text-blue-500',
    roles: ['rental_operations_manager', 'inventory_coordinator', 'setup_crew_lead', 'setup_crew_member']
  },
  {
    id: 'entertainment',
    name: 'Entertainment & Experience',
    description: 'DJs, MCs, and live performers',
    icon: Music,
    color: 'text-violet-500',
    roles: ['dj_coordinator', 'dj', 'mc_host', 'live_performer']
  },
  {
    id: 'food_bar',
    name: 'Food & Bar Services',
    description: 'Catering and beverage service teams',
    icon: UtensilsCrossed,
    color: 'text-orange-500',
    roles: ['catering_coordinator', 'bartending_manager', 'bartender', 'server']
  },
  {
    id: 'security',
    name: 'Security & Safety',
    description: 'Event security and safety personnel',
    icon: Shield,
    color: 'text-red-500',
    roles: ['security_coordinator', 'security_guard', 'event_safety_supervisor']
  },
  {
    id: 'logistics',
    name: 'Logistics & Transport',
    description: 'Equipment transport and on-site support',
    icon: Truck,
    color: 'text-emerald-500',
    roles: ['logistics_manager', 'driver', 'loader_runner']
  },
  {
    id: 'media',
    name: 'Media & Content',
    description: 'Photography, video, and post-production',
    icon: Camera,
    color: 'text-cyan-500',
    roles: ['photography_coordinator', 'photographer', 'videographer', 'content_editor']
  },
  {
    id: 'admin_finance',
    name: 'Admin, Finance & Support',
    description: 'Finance, contracts, and data management',
    icon: DollarSign,
    color: 'text-green-500',
    roles: ['finance_manager', 'accounts_payable_receivable', 'contracts_compliance_admin', 'crm_data_manager']
  },
  {
    id: 'marketing',
    name: 'Marketing & Growth',
    description: 'Marketing, social media, and partnerships',
    icon: Megaphone,
    color: 'text-rose-500',
    roles: ['marketing_manager', 'social_media_manager', 'influencer_ambassador_coordinator']
  },
  {
    id: 'remote_support',
    name: 'Virtual & Remote Support',
    description: 'VAs and customer support representatives',
    icon: Headphones,
    color: 'text-indigo-500',
    roles: ['virtual_assistant', 'customer_support_rep']
  }
];

// Role metadata with display names, descriptions, and typical pay
export interface StaffRoleInfo {
  role: UTStaffRole;
  displayName: string;
  shortName: string;
  description: string;
  department: string;
  defaultCategory: UTStaffCategory;
  defaultEmploymentType: UTEmploymentType;
  typicalHourlyRate?: { min: number; max: number };
  typicalEventRate?: { min: number; max: number };
  requiredCertifications?: string[];
  icon: LucideIcon;
}

export const STAFF_ROLES: Record<UTStaffRole, StaffRoleInfo> = {
  // Core Leadership
  owner_managing_director: {
    role: 'owner_managing_director',
    displayName: 'Owner / Managing Director',
    shortName: 'Owner',
    description: 'Vision, partnerships, pricing authority, final approvals',
    department: 'leadership',
    defaultCategory: 'internal_staff',
    defaultEmploymentType: 'full_time',
    icon: Crown
  },
  operations_director: {
    role: 'operations_director',
    displayName: 'Operations Director',
    shortName: 'Ops Director',
    description: 'Runs day-to-day execution, staff coordination, vendor alignment',
    department: 'leadership',
    defaultCategory: 'internal_staff',
    defaultEmploymentType: 'full_time',
    icon: Briefcase
  },
  event_production_manager: {
    role: 'event_production_manager',
    displayName: 'Event Production Manager',
    shortName: 'Production Mgr',
    description: 'Oversees every event from booking → teardown',
    department: 'leadership',
    defaultCategory: 'internal_staff',
    defaultEmploymentType: 'full_time',
    icon: Calendar
  },

  // Event Planning & Client Experience
  event_coordinator_lead: {
    role: 'event_coordinator_lead',
    displayName: 'Event Coordinator (Lead Planner)',
    shortName: 'Lead Coordinator',
    description: 'Main client contact, timeline creation, vendor coordination',
    department: 'event_planning',
    defaultCategory: 'internal_staff',
    defaultEmploymentType: 'full_time',
    typicalHourlyRate: { min: 25, max: 45 },
    icon: Calendar
  },
  event_coordinator_assistant: {
    role: 'event_coordinator_assistant',
    displayName: 'Assistant Event Coordinator',
    shortName: 'Asst Coordinator',
    description: 'Supports multiple events, vendor check-ins, on-site execution',
    department: 'event_planning',
    defaultCategory: 'internal_staff',
    defaultEmploymentType: 'full_time',
    typicalHourlyRate: { min: 18, max: 28 },
    icon: Users
  },
  client_success_manager: {
    role: 'client_success_manager',
    displayName: 'Client Success / Booking Manager',
    shortName: 'Client Success',
    description: 'Handles inbound inquiries, converts leads, upsells packages',
    department: 'event_planning',
    defaultCategory: 'internal_staff',
    defaultEmploymentType: 'full_time',
    typicalHourlyRate: { min: 22, max: 38 },
    icon: Users
  },

  // Venue & Partner Management
  venue_relations_manager: {
    role: 'venue_relations_manager',
    displayName: 'Venue Relations Manager',
    shortName: 'Venue Manager',
    description: 'Manages event halls & spaces, negotiates rates & availability',
    department: 'venue_partner',
    defaultCategory: 'internal_staff',
    defaultEmploymentType: 'full_time',
    typicalHourlyRate: { min: 25, max: 40 },
    icon: Building2
  },
  vendor_relations_manager: {
    role: 'vendor_relations_manager',
    displayName: 'Vendor Relations Manager',
    shortName: 'Vendor Manager',
    description: 'Manages rental companies, party item suppliers, staff agencies',
    department: 'venue_partner',
    defaultCategory: 'internal_staff',
    defaultEmploymentType: 'full_time',
    typicalHourlyRate: { min: 25, max: 40 },
    icon: Users
  },
  partner_onboarding_specialist: {
    role: 'partner_onboarding_specialist',
    displayName: 'Partner Onboarding Specialist',
    shortName: 'Partner Specialist',
    description: 'Adds new halls, vendors, suppliers into CRM, verifies documents & pricing',
    department: 'venue_partner',
    defaultCategory: 'internal_staff',
    defaultEmploymentType: 'full_time',
    typicalHourlyRate: { min: 20, max: 32 },
    icon: FileText
  },

  // Rentals & Party Inventory
  rental_operations_manager: {
    role: 'rental_operations_manager',
    displayName: 'Rental Operations Manager',
    shortName: 'Rental Ops Mgr',
    description: 'Manages inventory across vendors, ensures availability',
    department: 'rentals',
    defaultCategory: 'internal_staff',
    defaultEmploymentType: 'full_time',
    typicalHourlyRate: { min: 22, max: 35 },
    icon: Package
  },
  inventory_coordinator: {
    role: 'inventory_coordinator',
    displayName: 'Inventory Coordinator',
    shortName: 'Inventory Coord',
    description: 'Tracks chairs, tables, decor, props; handles shortages & replacements',
    department: 'rentals',
    defaultCategory: 'internal_staff',
    defaultEmploymentType: 'full_time',
    typicalHourlyRate: { min: 18, max: 26 },
    icon: Package
  },
  setup_crew_lead: {
    role: 'setup_crew_lead',
    displayName: 'Setup & Breakdown Crew Lead',
    shortName: 'Crew Lead',
    description: 'Oversees physical setup/teardown',
    department: 'rentals',
    defaultCategory: 'event_staff',
    defaultEmploymentType: 'contractor',
    typicalHourlyRate: { min: 20, max: 30 },
    typicalEventRate: { min: 150, max: 300 },
    icon: Truck
  },
  setup_crew_member: {
    role: 'setup_crew_member',
    displayName: 'Setup & Breakdown Crew',
    shortName: 'Crew Member',
    description: 'Chairs, tables, decor installs; load-in / load-out',
    department: 'rentals',
    defaultCategory: 'event_staff',
    defaultEmploymentType: '1099_hourly',
    typicalHourlyRate: { min: 15, max: 22 },
    typicalEventRate: { min: 100, max: 200 },
    icon: Package
  },

  // Entertainment & Experience
  dj_coordinator: {
    role: 'dj_coordinator',
    displayName: 'DJ Coordinator',
    shortName: 'DJ Coord',
    description: 'Books DJs, manages music requirements',
    department: 'entertainment',
    defaultCategory: 'internal_staff',
    defaultEmploymentType: 'full_time',
    typicalHourlyRate: { min: 20, max: 32 },
    icon: Music
  },
  dj: {
    role: 'dj',
    displayName: 'DJ',
    shortName: 'DJ',
    description: 'Event entertainment - music and mixing',
    department: 'entertainment',
    defaultCategory: 'event_staff',
    defaultEmploymentType: 'per_event',
    typicalEventRate: { min: 300, max: 1500 },
    icon: Music
  },
  mc_host: {
    role: 'mc_host',
    displayName: 'MC / Host',
    shortName: 'MC',
    description: 'Crowd engagement, event hosting',
    department: 'entertainment',
    defaultCategory: 'event_staff',
    defaultEmploymentType: 'per_event',
    typicalEventRate: { min: 200, max: 800 },
    icon: Mic2
  },
  live_performer: {
    role: 'live_performer',
    displayName: 'Live Performer',
    shortName: 'Performer',
    description: 'Dancers, musicians, specialty acts',
    department: 'entertainment',
    defaultCategory: 'event_staff',
    defaultEmploymentType: 'per_event',
    typicalEventRate: { min: 150, max: 2000 },
    icon: Music
  },

  // Food & Bar Services
  catering_coordinator: {
    role: 'catering_coordinator',
    displayName: 'Catering Coordinator',
    shortName: 'Catering Coord',
    description: 'Manages caterers & menus',
    department: 'food_bar',
    defaultCategory: 'internal_staff',
    defaultEmploymentType: 'full_time',
    typicalHourlyRate: { min: 20, max: 32 },
    icon: UtensilsCrossed
  },
  bartending_manager: {
    role: 'bartending_manager',
    displayName: 'Bartending Manager',
    shortName: 'Bar Manager',
    description: 'Books bartenders, ensures compliance',
    department: 'food_bar',
    defaultCategory: 'internal_staff',
    defaultEmploymentType: 'full_time',
    typicalHourlyRate: { min: 22, max: 35 },
    requiredCertifications: ['TIPS Certification', 'Food Handler'],
    icon: Wine
  },
  bartender: {
    role: 'bartender',
    displayName: 'Bartender',
    shortName: 'Bartender',
    description: 'Licensed bartender for events',
    department: 'food_bar',
    defaultCategory: 'event_staff',
    defaultEmploymentType: '1099_hourly',
    typicalHourlyRate: { min: 20, max: 35 },
    typicalEventRate: { min: 150, max: 350 },
    requiredCertifications: ['TIPS Certification'],
    icon: Wine
  },
  server: {
    role: 'server',
    displayName: 'Server / Wait Staff',
    shortName: 'Server',
    description: 'Food and beverage service',
    department: 'food_bar',
    defaultCategory: 'event_staff',
    defaultEmploymentType: '1099_hourly',
    typicalHourlyRate: { min: 15, max: 25 },
    typicalEventRate: { min: 100, max: 200 },
    icon: UtensilsCrossed
  },

  // Security & Safety
  security_coordinator: {
    role: 'security_coordinator',
    displayName: 'Security Coordinator',
    shortName: 'Security Coord',
    description: 'Books security staff, ensures venue requirements met',
    department: 'security',
    defaultCategory: 'internal_staff',
    defaultEmploymentType: 'full_time',
    typicalHourlyRate: { min: 22, max: 35 },
    icon: Shield
  },
  security_guard: {
    role: 'security_guard',
    displayName: 'Security Guard',
    shortName: 'Security',
    description: 'Event security and crowd control',
    department: 'security',
    defaultCategory: 'event_staff',
    defaultEmploymentType: '1099_hourly',
    typicalHourlyRate: { min: 18, max: 30 },
    typicalEventRate: { min: 150, max: 300 },
    requiredCertifications: ['Security License'],
    icon: Shield
  },
  event_safety_supervisor: {
    role: 'event_safety_supervisor',
    displayName: 'Event Safety Supervisor',
    shortName: 'Safety Super',
    description: 'Crowd flow, emergency procedures',
    department: 'security',
    defaultCategory: 'event_staff',
    defaultEmploymentType: 'contractor',
    typicalHourlyRate: { min: 25, max: 40 },
    requiredCertifications: ['CPR/First Aid', 'Fire Safety'],
    icon: Shield
  },

  // Logistics & Transport
  logistics_manager: {
    role: 'logistics_manager',
    displayName: 'Logistics Manager',
    shortName: 'Logistics Mgr',
    description: 'Scheduling, transport timing',
    department: 'logistics',
    defaultCategory: 'internal_staff',
    defaultEmploymentType: 'full_time',
    typicalHourlyRate: { min: 22, max: 35 },
    icon: Truck
  },
  driver: {
    role: 'driver',
    displayName: 'Driver',
    shortName: 'Driver',
    description: 'Equipment transport (vans / box trucks)',
    department: 'logistics',
    defaultCategory: 'event_staff',
    defaultEmploymentType: '1099_hourly',
    typicalHourlyRate: { min: 18, max: 28 },
    requiredCertifications: ['Valid Driver License', 'CDL (for large vehicles)'],
    icon: Car
  },
  loader_runner: {
    role: 'loader_runner',
    displayName: 'Loader / Runner',
    shortName: 'Runner',
    description: 'On-site support, loading/unloading',
    department: 'logistics',
    defaultCategory: 'event_staff',
    defaultEmploymentType: '1099_hourly',
    typicalHourlyRate: { min: 15, max: 22 },
    icon: Package
  },

  // Media & Content
  photography_coordinator: {
    role: 'photography_coordinator',
    displayName: 'Photography Coordinator',
    shortName: 'Photo Coord',
    description: 'Books photographers for events',
    department: 'media',
    defaultCategory: 'internal_staff',
    defaultEmploymentType: 'full_time',
    typicalHourlyRate: { min: 20, max: 32 },
    icon: Camera
  },
  photographer: {
    role: 'photographer',
    displayName: 'Photographer',
    shortName: 'Photographer',
    description: 'Event photography',
    department: 'media',
    defaultCategory: 'event_staff',
    defaultEmploymentType: 'per_event',
    typicalEventRate: { min: 300, max: 1200 },
    icon: Camera
  },
  videographer: {
    role: 'videographer',
    displayName: 'Videographer',
    shortName: 'Videographer',
    description: 'Event video coverage',
    department: 'media',
    defaultCategory: 'event_staff',
    defaultEmploymentType: 'per_event',
    typicalEventRate: { min: 400, max: 1500 },
    icon: Video
  },
  content_editor: {
    role: 'content_editor',
    displayName: 'Content Editor',
    shortName: 'Editor',
    description: 'Post-event photo and video editing',
    department: 'media',
    defaultCategory: 'event_staff',
    defaultEmploymentType: 'contractor',
    typicalHourlyRate: { min: 25, max: 50 },
    icon: Video
  },

  // Admin, Finance & Support
  finance_manager: {
    role: 'finance_manager',
    displayName: 'Finance & Payments Manager',
    shortName: 'Finance Mgr',
    description: 'Vendor payouts, client invoices',
    department: 'admin_finance',
    defaultCategory: 'internal_staff',
    defaultEmploymentType: 'full_time',
    typicalHourlyRate: { min: 28, max: 50 },
    icon: DollarSign
  },
  accounts_payable_receivable: {
    role: 'accounts_payable_receivable',
    displayName: 'Accounts Payable / Receivable',
    shortName: 'AP/AR',
    description: 'Payment processing and collections',
    department: 'admin_finance',
    defaultCategory: 'internal_staff',
    defaultEmploymentType: 'full_time',
    typicalHourlyRate: { min: 20, max: 35 },
    icon: DollarSign
  },
  contracts_compliance_admin: {
    role: 'contracts_compliance_admin',
    displayName: 'Contracts & Compliance Admin',
    shortName: 'Contracts Admin',
    description: 'Insurance, permits, vendor agreements',
    department: 'admin_finance',
    defaultCategory: 'internal_staff',
    defaultEmploymentType: 'full_time',
    typicalHourlyRate: { min: 22, max: 38 },
    icon: FileText
  },
  crm_data_manager: {
    role: 'crm_data_manager',
    displayName: 'CRM / Data Manager',
    shortName: 'CRM Manager',
    description: 'Keeps CRM clean, updates events, vendors, staff',
    department: 'admin_finance',
    defaultCategory: 'internal_staff',
    defaultEmploymentType: 'full_time',
    typicalHourlyRate: { min: 20, max: 35 },
    icon: FileText
  },

  // Marketing & Growth
  marketing_manager: {
    role: 'marketing_manager',
    displayName: 'Marketing Manager',
    shortName: 'Marketing Mgr',
    description: 'Social media, promotions, partnerships',
    department: 'marketing',
    defaultCategory: 'internal_staff',
    defaultEmploymentType: 'full_time',
    typicalHourlyRate: { min: 25, max: 45 },
    icon: Megaphone
  },
  social_media_manager: {
    role: 'social_media_manager',
    displayName: 'Social Media Manager',
    shortName: 'Social Media',
    description: 'Content creation and social media management',
    department: 'marketing',
    defaultCategory: 'internal_staff',
    defaultEmploymentType: 'full_time',
    typicalHourlyRate: { min: 20, max: 38 },
    icon: Smartphone
  },
  influencer_ambassador_coordinator: {
    role: 'influencer_ambassador_coordinator',
    displayName: 'Influencer / Ambassador Coordinator',
    shortName: 'Influencer Coord',
    description: 'Manages influencer partnerships and brand ambassadors',
    department: 'marketing',
    defaultCategory: 'internal_staff',
    defaultEmploymentType: 'full_time',
    typicalHourlyRate: { min: 22, max: 38 },
    icon: Users
  },

  // Virtual & Remote Support
  virtual_assistant: {
    role: 'virtual_assistant',
    displayName: 'Virtual Assistant',
    shortName: 'VA',
    description: 'CRM updates, booking confirmations, vendor follow-ups',
    department: 'remote_support',
    defaultCategory: 'internal_staff',
    defaultEmploymentType: 'contractor',
    typicalHourlyRate: { min: 15, max: 28 },
    icon: Headphones
  },
  customer_support_rep: {
    role: 'customer_support_rep',
    displayName: 'Customer Support Rep',
    shortName: 'Support Rep',
    description: 'Calls, texts, emails - customer communication',
    department: 'remote_support',
    defaultCategory: 'internal_staff',
    defaultEmploymentType: 'full_time',
    typicalHourlyRate: { min: 16, max: 26 },
    icon: Headphones
  }
};

// Staff Category Metadata
export const STAFF_CATEGORIES: Record<UTStaffCategory, { displayName: string; description: string; color: string }> = {
  internal_staff: {
    displayName: 'Internal Staff',
    description: 'Full-time employees and managers',
    color: 'bg-blue-500'
  },
  event_staff: {
    displayName: 'Event Staff',
    description: 'DJs, bartenders, setup crew, per-event workers',
    color: 'bg-purple-500'
  },
  vendor: {
    displayName: 'Vendors',
    description: 'Event halls, rental companies, suppliers',
    color: 'bg-amber-500'
  },
  partner: {
    displayName: 'Partners',
    description: 'Preferred long-term vendors with special agreements',
    color: 'bg-emerald-500'
  }
};

// Employment Type Metadata
export const EMPLOYMENT_TYPES: Record<UTEmploymentType, { displayName: string; description: string }> = {
  full_time: { displayName: 'Full-Time', description: 'W-2 employee, 40+ hours/week' },
  part_time: { displayName: 'Part-Time', description: 'W-2 employee, <40 hours/week' },
  contractor: { displayName: 'Contractor', description: '1099 independent contractor' },
  '1099_hourly': { displayName: '1099 Hourly', description: 'Hourly pay per assignment' },
  per_event: { displayName: 'Per Event', description: 'Flat rate per event' }
};

// Staff Status Metadata
export const STAFF_STATUSES: Record<UTStaffStatus, { displayName: string; color: string }> = {
  active: { displayName: 'Active', color: 'bg-emerald-500' },
  inactive: { displayName: 'Inactive', color: 'bg-gray-500' },
  pending: { displayName: 'Pending', color: 'bg-amber-500' },
  on_leave: { displayName: 'On Leave', color: 'bg-blue-500' },
  terminated: { displayName: 'Terminated', color: 'bg-red-500' }
};

// Helper functions
export function getRoleDisplayName(role: UTStaffRole): string {
  return STAFF_ROLES[role]?.displayName || role;
}

export function getRoleShortName(role: UTStaffRole): string {
  return STAFF_ROLES[role]?.shortName || role;
}

export function getDepartmentForRole(role: UTStaffRole): StaffDepartment | undefined {
  const roleInfo = STAFF_ROLES[role];
  if (!roleInfo) return undefined;
  return STAFF_DEPARTMENTS.find(d => d.id === roleInfo.department);
}

export function getRolesByCategory(category: UTStaffCategory): UTStaffRole[] {
  return Object.values(STAFF_ROLES)
    .filter(r => r.defaultCategory === category)
    .map(r => r.role);
}

export function getRolesByDepartment(departmentId: string): UTStaffRole[] {
  const dept = STAFF_DEPARTMENTS.find(d => d.id === departmentId);
  return dept?.roles || [];
}

export function isLeadershipRole(role: UTStaffRole): boolean {
  return ['owner_managing_director', 'operations_director', 'event_production_manager'].includes(role);
}

export function isEventStaffRole(role: UTStaffRole): boolean {
  return STAFF_ROLES[role]?.defaultCategory === 'event_staff';
}
