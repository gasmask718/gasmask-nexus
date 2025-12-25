// Deterministic Simulation Scenarios for Delivery & Logistics
// All data is UI-only - NEVER writes to database
// Consistent IDs allow cross-page navigation and drill-down

import { format, subHours, addHours, subDays } from 'date-fns';

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type SimScenario = 'normal' | 'heavy_issue' | 'low_volume';

export interface SimulationState {
  scenario: SimScenario;
  drivers: SimScenarioDriver[];
  bikers: SimScenarioBiker[];
  routes: SimScenarioRoute[];
  issues: SimScenarioIssue[];
  payouts: SimScenarioPayout[];
  debts: SimScenarioDebt[];
  activityFeed: SimScenarioActivity[];
  kpis: SimScenarioKPIs;
}

export interface SimScenarioDriver {
  id: string;
  full_name: string;
  phone: string;
  status: 'available' | 'on_route' | 'offline';
  vehicle_type: string;
  territory: string;
  routes_today: number;
  stops_completed: number;
  stops_pending: number;
  estimated_earnings: number;
  debt_balance: number;
  rating: number;
  is_simulated: true;
}

export interface SimScenarioBiker {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  status: 'active' | 'on_task' | 'offline';
  territory: string;
  tasks_today: number;
  tasks_completed: number;
  tasks_pending: number;
  issues_reported: number;
  performance_score: number;
  estimated_earnings: number;
  lat?: number;
  lng?: number;
  is_simulated: true;
}

export interface SimScenarioStop {
  id: string;
  sequence: number;
  store_id: string;
  store_name: string;
  address: string;
  status: 'pending' | 'en_route' | 'arrived' | 'completed' | 'skipped';
  amount_due: number;
  window_start: string;
  window_end: string;
  notes: string;
  is_simulated: true;
}

export interface SimScenarioRoute {
  id: string;
  driver_id: string;
  driver_name: string;
  scheduled_date: string;
  status: 'scheduled' | 'in_progress' | 'completed';
  priority: 'normal' | 'high' | 'urgent';
  delivery_type: string;
  stops: SimScenarioStop[];
  total_stops: number;
  completed_stops: number;
  estimated_earnings: number;
  dispatcher_notes: string;
  is_simulated: true;
}

export interface SimScenarioIssue {
  id: string;
  reporter_id: string;
  reported_by: string;
  reporter_type: 'driver' | 'biker';
  store_id: string;
  store_name: string;
  issue_type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'escalated';
  reported_at: Date;
  sla_deadline: Date;
  sla_remaining_hours: number;
  is_simulated: true;
}

export interface SimScenarioPayout {
  id: string;
  worker_id: string;
  worker_name: string;
  worker_type: 'driver' | 'biker';
  period_start: string;
  period_end: string;
  total_earned: number;
  adjustments: number;
  debt_withheld: number;
  total_to_pay: number;
  status: 'draft' | 'pending_approval' | 'approved' | 'paid';
  line_items: { description: string; amount: number; date: string }[];
  is_simulated: true;
}

export interface SimScenarioDebt {
  id: string;
  driver_id: string;
  driver_name: string;
  debt_type: string;
  original_amount: number;
  remaining_amount: number;
  status: 'open' | 'in_collection' | 'settled' | 'written_off';
  created_at: Date;
  notes: string;
  is_simulated: true;
}

export interface SimScenarioActivity {
  id: string;
  type: 'delivery' | 'biker' | 'issue' | 'payout' | 'route';
  message: string;
  timestamp: Date;
  entity_id: string;
  entity_type: string;
  severity: 'info' | 'warning' | 'success' | 'error';
  link_to: string;
  is_simulated: true;
}

