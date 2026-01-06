/**
 * CORE SIMULATION DATA
 * 
 * Demo data for stores, products, routes, and dashboard KPIs.
 * Used when simulation mode is ON and no real data exists.
 */

export interface SimulatedStore {
  id: string;
  name: string;
  type: string;
  address_street: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  phone: string;
  status: string;
  tags: string[];
  sells_flowers: boolean;
  sticker_status: string;
  sticker_door: boolean;
  sticker_instore: boolean;
  sticker_phone: boolean;
  payment_type: string | null;
  contacts: SimulatedContact[];
  tubeInventory: SimulatedTubeInventory[];
}

export interface SimulatedContact {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  can_receive_sms: boolean | null;
  is_primary: boolean | null;
}

export interface SimulatedTubeInventory {
  id: string;
  brand: string;
  current_tubes_left: number | null;
}

export interface SimulatedDashboardStats {
  activeStores: number;
  totalStores: number;
  totalProducts: number;
  activeRoutes: number;
}

// Demo stores for simulation mode
export const SIMULATION_STORES: SimulatedStore[] = [
  {
    id: 'sim-store-001',
    name: 'Demo Bodega NYC',
    type: 'bodega',
    address_street: '123 Demo Street',
    address_city: 'Brooklyn',
    address_state: 'NY',
    address_zip: '11201',
    phone: '(555) 123-4567',
    status: 'active',
    tags: ['premium', 'high-volume'],
    sells_flowers: true,
    sticker_status: 'applied',
    sticker_door: true,
    sticker_instore: true,
    sticker_phone: false,
    payment_type: 'pays_upfront',
    contacts: [
      { id: 'sim-contact-001', name: 'John Demo', role: 'Owner', phone: '(555) 123-4567', can_receive_sms: true, is_primary: true }
    ],
    tubeInventory: [
      { id: 'sim-inv-001', brand: 'gasmask', current_tubes_left: 24 }
    ]
  },
  {
    id: 'sim-store-002',
    name: 'Sample Smoke Shop',
    type: 'smoke_shop',
    address_street: '456 Example Ave',
    address_city: 'Manhattan',
    address_state: 'NY',
    address_zip: '10001',
    phone: '(555) 234-5678',
    status: 'active',
    tags: ['smoke-shop'],
    sells_flowers: false,
    sticker_status: 'pending',
    sticker_door: false,
    sticker_instore: true,
    sticker_phone: false,
    payment_type: 'bill_to_bill',
    contacts: [
      { id: 'sim-contact-002', name: 'Jane Sample', role: 'Manager', phone: '(555) 234-5678', can_receive_sms: true, is_primary: true }
    ],
    tubeInventory: [
      { id: 'sim-inv-002', brand: 'hotmama', current_tubes_left: 12 }
    ]
  },
  {
    id: 'sim-store-003',
    name: 'Test Gas Station',
    type: 'gas_station',
    address_street: '789 Test Blvd',
    address_city: 'Queens',
    address_state: 'NY',
    address_zip: '11375',
    phone: '(555) 345-6789',
    status: 'prospect',
    tags: ['gas-station', 'new-lead'],
    sells_flowers: false,
    sticker_status: 'none',
    sticker_door: false,
    sticker_instore: false,
    sticker_phone: false,
    payment_type: null,
    contacts: [
      { id: 'sim-contact-003', name: 'Mike Test', role: 'Owner', phone: '(555) 345-6789', can_receive_sms: false, is_primary: true }
    ],
    tubeInventory: []
  },
  {
    id: 'sim-store-004',
    name: 'Preview Corner Store',
    type: 'bodega',
    address_street: '321 Preview Lane',
    address_city: 'Bronx',
    address_state: 'NY',
    address_zip: '10451',
    phone: '(555) 456-7890',
    status: 'needsFollowUp',
    tags: ['follow-up'],
    sells_flowers: true,
    sticker_status: 'applied',
    sticker_door: true,
    sticker_instore: false,
    sticker_phone: true,
    payment_type: 'pays_upfront',
    contacts: [
      { id: 'sim-contact-004', name: 'Sara Preview', role: 'Owner', phone: '(555) 456-7890', can_receive_sms: true, is_primary: true }
    ],
    tubeInventory: [
      { id: 'sim-inv-003', brand: 'gasmasktubes', current_tubes_left: 48 }
    ]
  },
  {
    id: 'sim-store-005',
    name: 'Mock Wholesaler',
    type: 'wholesaler',
    address_street: '555 Mock Drive',
    address_city: 'Staten Island',
    address_state: 'NY',
    address_zip: '10301',
    phone: '(555) 567-8901',
    status: 'active',
    tags: ['wholesale', 'bulk'],
    sells_flowers: false,
    sticker_status: 'applied',
    sticker_door: true,
    sticker_instore: true,
    sticker_phone: true,
    payment_type: 'bill_to_bill',
    contacts: [
      { id: 'sim-contact-005', name: 'Tom Mock', role: 'Owner', phone: '(555) 567-8901', can_receive_sms: true, is_primary: true },
      { id: 'sim-contact-006', name: 'Lisa Mock', role: 'Manager', phone: '(555) 567-8902', can_receive_sms: true, is_primary: false }
    ],
    tubeInventory: [
      { id: 'sim-inv-004', brand: 'gasmask', current_tubes_left: 120 },
      { id: 'sim-inv-005', brand: 'hotmama', current_tubes_left: 60 }
    ]
  }
];

// Demo dashboard stats for simulation mode
export const SIMULATION_DASHBOARD_STATS: SimulatedDashboardStats = {
  activeStores: 3,
  totalStores: 5,
  totalProducts: 12,
  activeRoutes: 4,
};

// Helper to compute stats from simulation stores
export function getSimulationDashboardStats(): SimulatedDashboardStats {
  const activeCount = SIMULATION_STORES.filter(s => s.status === 'active').length;
  return {
    activeStores: activeCount,
    totalStores: SIMULATION_STORES.length,
    totalProducts: 12, // Static demo value
    activeRoutes: 4, // Static demo value
  };
}
