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

const FIXED_DRIVERS = [
  { id: 'sim-driver-001', name: 'Marcus Johnson', phone: '(555) 234-5678', vehicle: 'Van', territory: 'Downtown' },
  { id: 'sim-driver-002', name: 'James Williams', phone: '(555) 345-6789', vehicle: 'SUV', territory: 'North Side' },
  { id: 'sim-driver-003', name: 'Devon Brown', phone: '(555) 456-7890', vehicle: 'Pickup', territory: 'East End' },
];

const FIXED_BIKERS = [
  { id: 'sim-biker-001', name: 'Tyler Davis', phone: '(555) 111-2222', email: 'tyler@demo.com', territory: 'Downtown', lat: 40.7128, lng: -74.0060 },
  { id: 'sim-biker-002', name: 'Brandon Miller', phone: '(555) 222-3333', email: 'brandon@demo.com', territory: 'Midtown', lat: 40.7549, lng: -73.9840 },
  { id: 'sim-biker-003', name: 'Kevin Wilson', phone: '(555) 333-4444', email: 'kevin@demo.com', territory: 'South Valley', lat: 40.6892, lng: -74.0445 },
  { id: 'sim-biker-004', name: 'Anthony Moore', phone: '(555) 444-5555', email: 'anthony@demo.com', territory: 'West District', lat: 40.7282, lng: -74.0776 },
];

const FIXED_STORES = [
  { id: 'sim-store-001', name: 'Lucky Corner Store', address: '123 Main St' },
  { id: 'sim-store-002', name: 'Golden Mini Mart', address: '456 Oak Ave' },
  { id: 'sim-store-003', name: 'Quick Express Bodega', address: '789 Park Blvd' },
  { id: 'sim-store-004', name: 'Family Grocery', address: '321 Broadway' },
  { id: 'sim-store-005', name: 'Metro Supermarket', address: '654 Market St' },
  { id: 'sim-store-006', name: 'City Crown Mart', address: '987 Liberty Ave' },
  { id: 'sim-store-007', name: 'Star Convenience', address: '147 Center St' },
  { id: 'sim-store-008', name: 'Royal Foods', address: '258 Washington Blvd' },
];

const today = format(new Date(), 'yyyy-MM-dd');

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO A: NORMAL DAY
// ═══════════════════════════════════════════════════════════════════════════════