export interface SimScenarioKPIs {
  deliveries_today: number;
  stops_completed: number;
  stops_pending: number;
  active_drivers: number;
  active_bikers: number;
  open_issues: number;
  critical_issues: number;
  payouts_pending: number;
  total_pending_amount: number;
  is_simulated: true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DETERMINISTIC DATA (Fixed IDs for cross-page linking)
// ═══════════════════════════════════════════════════════════════════════════════

// FORCED SIMULATION DATA - EXACT VALUES PER SPEC
const FIXED_DRIVERS = [
  { id: 'sim-driver-001', name: 'Mike R', phone: '(555) 234-5678', vehicle: 'Van', territory: 'Brooklyn' },
  { id: 'sim-driver-002', name: 'Sam K', phone: '(555) 345-6789', vehicle: 'SUV', territory: 'Queens' },
  { id: 'sim-driver-003', name: 'Alex T', phone: '(555) 456-7890', vehicle: 'Pickup', territory: 'Bronx' },
];

const FIXED_BIKERS = [
  { id: 'sim-biker-001', name: 'Alex T', phone: '(555) 111-2222', email: 'alex@demo.com', territory: 'Brooklyn', lat: 40.6782, lng: -73.9442 },
  { id: 'sim-biker-002', name: 'Sam K', phone: '(555) 222-3333', email: 'sam@demo.com', territory: 'Queens', lat: 40.7282, lng: -73.7949 },
  { id: 'sim-biker-003', name: 'Jordan L', phone: '(555) 333-4444', email: 'jordan@demo.com', territory: 'Bronx', lat: 40.8448, lng: -73.8648 },
  { id: 'sim-biker-004', name: 'Mike R', phone: '(555) 444-5555', email: 'mike@demo.com', territory: 'Manhattan', lat: 40.7831, lng: -73.9712 },
  { id: 'sim-biker-005', name: 'Chris D', phone: '(555) 555-6666', email: 'chris@demo.com', territory: 'Harlem', lat: 40.8116, lng: -73.9465 },
];

const FIXED_STORES = [
  { id: 'sim-store-001', name: 'Brooklyn Smoke Shop', address: '123 Flatbush Ave, Brooklyn' },
  { id: 'sim-store-002', name: 'Crown Heights Market', address: '456 Eastern Pkwy, Brooklyn' },
  { id: 'sim-store-003', name: 'Flatbush Convenience', address: '789 Flatbush Ave, Brooklyn' },
  { id: 'sim-store-004', name: 'Parkside Deli', address: '321 Ocean Ave, Brooklyn' },
  { id: 'sim-store-005', name: 'Kings Plaza Kiosk', address: '654 Kings Plaza, Brooklyn' },
  { id: 'sim-store-006', name: 'Canarsie Smoke Shop', address: '987 Rockaway Pkwy, Brooklyn' },
  { id: 'sim-store-007', name: 'Harlem Convenience', address: '147 Malcolm X Blvd, Harlem' },
  { id: 'sim-store-008', name: 'Queens Deli', address: '258 Jamaica Ave, Queens' },
  { id: 'sim-store-009', name: 'Bronx Deli', address: '369 Grand Concourse, Bronx' },
  { id: 'sim-store-010', name: 'Queens Smoke Shop', address: '481 Northern Blvd, Queens' },
];

const today = format(new Date(), 'yyyy-MM-dd');

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO A: NORMAL DAY
// ═══════════════════════════════════════════════════════════════════════════════

function generateNormalDayScenario(): SimulationState {
  // FORCED: 3 Active Drivers per spec
  const drivers: SimScenarioDriver[] = [
    {
      id: FIXED_DRIVERS[0].id,
      full_name: FIXED_DRIVERS[0].name,
      phone: FIXED_DRIVERS[0].phone,
      status: 'available',
      vehicle_type: FIXED_DRIVERS[0].vehicle,
      territory: FIXED_DRIVERS[0].territory,
      routes_today: 1,
      stops_completed: 3,
      stops_pending: 3,
      estimated_earnings: 320,
      debt_balance: 120,
      rating: 4.7,
      is_simulated: true,
    },
    {
      id: FIXED_DRIVERS[1].id,
      full_name: FIXED_DRIVERS[1].name,
      phone: FIXED_DRIVERS[1].phone,
      status: 'on_route',
      vehicle_type: FIXED_DRIVERS[1].vehicle,
      territory: FIXED_DRIVERS[1].territory,
      routes_today: 1,
      stops_completed: 4,
      stops_pending: 2,
      estimated_earnings: 280,
      debt_balance: 300,
      rating: 4.5,
      is_simulated: true,
    },
    {
      id: FIXED_DRIVERS[2].id,
      full_name: FIXED_DRIVERS[2].name,
      phone: FIXED_DRIVERS[2].phone,
      status: 'available',
      vehicle_type: FIXED_DRIVERS[2].vehicle,
      territory: FIXED_DRIVERS[2].territory,
      routes_today: 1,
      stops_completed: 5,
      stops_pending: 1,
      estimated_earnings: 260,
      debt_balance: 120,
      rating: 4.8,
      is_simulated: true,
    },
  ];

  // FORCED: 5 Active Bikers per spec
  const bikers: SimScenarioBiker[] = [
    { id: FIXED_BIKERS[0].id, full_name: FIXED_BIKERS[0].name, phone: FIXED_BIKERS[0].phone, email: FIXED_BIKERS[0].email, status: 'active', territory: FIXED_BIKERS[0].territory, tasks_today: 4, tasks_completed: 2, tasks_pending: 2, issues_reported: 1, performance_score: 92, estimated_earnings: 120, lat: FIXED_BIKERS[0].lat, lng: FIXED_BIKERS[0].lng, is_simulated: true },
    { id: FIXED_BIKERS[1].id, full_name: FIXED_BIKERS[1].name, phone: FIXED_BIKERS[1].phone, email: FIXED_BIKERS[1].email, status: 'on_task', territory: FIXED_BIKERS[1].territory, tasks_today: 3, tasks_completed: 1, tasks_pending: 2, issues_reported: 0, performance_score: 88, estimated_earnings: 90, lat: FIXED_BIKERS[1].lat, lng: FIXED_BIKERS[1].lng, is_simulated: true },
    { id: FIXED_BIKERS[2].id, full_name: FIXED_BIKERS[2].name, phone: FIXED_BIKERS[2].phone, email: FIXED_BIKERS[2].email, status: 'active', territory: FIXED_BIKERS[2].territory, tasks_today: 2, tasks_completed: 1, tasks_pending: 1, issues_reported: 1, performance_score: 85, estimated_earnings: 75, lat: FIXED_BIKERS[2].lat, lng: FIXED_BIKERS[2].lng, is_simulated: true },
    { id: FIXED_BIKERS[3].id, full_name: FIXED_BIKERS[3].name, phone: FIXED_BIKERS[3].phone, email: FIXED_BIKERS[3].email, status: 'offline', territory: FIXED_BIKERS[3].territory, tasks_today: 0, tasks_completed: 0, tasks_pending: 0, issues_reported: 0, performance_score: 78, estimated_earnings: 0, lat: FIXED_BIKERS[3].lat, lng: FIXED_BIKERS[3].lng, is_simulated: true },
    { id: FIXED_BIKERS[4].id, full_name: FIXED_BIKERS[4].name, phone: FIXED_BIKERS[4].phone, email: FIXED_BIKERS[4].email, status: 'active', territory: FIXED_BIKERS[4].territory, tasks_today: 5, tasks_completed: 3, tasks_pending: 2, issues_reported: 2, performance_score: 90, estimated_earnings: 95, lat: FIXED_BIKERS[4].lat, lng: FIXED_BIKERS[4].lng, is_simulated: true },
  ];

  // FORCED: Route RT-SIM-101 with 6 stops per spec
  const routes: SimScenarioRoute[] = [
    {
      id: 'RT-SIM-101',
      driver_id: FIXED_DRIVERS[0].id,
      driver_name: FIXED_DRIVERS[0].name,
      scheduled_date: today,
      status: 'in_progress',
      priority: 'normal',
      delivery_type: 'wholesale',
      stops: [
        { id: 'sim-stop-001', sequence: 1, store_id: FIXED_STORES[0].id, store_name: FIXED_STORES[0].name, address: FIXED_STORES[0].address, status: 'completed', amount_due: 0, window_start: '09:30', window_end: '10:30', notes: '', is_simulated: true },
        { id: 'sim-stop-002', sequence: 2, store_id: FIXED_STORES[1].id, store_name: FIXED_STORES[1].name, address: FIXED_STORES[1].address, status: 'completed', amount_due: 120, window_start: '10:30', window_end: '11:30', notes: 'COD - collect payment', is_simulated: true },
        { id: 'sim-stop-003', sequence: 3, store_id: FIXED_STORES[2].id, store_name: FIXED_STORES[2].name, address: FIXED_STORES[2].address, status: 'completed', amount_due: 0, window_start: '11:30', window_end: '12:30', notes: '', is_simulated: true },
        { id: 'sim-stop-004', sequence: 4, store_id: FIXED_STORES[3].id, store_name: FIXED_STORES[3].name, address: FIXED_STORES[3].address, status: 'pending', amount_due: 90, window_start: '13:00', window_end: '14:00', notes: 'Ring bell twice', is_simulated: true },
        { id: 'sim-stop-005', sequence: 5, store_id: FIXED_STORES[4].id, store_name: FIXED_STORES[4].name, address: FIXED_STORES[4].address, status: 'pending', amount_due: 75, window_start: '14:00', window_end: '15:00', notes: '', is_simulated: true },
        { id: 'sim-stop-006', sequence: 6, store_id: FIXED_STORES[5].id, store_name: FIXED_STORES[5].name, address: FIXED_STORES[5].address, status: 'pending', amount_due: 95, window_start: '15:00', window_end: '16:00', notes: '', is_simulated: true },
      ],
      total_stops: 6,
      completed_stops: 3,
      estimated_earnings: 320,
      dispatcher_notes: 'Brooklyn route - 6 stops. Start Time: 9:30 AM',
      is_simulated: true,
    },
  ];

  // FORCED: 4 Open Issues per spec
  const issues: SimScenarioIssue[] = [
    {
      id: 'sim-issue-001',
      reporter_id: FIXED_BIKERS[0].id,
      reported_by: FIXED_BIKERS[0].name,
      reporter_type: 'biker',
      store_id: FIXED_STORES[6].id,
      store_name: FIXED_STORES[6].name,
      issue_type: 'Display Damaged',
      description: 'Product display shelf is broken at Harlem Convenience.',
      severity: 'low',
      status: 'open',
      reported_at: subHours(new Date(), 2),
      sla_deadline: addHours(new Date(), 22),
      sla_remaining_hours: 22,
      is_simulated: true,
    },
    {
      id: 'sim-issue-002',
      reporter_id: FIXED_BIKERS[1].id,
      reported_by: FIXED_BIKERS[1].name,
      reporter_type: 'biker',
      store_id: FIXED_STORES[7].id,
      store_name: FIXED_STORES[7].name,
      issue_type: 'Price Discrepancy',
      description: 'Prices on shelf do not match POS system at Queens Deli.',
      severity: 'medium',
      status: 'in_progress',
      reported_at: subHours(new Date(), 4),
      sla_deadline: addHours(new Date(), 8),
      sla_remaining_hours: 8,
      is_simulated: true,
    },
    {
      id: 'sim-issue-003',
      reporter_id: FIXED_BIKERS[2].id,
      reported_by: FIXED_BIKERS[2].name,
      reporter_type: 'biker',
      store_id: FIXED_STORES[8].id,
      store_name: FIXED_STORES[8].name,
      issue_type: 'Low Stock',
      description: 'Multiple SKUs running low at Bronx Deli.',
      severity: 'medium',
      status: 'open',
      reported_at: subHours(new Date(), 3),
      sla_deadline: addHours(new Date(), 12),
      sla_remaining_hours: 12,
      is_simulated: true,
    },
    {
      id: 'sim-issue-004',
      reporter_id: FIXED_BIKERS[4].id,
      reported_by: FIXED_BIKERS[4].name,
      reporter_type: 'biker',
      store_id: FIXED_STORES[9].id,
      store_name: FIXED_STORES[9].name,
      issue_type: 'Store Closed',
      description: 'Queens Smoke Shop unexpectedly closed during scheduled visit.',
      severity: 'high',
      status: 'open',
      reported_at: subHours(new Date(), 1),
      sla_deadline: addHours(new Date(), 4),
      sla_remaining_hours: 4,
      is_simulated: true,
    },
  ];

  // FORCED: Payouts totaling $1,240 pending per spec
  const payouts: SimScenarioPayout[] = [
    {
      id: 'sim-payout-001',
      worker_id: FIXED_DRIVERS[0].id,
      worker_name: FIXED_DRIVERS[0].name,
      worker_type: 'driver',
      period_start: format(subDays(new Date(), 14), 'yyyy-MM-dd'),
      period_end: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
      total_earned: 480,
      adjustments: 0,
      debt_withheld: 0,
      total_to_pay: 480,
      status: 'pending_approval',
      line_items: [
        { description: 'Brooklyn Smoke Shop', amount: 120, date: format(subDays(new Date(), 2), 'yyyy-MM-dd') },
        { description: 'Queens Deli', amount: 90, date: format(subDays(new Date(), 3), 'yyyy-MM-dd') },
        { description: 'Route bonus', amount: 270, date: format(subDays(new Date(), 1), 'yyyy-MM-dd') },
      ],
      is_simulated: true,
    },
    {
      id: 'sim-payout-002',
      worker_id: FIXED_BIKERS[0].id,
      worker_name: FIXED_BIKERS[0].name,
      worker_type: 'biker',
      period_start: format(subDays(new Date(), 14), 'yyyy-MM-dd'),
      period_end: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
      total_earned: 380,
      adjustments: 0,
      debt_withheld: 0,
      total_to_pay: 380,
      status: 'pending_approval',
      line_items: [
        { description: 'Store checks (38 stores)', amount: 304, date: format(subDays(new Date(), 7), 'yyyy-MM-dd') },
        { description: 'Issue reporting bonus', amount: 56, date: format(subDays(new Date(), 4), 'yyyy-MM-dd') },
        { description: 'Harlem Kiosk', amount: 20, date: format(subDays(new Date(), 1), 'yyyy-MM-dd') },
      ],
      is_simulated: true,
    },
    {
      id: 'sim-payout-003',
      worker_id: FIXED_BIKERS[1].id,
      worker_name: FIXED_BIKERS[1].name,
      worker_type: 'biker',
      period_start: format(subDays(new Date(), 14), 'yyyy-MM-dd'),
      period_end: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
      total_earned: 180,
      adjustments: 0,
      debt_withheld: 0,
      total_to_pay: 180,
      status: 'approved',
      line_items: [
        { description: 'Store checks (18 stores)', amount: 144, date: format(subDays(new Date(), 5), 'yyyy-MM-dd') },
        { description: 'Performance bonus', amount: 36, date: format(subDays(new Date(), 2), 'yyyy-MM-dd') },
      ],
      is_simulated: true,
    },
    {
      id: 'sim-payout-004',
      worker_id: FIXED_DRIVERS[2].id,
      worker_name: FIXED_DRIVERS[2].name,
      worker_type: 'driver',
      period_start: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
      period_end: format(new Date(), 'yyyy-MM-dd'),
      total_earned: 200,
      adjustments: 0,
      debt_withheld: 0,
      total_to_pay: 200,
      status: 'paid',
      line_items: [
        { description: 'Bronx Market', amount: 95, date: format(subDays(new Date(), 3), 'yyyy-MM-dd') },
        { description: 'Route completion', amount: 105, date: format(subDays(new Date(), 1), 'yyyy-MM-dd') },
      ],
      is_simulated: true,
    },
  ];

  // FORCED: Debts totaling $540 outstanding per spec
  const debts: SimScenarioDebt[] = [
    {
      id: 'sim-debt-001',
      driver_id: FIXED_DRIVERS[0].id,
      driver_name: FIXED_DRIVERS[0].name,
      debt_type: 'Fuel Advance',
      original_amount: 150,
      remaining_amount: 120,
      status: 'open',
      created_at: subDays(new Date(), 14),
      notes: 'Fuel advance for Brooklyn routes',
      is_simulated: true,
    },
    {
      id: 'sim-debt-002',
      driver_id: FIXED_DRIVERS[1].id,
      driver_name: FIXED_DRIVERS[1].name,
      debt_type: 'Vehicle Damage',
      original_amount: 450,
      remaining_amount: 300,
      status: 'in_collection',
      created_at: subDays(new Date(), 30),
      notes: 'Side mirror replacement - collecting $50/week',
      is_simulated: true,
    },
    {
      id: 'sim-debt-003',
      driver_id: FIXED_DRIVERS[2].id,
      driver_name: FIXED_DRIVERS[2].name,
      debt_type: 'Cash Advance',
      original_amount: 200,
      remaining_amount: 120,
      status: 'settled',
      created_at: subDays(new Date(), 45),
      notes: 'Personal advance - fully repaid',
      is_simulated: true,
    },
  ];

  // FORCED: Activity feed per spec - clickable
  const activityFeed: SimScenarioActivity[] = [
    { id: 'sim-act-001', type: 'delivery', message: `Driver ${FIXED_DRIVERS[0].name} completed Stop – ${FIXED_STORES[0].name}`, timestamp: subHours(new Date(), 0.5), entity_id: 'sim-stop-001', entity_type: 'stop', severity: 'success', link_to: '/delivery/my-route/RT-SIM-101', is_simulated: true },
    { id: 'sim-act-002', type: 'biker', message: `Biker ${FIXED_BIKERS[0].name} reported issue – ${FIXED_STORES[6].name}`, timestamp: subHours(new Date(), 1), entity_id: 'sim-issue-001', entity_type: 'issue', severity: 'warning', link_to: '/delivery/biker-tasks', is_simulated: true },
    { id: 'sim-act-003', type: 'route', message: `Route RT-SIM-101 started – ${FIXED_DRIVERS[0].territory}`, timestamp: subHours(new Date(), 2), entity_id: 'RT-SIM-101', entity_type: 'route', severity: 'info', link_to: '/delivery/my-route/RT-SIM-101', is_simulated: true },
    { id: 'sim-act-004', type: 'payout', message: `Payout approved – Biker ${FIXED_BIKERS[1].name} ($180)`, timestamp: subHours(new Date(), 3), entity_id: 'sim-payout-003', entity_type: 'payout', severity: 'success', link_to: '/delivery/payouts', is_simulated: true },
    { id: 'sim-act-005', type: 'delivery', message: `Driver ${FIXED_DRIVERS[0].name} completed Stop – ${FIXED_STORES[1].name}`, timestamp: subHours(new Date(), 3.5), entity_id: 'sim-stop-002', entity_type: 'stop', severity: 'success', link_to: '/delivery/my-route/RT-SIM-101', is_simulated: true },
    { id: 'sim-act-006', type: 'delivery', message: `Driver ${FIXED_DRIVERS[0].name} completed Stop – ${FIXED_STORES[2].name}`, timestamp: subHours(new Date(), 4), entity_id: 'sim-stop-003', entity_type: 'stop', severity: 'success', link_to: '/delivery/my-route/RT-SIM-101', is_simulated: true },
  ];

  return {
    scenario: 'normal',
    drivers,
    bikers,
    routes,
    issues,
    payouts,
    debts,
    activityFeed,
    kpis: {
      // FORCED: Exact KPI values per spec
      deliveries_today: 8,
      stops_completed: 21,
      stops_pending: 14,
      active_drivers: 3,
      active_bikers: 5,
      open_issues: 4,
      critical_issues: 0,
      payouts_pending: 2,
      total_pending_amount: 1240,
      is_simulated: true,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO B: HEAVY ISSUE DAY
// ═══════════════════════════════════════════════════════════════════════════════

function generateHeavyIssueDayScenario(): SimulationState {
  const drivers: SimScenarioDriver[] = FIXED_DRIVERS.map((d, i) => ({
    id: d.id,
    full_name: d.name,
    phone: d.phone,
    status: i === 2 ? 'offline' : 'on_route' as const,
    vehicle_type: d.vehicle,
    territory: d.territory,
    routes_today: 2 - (i === 2 ? 2 : 0),
    stops_completed: 10 - i * 3,
    stops_pending: 8 + i * 2,
    estimated_earnings: 180 - i * 30,
    debt_balance: i === 1 ? 200 : 0,
    rating: 4.3 + (i === 0 ? 0.4 : 0),
    is_simulated: true,
  }));

  const bikers: SimScenarioBiker[] = FIXED_BIKERS.map((b, i) => ({
    id: b.id,
    full_name: b.name,
    phone: b.phone,
    email: b.email,
    status: (i === 3 ? 'offline' : (i % 2 === 0 ? 'on_task' : 'active')) as 'active' | 'on_task' | 'offline',
    territory: b.territory,
    tasks_today: 12 - i,
    tasks_completed: 4 - Math.min(i, 2),
    tasks_pending: 8 - i,
    issues_reported: 2 + i,
    performance_score: 78 - i * 8,
    estimated_earnings: 95 - i * 12,
    lat: b.lat,
    lng: b.lng,
    is_simulated: true,
  }));

  const routes: SimScenarioRoute[] = [
    {
      id: 'sim-route-heavy-001',
      driver_id: FIXED_DRIVERS[0].id,
      driver_name: FIXED_DRIVERS[0].name,
      scheduled_date: today,
      status: 'in_progress',
      priority: 'urgent',
      delivery_type: 'urgent_delivery',
      stops: FIXED_STORES.slice(0, 6).map((s, i) => ({
        id: `sim-stop-heavy-${i + 1}`,
        sequence: i + 1,
        store_id: s.id,
        store_name: s.name,
        address: s.address,
        status: (i < 2 ? 'completed' : (i === 2 ? 'en_route' : 'pending')) as 'pending' | 'en_route' | 'arrived' | 'completed' | 'skipped',
        amount_due: i % 2 === 0 ? 175 : 0,
        window_start: `${8 + i * 1.5}:00`.slice(0, 5),
        window_end: `${10 + i * 1.5}:00`.slice(0, 5),
        notes: i === 4 ? 'CRITICAL: Customer complaint - handle with care' : '',
        is_simulated: true,
      })),
      total_stops: 6,
      completed_stops: 2,
      estimated_earnings: 210,
      dispatcher_notes: 'URGENT: Multiple delays reported. Prioritize critical stops.',
      is_simulated: true,
    },
    {
      id: 'sim-route-heavy-002',
      driver_id: FIXED_DRIVERS[1].id,
      driver_name: FIXED_DRIVERS[1].name,
      scheduled_date: today,
      status: 'in_progress',
      priority: 'high',
      delivery_type: 'restock',
      stops: FIXED_STORES.slice(4, 8).map((s, i) => ({
        id: `sim-stop-heavy-${i + 7}`,
        sequence: i + 1,
        store_id: s.id,
        store_name: s.name,
        address: s.address,
        status: (i === 0 ? 'completed' : (i === 1 ? 'arrived' : 'pending')) as 'pending' | 'en_route' | 'arrived' | 'completed' | 'skipped',
        amount_due: i === 2 ? 320 : 0,
        window_start: `${9 + i * 2}:00`,
        window_end: `${11 + i * 2}:00`,
        notes: i === 3 ? 'Store closes early today - arrive before 3pm' : '',
        is_simulated: true,
      })),
      total_stops: 4,
      completed_stops: 1,
      estimated_earnings: 165,
      dispatcher_notes: 'Driver stuck at stop 2 - store inventory issue',
      is_simulated: true,
    },
  ];

  const issues: SimScenarioIssue[] = [
    {
      id: 'sim-issue-heavy-001',
      reporter_id: FIXED_DRIVERS[0].id,
      reported_by: FIXED_DRIVERS[0].name,
      reporter_type: 'driver',
      store_id: FIXED_STORES[2].id,
      store_name: FIXED_STORES[2].name,
      issue_type: 'Store Closed',
      description: 'Store unexpectedly closed during delivery window. Unable to complete delivery.',
      severity: 'critical',
      status: 'escalated',
      reported_at: subHours(new Date(), 1),
      sla_deadline: addHours(new Date(), 2),
      sla_remaining_hours: 2,
      is_simulated: true,
    },
    {
      id: 'sim-issue-heavy-002',
      reporter_id: FIXED_BIKERS[0].id,
      reported_by: FIXED_BIKERS[0].name,
      reporter_type: 'biker',
      store_id: FIXED_STORES[0].id,
      store_name: FIXED_STORES[0].name,
      issue_type: 'Competitor Activity',
      description: 'Major competitor promotion running. Our products moved to back shelf.',
      severity: 'high',
      status: 'open',
      reported_at: subHours(new Date(), 2),
      sla_deadline: addHours(new Date(), 4),
      sla_remaining_hours: 4,
      is_simulated: true,
    },
    {
      id: 'sim-issue-heavy-003',
      reporter_id: FIXED_BIKERS[1].id,
      reported_by: FIXED_BIKERS[1].name,
      reporter_type: 'biker',
      store_id: FIXED_STORES[3].id,
      store_name: FIXED_STORES[3].name,
      issue_type: 'Stock Low',
      description: 'Critical low stock on top 3 SKUs. Immediate restock needed.',
      severity: 'high',
      status: 'in_progress',
      reported_at: subHours(new Date(), 3),
      sla_deadline: addHours(new Date(), 5),
      sla_remaining_hours: 5,
      is_simulated: true,
    },
    {
      id: 'sim-issue-heavy-004',
      reporter_id: FIXED_BIKERS[2].id,
      reported_by: FIXED_BIKERS[2].name,
      reporter_type: 'biker',
      store_id: FIXED_STORES[4].id,
      store_name: FIXED_STORES[4].name,
      issue_type: 'Access Denied',
      description: 'New store manager refused entry. Previous authorization not on file.',
      severity: 'medium',
      status: 'open',
      reported_at: subHours(new Date(), 4),
      sla_deadline: addHours(new Date(), 12),
      sla_remaining_hours: 12,
      is_simulated: true,
    },
    {
      id: 'sim-issue-heavy-005',
      reporter_id: FIXED_DRIVERS[1].id,
      reported_by: FIXED_DRIVERS[1].name,
      reporter_type: 'driver',
      store_id: FIXED_STORES[5].id,
      store_name: FIXED_STORES[5].name,
      issue_type: 'Product Missing',
      description: 'Shipment missing 2 cases of product. Customer refusing partial delivery.',
      severity: 'critical',
      status: 'open',
      reported_at: subHours(new Date(), 0.5),
      sla_deadline: addHours(new Date(), 1),
      sla_remaining_hours: 1,
      is_simulated: true,
    },
    {
      id: 'sim-issue-heavy-006',
      reporter_id: FIXED_BIKERS[3].id,
      reported_by: FIXED_BIKERS[3].name,
      reporter_type: 'biker',
      store_id: FIXED_STORES[7].id,
      store_name: FIXED_STORES[7].name,
      issue_type: 'Equipment Issue',
      description: 'Refrigeration unit malfunctioning. Products at risk of spoilage.',
      severity: 'high',
      status: 'escalated',
      reported_at: subHours(new Date(), 1.5),
      sla_deadline: addHours(new Date(), 2.5),
      sla_remaining_hours: 2.5,
      is_simulated: true,
    },
  ];

  const payouts: SimScenarioPayout[] = [
    {
      id: 'sim-payout-heavy-001',
      worker_id: FIXED_DRIVERS[0].id,
      worker_name: FIXED_DRIVERS[0].name,
      worker_type: 'driver',
      period_start: format(subDays(new Date(), 14), 'yyyy-MM-dd'),
      period_end: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
      total_earned: 1250,
      adjustments: -50,
      debt_withheld: 0,
      total_to_pay: 1200,
      status: 'pending_approval',
      line_items: [
        { description: 'Route deliveries (18 routes)', amount: 1080, date: format(subDays(new Date(), 7), 'yyyy-MM-dd') },
        { description: 'Urgent delivery premium', amount: 120, date: format(subDays(new Date(), 3), 'yyyy-MM-dd') },
        { description: 'Late penalty', amount: -50, date: format(subDays(new Date(), 2), 'yyyy-MM-dd') },
        { description: 'Mileage bonus', amount: 50, date: format(subDays(new Date(), 1), 'yyyy-MM-dd') },
      ],
      is_simulated: true,
    },
  ];

  const debts: SimScenarioDebt[] = [
    {
      id: 'sim-debt-heavy-001',
      driver_id: FIXED_DRIVERS[1].id,
      driver_name: FIXED_DRIVERS[1].name,
      debt_type: 'Equipment Damage',
      original_amount: 350,
      remaining_amount: 200,
      status: 'in_collection',
      created_at: subDays(new Date(), 45),
      notes: 'Damaged delivery cart. Payment plan: $50/week',
      is_simulated: true,
    },
    {
      id: 'sim-debt-heavy-002',
      driver_id: FIXED_DRIVERS[2].id,
      driver_name: FIXED_DRIVERS[2].name,
      debt_type: 'Cash Shortage',
      original_amount: 180,
      remaining_amount: 180,
      status: 'open',
      created_at: subDays(new Date(), 3),
      notes: 'COD collection discrepancy. Under investigation.',
      is_simulated: true,
    },
  ];

  const activityFeed: SimScenarioActivity[] = [
    { id: 'sim-act-heavy-001', type: 'issue', message: `CRITICAL: ${FIXED_DRIVERS[1].name} reported missing product at ${FIXED_STORES[5].name}`, timestamp: subHours(new Date(), 0.5), entity_id: 'sim-issue-heavy-005', entity_type: 'issue', severity: 'error', link_to: '/delivery/issues/sim-issue-heavy-005', is_simulated: true },
    { id: 'sim-act-heavy-002', type: 'issue', message: `Issue escalated: Store closed at ${FIXED_STORES[2].name}`, timestamp: subHours(new Date(), 1), entity_id: 'sim-issue-heavy-001', entity_type: 'issue', severity: 'error', link_to: '/delivery/issues/sim-issue-heavy-001', is_simulated: true },
    { id: 'sim-act-heavy-003', type: 'route', message: `${FIXED_DRIVERS[0].name} running behind schedule - 2 stops delayed`, timestamp: subHours(new Date(), 1.5), entity_id: 'sim-route-heavy-001', entity_type: 'route', severity: 'warning', link_to: '/delivery/my-route/sim-route-heavy-001', is_simulated: true },
    { id: 'sim-act-heavy-004', type: 'issue', message: `Equipment issue at ${FIXED_STORES[7].name} - escalated to maintenance`, timestamp: subHours(new Date(), 1.5), entity_id: 'sim-issue-heavy-006', entity_type: 'issue', severity: 'error', link_to: '/delivery/issues/sim-issue-heavy-006', is_simulated: true },
    { id: 'sim-act-heavy-005', type: 'biker', message: `${FIXED_BIKERS[0].name} reported competitor activity`, timestamp: subHours(new Date(), 2), entity_id: 'sim-issue-heavy-002', entity_type: 'issue', severity: 'warning', link_to: '/delivery/issues/sim-issue-heavy-002', is_simulated: true },
  ];

  return {
    scenario: 'heavy_issue',
    drivers,
    bikers,
    routes,
    issues,
    payouts,
    debts,
    activityFeed,
    kpis: {
      deliveries_today: 15,
      stops_completed: 18,
      stops_pending: 32,
      active_drivers: 2,
      active_bikers: 3,
      open_issues: 6,
      critical_issues: 2,
      payouts_pending: 1,
      total_pending_amount: 1200,
      is_simulated: true,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO C: LOW VOLUME DAY
// ═══════════════════════════════════════════════════════════════════════════════

function generateLowVolumeDayScenario(): SimulationState {
  const drivers: SimScenarioDriver[] = [
    {
      id: FIXED_DRIVERS[0].id,
      full_name: FIXED_DRIVERS[0].name,
      phone: FIXED_DRIVERS[0].phone,
      status: 'available',
      vehicle_type: FIXED_DRIVERS[0].vehicle,
      territory: FIXED_DRIVERS[0].territory,
      routes_today: 0,
      stops_completed: 0,
      stops_pending: 0,
      estimated_earnings: 0,
      debt_balance: 0,
      rating: 4.8,
      is_simulated: true,
    },
  ];

  const bikers: SimScenarioBiker[] = [
    {
      id: FIXED_BIKERS[0].id,
      full_name: FIXED_BIKERS[0].name,
      phone: FIXED_BIKERS[0].phone,
      email: FIXED_BIKERS[0].email,
      status: 'active',
      territory: FIXED_BIKERS[0].territory,
      tasks_today: 0,
      tasks_completed: 0,
      tasks_pending: 0,
      issues_reported: 0,
      performance_score: 95,
      estimated_earnings: 0,
      lat: FIXED_BIKERS[0].lat,
      lng: FIXED_BIKERS[0].lng,
      is_simulated: true,
    },
  ];

  return {
    scenario: 'low_volume',
    drivers,
    bikers,
    routes: [],
    issues: [],
    payouts: [],
    debts: [],
    activityFeed: [],
    kpis: {
      deliveries_today: 0,
      stops_completed: 0,
      stops_pending: 0,
      active_drivers: 1,
      active_bikers: 1,
      open_issues: 0,
      critical_issues: 0,
      payouts_pending: 0,
      total_pending_amount: 0,
      is_simulated: true,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export function getSimulationScenario(scenario: SimScenario): SimulationState {
  switch (scenario) {
    case 'normal':
      return generateNormalDayScenario();
    case 'heavy_issue':
      return generateHeavyIssueDayScenario();
    case 'low_volume':
      return generateLowVolumeDayScenario();
    default:
      return generateNormalDayScenario();
  }
}

// Hook to get current simulation data with scenario selection
export function useSimulationData(scenario: SimScenario = 'normal'): SimulationState {
  return getSimulationScenario(scenario);
}
