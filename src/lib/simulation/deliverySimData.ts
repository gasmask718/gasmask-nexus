// Simulation Data Generators for Delivery & Logistics
// All data is purely for UI display - NEVER writes to database

import { format, subDays, addDays, addHours, subHours } from 'date-fns';

// Realistic names
const FIRST_NAMES = ['Marcus', 'James', 'Devon', 'Tyler', 'Brandon', 'Kevin', 'Anthony', 'Michael', 'David', 'Chris', 'Malik', 'Terrence', 'Andre', 'Carlos', 'Jamal', 'LaShawn', 'Darnell', 'Jerome', 'Raymond', 'Tyrone'];
const LAST_NAMES = ['Johnson', 'Williams', 'Brown', 'Jones', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Garcia', 'Martinez', 'Robinson', 'Clark'];

// Store names
const STORE_TYPES = ['Corner Store', 'Mini Mart', 'Grocery', 'Bodega', 'Supermarket', 'Convenience'];
const STORE_NAMES = ['Lucky', 'Golden', 'Quick', 'Family', 'Express', 'Metro', 'City', 'Crown', 'Star', 'Royal'];

// Street names
const STREETS = ['Main St', 'Oak Ave', 'Maple Dr', 'Washington Blvd', 'Park Ave', 'Market St', 'Church St', 'Broadway', 'Center St', 'Liberty Ave', 'Franklin Rd', 'Lincoln Way', 'Jefferson St', 'Madison Ave', 'Monroe Dr'];

// Territories / Regions
const TERRITORIES = ['Downtown', 'North Side', 'East End', 'West District', 'South Valley', 'Central', 'Riverside', 'Hillside', 'Midtown', 'Uptown'];

// Issue types
const ISSUE_TYPES = ['Product Missing', 'Display Damaged', 'Competitor Activity', 'Price Discrepancy', 'Stock Low', 'Store Closed', 'Access Denied', 'Equipment Issue'];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateId(): string {
  return `sim-${Math.random().toString(36).substring(2, 10)}`;
}

function generateName(): string {
  return `${randomFrom(FIRST_NAMES)} ${randomFrom(LAST_NAMES)}`;
}

function generateStoreName(): string {
  return `${randomFrom(STORE_NAMES)} ${randomFrom(STORE_TYPES)}`;
}

function generateAddress(): string {
  return `${randomInt(100, 9999)} ${randomFrom(STREETS)}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DRIVER SIMULATION DATA
// ═══════════════════════════════════════════════════════════════════════════════

export interface SimDriver {
  id: string;
  full_name: string;
  phone: string;
  status: 'active' | 'on_route' | 'offline';
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

export function generateSimDrivers(count: number = 8): SimDriver[] {
  return Array.from({ length: count }, () => ({
    id: generateId(),
    full_name: generateName(),
    phone: `(555) ${randomInt(100, 999)}-${randomInt(1000, 9999)}`,
    status: randomFrom(['active', 'on_route', 'offline'] as const),
    vehicle_type: randomFrom(['Van', 'SUV', 'Sedan', 'Pickup']),
    territory: randomFrom(TERRITORIES),
    routes_today: randomInt(1, 4),
    stops_completed: randomInt(0, 15),
    stops_pending: randomInt(0, 10),
    estimated_earnings: randomInt(80, 250),
    debt_balance: Math.random() > 0.7 ? randomInt(50, 500) : 0,
    rating: Number((3.5 + Math.random() * 1.5).toFixed(1)),
    is_simulated: true,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// BIKER SIMULATION DATA
// ═══════════════════════════════════════════════════════════════════════════════

export interface SimBiker {
  id: string;
  full_name: string;
  phone: string;
  status: 'active' | 'on_task' | 'offline';
  territory: string;
  tasks_today: number;
  tasks_completed: number;
  tasks_pending: number;
  issues_reported: number;
  performance_score: number;
  estimated_earnings: number;
  is_simulated: true;
}

export function generateSimBikers(count: number = 6): SimBiker[] {
  return Array.from({ length: count }, () => {
    const tasks = randomInt(3, 12);
    const completed = randomInt(0, tasks);
    return {
      id: generateId(),
      full_name: generateName(),
      phone: `(555) ${randomInt(100, 999)}-${randomInt(1000, 9999)}`,
      status: randomFrom(['active', 'on_task', 'offline'] as const),
      territory: randomFrom(TERRITORIES),
      tasks_today: tasks,
      tasks_completed: completed,
      tasks_pending: tasks - completed,
      issues_reported: randomInt(0, 3),
      performance_score: randomInt(70, 100),
      estimated_earnings: randomInt(50, 150),
      is_simulated: true,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE / DELIVERY SIMULATION DATA
// ═══════════════════════════════════════════════════════════════════════════════

export interface SimStop {
  id: string;
  sequence: number;
  store_name: string;
  address: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  amount_due: number;
  window_start: string;
  window_end: string;
  notes: string;
  is_simulated: true;
}

export interface SimRoute {
  id: string;
  driver_name: string;
  driver_id: string;
  scheduled_date: string;
  status: 'scheduled' | 'in_progress' | 'completed';
  priority: 'normal' | 'high' | 'urgent';
  delivery_type: string;
  stops: SimStop[];
  total_stops: number;
  completed_stops: number;
  estimated_earnings: number;
  dispatcher_notes: string;
  is_simulated: true;
}

export function generateSimStops(count: number = 5): SimStop[] {
  const statuses: ('pending' | 'in_progress' | 'completed' | 'skipped')[] = [];
  for (let i = 0; i < count; i++) {
    if (i < count / 3) statuses.push('completed');
    else if (i === Math.floor(count / 3)) statuses.push('in_progress');
    else statuses.push('pending');
  }

  return Array.from({ length: count }, (_, i) => {
    const hour = 8 + i * 2;
    return {
      id: generateId(),
      sequence: i + 1,
      store_name: generateStoreName(),
      address: generateAddress(),
      status: statuses[i],
      amount_due: Math.random() > 0.6 ? randomInt(50, 300) : 0,
      window_start: `${String(hour).padStart(2, '0')}:00`,
      window_end: `${String(hour + 2).padStart(2, '0')}:00`,
      notes: Math.random() > 0.7 ? randomFrom(['Call on arrival', 'Ring bell twice', 'Ask for manager', 'Side entrance']) : '',
      is_simulated: true,
    };
  });
}

export function generateSimRoutes(count: number = 3): SimRoute[] {
  const today = format(new Date(), 'yyyy-MM-dd');
  return Array.from({ length: count }, (_, i) => {
    const stops = generateSimStops(randomInt(3, 8));
    const completed = stops.filter(s => s.status === 'completed').length;
    return {
      id: generateId(),
      driver_name: generateName(),
      driver_id: generateId(),
      scheduled_date: i === 0 ? today : format(addDays(new Date(), i), 'yyyy-MM-dd'),
      status: i === 0 ? (completed > 0 ? 'in_progress' : 'scheduled') : 'scheduled',
      priority: randomFrom(['normal', 'high', 'urgent'] as const),
      delivery_type: randomFrom(['wholesale', 'store_check', 'restock', 'urgent_delivery']),
      stops,
      total_stops: stops.length,
      completed_stops: completed,
      estimated_earnings: randomInt(80, 200),
      dispatcher_notes: Math.random() > 0.6 ? randomFrom(['Priority customer at stop 2', 'New store - get photos', 'Construction on Main St - use alternate route']) : '',
      is_simulated: true,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVITY FEED SIMULATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface SimActivityItem {
  id: string;
  type: 'delivery' | 'biker' | 'issue' | 'payout' | 'route';
  message: string;
  timestamp: Date;
  entity_id: string;
  entity_type: string;
  severity: 'info' | 'warning' | 'success' | 'error';
  is_simulated: true;
}

export function generateSimActivityFeed(count: number = 10): SimActivityItem[] {
  const activities: SimActivityItem[] = [];
  const now = new Date();

  const templates = [
    { type: 'delivery' as const, severity: 'success' as const, message: (name: string, store: string) => `${name} completed delivery at ${store}` },
    { type: 'biker' as const, severity: 'info' as const, message: (name: string, store: string) => `${name} started store check at ${store}` },
    { type: 'issue' as const, severity: 'warning' as const, message: (name: string, store: string) => `Issue reported by ${name} at ${store}` },
    { type: 'route' as const, severity: 'info' as const, message: (name: string) => `Route R-${randomInt(100, 999)} assigned to ${name}` },
    { type: 'payout' as const, severity: 'success' as const, message: (name: string) => `Payout of $${randomInt(80, 200)} approved for ${name}` },
  ];

  for (let i = 0; i < count; i++) {
    const template = randomFrom(templates);
    const name = generateName();
    const store = generateStoreName();
    activities.push({
      id: generateId(),
      type: template.type,
      message: template.message(name, store),
      timestamp: subHours(now, i * 0.5 + Math.random()),
      entity_id: generateId(),
      entity_type: template.type,
      severity: template.severity,
      is_simulated: true,
    });
  }

  return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

// ═══════════════════════════════════════════════════════════════════════════════
// ISSUE SIMULATION DATA
// ═══════════════════════════════════════════════════════════════════════════════

export interface SimIssue {
  id: string;
  reported_by: string;
  reporter_id: string;
  store_name: string;
  store_id: string;
  issue_type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'escalated';
  reported_at: Date;
  sla_deadline: Date;
  is_simulated: true;
}

export function generateSimIssues(count: number = 5): SimIssue[] {
  return Array.from({ length: count }, () => {
    const reportedAt = subHours(new Date(), randomInt(1, 48));
    return {
      id: generateId(),
      reported_by: generateName(),
      reporter_id: generateId(),
      store_name: generateStoreName(),
      store_id: generateId(),
      issue_type: randomFrom(ISSUE_TYPES),
      description: `${randomFrom(ISSUE_TYPES)} observed during store check. ${randomFrom(['Requires immediate attention.', 'Manager was notified.', 'Photos attached.', 'Follow-up needed.'])}`,
      severity: randomFrom(['low', 'medium', 'high', 'critical'] as const),
      status: randomFrom(['open', 'in_progress', 'resolved', 'escalated'] as const),
      reported_at: reportedAt,
      sla_deadline: addHours(reportedAt, randomInt(4, 24)),
      is_simulated: true,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYOUT SIMULATION DATA
// ═══════════════════════════════════════════════════════════════════════════════

export interface SimPayout {
  id: string;
  worker_name: string;
  worker_id: string;
  worker_type: 'driver' | 'biker';
  period_start: string;
  period_end: string;
  total_earned: number;
  adjustments: number;
  debt_withheld: number;
  total_to_pay: number;
  status: 'draft' | 'pending_approval' | 'approved' | 'paid';
  payout_method: string | null;
  created_at: Date;
  is_simulated: true;
}

export function generateSimPayouts(count: number = 8): SimPayout[] {
  const today = new Date();
  return Array.from({ length: count }, () => {
    const earned = randomInt(150, 500);
    const adjustments = Math.random() > 0.7 ? randomInt(-50, 50) : 0;
    const debt = Math.random() > 0.7 ? randomInt(20, 100) : 0;
    return {
      id: generateId(),
      worker_name: generateName(),
      worker_id: generateId(),
      worker_type: randomFrom(['driver', 'biker'] as const),
      period_start: format(subDays(today, 14), 'yyyy-MM-dd'),
      period_end: format(subDays(today, 1), 'yyyy-MM-dd'),
      total_earned: earned,
      adjustments,
      debt_withheld: debt,
      total_to_pay: earned + adjustments - debt,
      status: randomFrom(['draft', 'pending_approval', 'approved', 'paid'] as const),
      payout_method: Math.random() > 0.5 ? randomFrom(['cash', 'zelle', 'ach']) : null,
      created_at: subDays(today, randomInt(0, 7)),
      is_simulated: true,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEBT SIMULATION DATA
// ═══════════════════════════════════════════════════════════════════════════════

export interface SimDebt {
  id: string;
  driver_name: string;
  driver_id: string;
  debt_type: string;
  amount: number;
  remaining: number;
  status: 'active' | 'in_collection' | 'settled' | 'written_off';
  created_at: Date;
  notes: string;
  is_simulated: true;
}

export function generateSimDebts(count: number = 6): SimDebt[] {
  const debtTypes = ['Fuel Advance', 'Equipment Damage', 'Cash Shortage', 'Missing Product', 'Vehicle Repair', 'Uniform Deposit'];
  return Array.from({ length: count }, () => {
    const amount = randomInt(50, 800);
    const paid = Math.random() * amount * 0.7;
    return {
      id: generateId(),
      driver_name: generateName(),
      driver_id: generateId(),
      debt_type: randomFrom(debtTypes),
      amount,
      remaining: Number((amount - paid).toFixed(2)),
      status: randomFrom(['active', 'in_collection', 'settled', 'written_off'] as const),
      created_at: subDays(new Date(), randomInt(7, 90)),
      notes: randomFrom(['Weekly deductions applied', 'Driver agreed to payment plan', 'Disputed - pending review', '']),
      is_simulated: true,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// KPI SIMULATION DATA
// ═══════════════════════════════════════════════════════════════════════════════

export interface SimKPIs {
  deliveries_today: number;
  stops_completed: number;
  stops_pending: number;
  active_drivers: number;
  active_bikers: number;
  open_issues: number;
  payouts_pending: number;
  total_pending_amount: number;
  is_simulated: true;
}

export function generateSimKPIs(): SimKPIs {
  return {
    deliveries_today: randomInt(15, 45),
    stops_completed: randomInt(40, 120),
    stops_pending: randomInt(20, 60),
    active_drivers: randomInt(5, 15),
    active_bikers: randomInt(3, 10),
    open_issues: randomInt(2, 12),
    payouts_pending: randomInt(3, 10),
    total_pending_amount: randomInt(800, 3500),
    is_simulated: true,
  };
}