function generateNormalDayScenario(): SimulationState {
  const drivers: SimScenarioDriver[] = [
    {
      id: FIXED_DRIVERS[0].id,
      full_name: FIXED_DRIVERS[0].name,
      phone: FIXED_DRIVERS[0].phone,
      status: 'on_route',
      vehicle_type: FIXED_DRIVERS[0].vehicle,
      territory: FIXED_DRIVERS[0].territory,
      routes_today: 2,
      stops_completed: 3,
      stops_pending: 2,
      estimated_earnings: 145,
      debt_balance: 0,
      rating: 4.7,
      is_simulated: true,
    },
    {
      id: FIXED_DRIVERS[1].id,
      full_name: FIXED_DRIVERS[1].name,
      phone: FIXED_DRIVERS[1].phone,
      status: 'available',
      vehicle_type: FIXED_DRIVERS[1].vehicle,
      territory: FIXED_DRIVERS[1].territory,
      routes_today: 1,
      stops_completed: 5,
      stops_pending: 0,
      estimated_earnings: 120,
      debt_balance: 75,
      rating: 4.5,
      is_simulated: true,
    },
  ];

  const bikers: SimScenarioBiker[] = FIXED_BIKERS.slice(0, 3).map((b, i) => ({
    id: b.id,
    full_name: b.name,
    phone: b.phone,
    email: b.email,
    status: i === 0 ? 'on_task' : 'active' as const,
    territory: b.territory,
    tasks_today: 8 - i * 2,
    tasks_completed: 5 - i,
    tasks_pending: 3 - i,
    issues_reported: i,
    performance_score: 92 - i * 5,
    estimated_earnings: 85 - i * 10,
    lat: b.lat,
    lng: b.lng,
    is_simulated: true,
  }));

  const routes: SimScenarioRoute[] = [
    {
      id: 'sim-route-001',
      driver_id: FIXED_DRIVERS[0].id,
      driver_name: FIXED_DRIVERS[0].name,
      scheduled_date: today,
      status: 'in_progress',
      priority: 'normal',
      delivery_type: 'wholesale',
      stops: [
        { id: 'sim-stop-001', sequence: 1, store_id: FIXED_STORES[0].id, store_name: FIXED_STORES[0].name, address: FIXED_STORES[0].address, status: 'completed', amount_due: 0, window_start: '08:00', window_end: '10:00', notes: '', is_simulated: true },
        { id: 'sim-stop-002', sequence: 2, store_id: FIXED_STORES[1].id, store_name: FIXED_STORES[1].name, address: FIXED_STORES[1].address, status: 'completed', amount_due: 150, window_start: '10:00', window_end: '12:00', notes: 'COD - collect payment', is_simulated: true },
        { id: 'sim-stop-003', sequence: 3, store_id: FIXED_STORES[2].id, store_name: FIXED_STORES[2].name, address: FIXED_STORES[2].address, status: 'completed', amount_due: 0, window_start: '12:00', window_end: '14:00', notes: '', is_simulated: true },
        { id: 'sim-stop-004', sequence: 4, store_id: FIXED_STORES[3].id, store_name: FIXED_STORES[3].name, address: FIXED_STORES[3].address, status: 'en_route', amount_due: 200, window_start: '14:00', window_end: '16:00', notes: 'Ring bell twice', is_simulated: true },
        { id: 'sim-stop-005', sequence: 5, store_id: FIXED_STORES[4].id, store_name: FIXED_STORES[4].name, address: FIXED_STORES[4].address, status: 'pending', amount_due: 0, window_start: '16:00', window_end: '18:00', notes: '', is_simulated: true },
      ],
      total_stops: 5,
      completed_stops: 3,
      estimated_earnings: 145,
      dispatcher_notes: 'Priority customer at stop 4 - get signature',
      is_simulated: true,
    },
  ];

  const issues: SimScenarioIssue[] = [
    {
      id: 'sim-issue-001',
      reporter_id: FIXED_BIKERS[0].id,
      reported_by: FIXED_BIKERS[0].name,
      reporter_type: 'biker',
      store_id: FIXED_STORES[5].id,
      store_name: FIXED_STORES[5].name,
      issue_type: 'Display Damaged',
      description: 'Product display shelf is broken. Needs repair before restocking.',
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
      store_id: FIXED_STORES[6].id,
      store_name: FIXED_STORES[6].name,
      issue_type: 'Price Discrepancy',
      description: 'Prices on shelf do not match POS system. Store manager notified.',
      severity: 'medium',
      status: 'in_progress',
      reported_at: subHours(new Date(), 4),
      sla_deadline: addHours(new Date(), 8),
      sla_remaining_hours: 8,
      is_simulated: true,
    },
  ];

  const payouts: SimScenarioPayout[] = [
    {
      id: 'sim-payout-001',
      worker_id: FIXED_DRIVERS[0].id,
      worker_name: FIXED_DRIVERS[0].name,
      worker_type: 'driver',
      period_start: format(subDays(new Date(), 14), 'yyyy-MM-dd'),
      period_end: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
      total_earned: 850,
      adjustments: 25,
      debt_withheld: 0,
      total_to_pay: 875,
      status: 'pending_approval',
      line_items: [
        { description: 'Route deliveries (12 routes)', amount: 720, date: format(subDays(new Date(), 7), 'yyyy-MM-dd') },
        { description: 'COD bonus', amount: 80, date: format(subDays(new Date(), 5), 'yyyy-MM-dd') },
        { description: 'Weekend bonus', amount: 50, date: format(subDays(new Date(), 3), 'yyyy-MM-dd') },
        { description: 'Fuel reimbursement', amount: 25, date: format(subDays(new Date(), 1), 'yyyy-MM-dd') },
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
      total_earned: 420,
      adjustments: 0,
      debt_withheld: 0,
      total_to_pay: 420,
      status: 'approved',
      line_items: [
        { description: 'Store checks (45 stores)', amount: 360, date: format(subDays(new Date(), 7), 'yyyy-MM-dd') },
        { description: 'Issue reporting bonus', amount: 40, date: format(subDays(new Date(), 4), 'yyyy-MM-dd') },
        { description: 'Perfect attendance', amount: 20, date: format(subDays(new Date(), 1), 'yyyy-MM-dd') },
      ],
      is_simulated: true,
    },
  ];

  const debts: SimScenarioDebt[] = [
    {
      id: 'sim-debt-001',
      driver_id: FIXED_DRIVERS[1].id,
      driver_name: FIXED_DRIVERS[1].name,
      debt_type: 'Fuel Advance',
      original_amount: 150,
      remaining_amount: 75,
      status: 'open',
      created_at: subDays(new Date(), 21),
      notes: 'Weekly deductions of $25 applied',
      is_simulated: true,
    },
  ];

  const activityFeed: SimScenarioActivity[] = [
    { id: 'sim-act-001', type: 'delivery', message: `${FIXED_DRIVERS[0].name} completed stop at ${FIXED_STORES[2].name}`, timestamp: subHours(new Date(), 0.5), entity_id: 'sim-stop-003', entity_type: 'stop', severity: 'success', link_to: '/delivery/my-route/sim-route-001', is_simulated: true },
    { id: 'sim-act-002', type: 'biker', message: `${FIXED_BIKERS[0].name} started store check at ${FIXED_STORES[5].name}`, timestamp: subHours(new Date(), 1), entity_id: FIXED_BIKERS[0].id, entity_type: 'biker', severity: 'info', link_to: `/delivery/bikers/${FIXED_BIKERS[0].id}`, is_simulated: true },
    { id: 'sim-act-003', type: 'issue', message: `Issue reported by ${FIXED_BIKERS[1].name} at ${FIXED_STORES[6].name}`, timestamp: subHours(new Date(), 4), entity_id: 'sim-issue-002', entity_type: 'issue', severity: 'warning', link_to: '/delivery/issues/sim-issue-002', is_simulated: true },
    { id: 'sim-act-004', type: 'payout', message: `Payout of $420 approved for ${FIXED_BIKERS[0].name}`, timestamp: subHours(new Date(), 6), entity_id: 'sim-payout-002', entity_type: 'payout', severity: 'success', link_to: '/delivery/payouts', is_simulated: true },
    { id: 'sim-act-005', type: 'route', message: `Route assigned to ${FIXED_DRIVERS[0].name}`, timestamp: subHours(new Date(), 8), entity_id: 'sim-route-001', entity_type: 'route', severity: 'info', link_to: '/delivery/my-route/sim-route-001', is_simulated: true },
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
      deliveries_today: 8,
      stops_completed: 24,
      stops_pending: 12,
      active_drivers: 2,
      active_bikers: 3,
      open_issues: 2,
      critical_issues: 0,
      payouts_pending: 2,
      total_pending_amount: 1295,
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
