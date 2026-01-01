/**
 * useUnforgettableStaffTabs
 * 
 * SYSTEM LAW: Tabs are views into data, not decorations.
 * If a tab doesn't query by staff ID, it is broken.
 * 
 * Hooks for staff profile tabs: Events, Payments, Performance, Documents
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSimulationMode } from '@/contexts/SimulationModeContext';

// ============================================
// TYPES
// ============================================

export interface UTEvent {
  id: string;
  business_slug: string;
  event_name: string;
  event_type: string | null;
  venue_name: string | null;
  venue_address: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  notes: string | null;
  total_staff_needed: number;
  total_revenue: number;
  created_at: string;
  updated_at: string;
}

export interface UTEventStaff {
  id: string;
  event_id: string;
  staff_id: string;
  role_at_event: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_check_in: string | null;
  actual_check_out: string | null;
  hours_worked: number | null;
  pay_rate_applied: number | null;
  amount_earned: number | null;
  status: 'assigned' | 'confirmed' | 'checked_in' | 'completed' | 'no_show' | 'cancelled';
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  event?: UTEvent;
}

export interface UTStaffPayment {
  id: string;
  staff_id: string;
  event_id: string | null;
  event_staff_id: string | null;
  business_slug: string;
  payment_date: string;
  amount: number;
  payment_type: 'event' | 'bonus' | 'advance' | 'reimbursement' | 'adjustment' | 'other';
  payment_method: 'cash' | 'check' | 'direct_deposit' | 'venmo' | 'zelle' | 'paypal' | 'other' | null;
  status: 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled';
  reference_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  event?: UTEvent | null;
}

export interface UTStaffDocument {
  id: string;
  staff_id: string;
  business_slug: string;
  document_name: string;
  document_type: 'contract' | 'id' | 'certification' | 'agreement' | 'tax_form' | 'background_check' | 'other';
  file_url: string | null;
  file_size: number | null;
  mime_type: string | null;
  uploaded_at: string;
  expiry_date: string | null;
  status: 'active' | 'expired' | 'archived' | 'pending_review';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StaffPerformanceMetrics {
  totalEvents: number;
  completedEvents: number;
  cancelledEvents: number;
  noShowEvents: number;
  attendanceRate: number;
  totalHoursWorked: number;
  avgHoursPerEvent: number;
  totalEarnings: number;
  avgEarningsPerEvent: number;
  rating: number | null;
  recentEvents: UTEventStaff[];
}

// ============================================
// SIMULATION DATA GENERATORS
// ============================================

const generateSimulatedEvents = (staffId: string): UTEventStaff[] => {
  const eventTypes = ['Birthday Party', 'Wedding Reception', 'Corporate Event', 'Anniversary', 'Graduation', 'Holiday Party'];
  const venues = ['Grand Ballroom', 'Garden Terrace', 'City Convention Center', 'Riverside Pavilion', 'Downtown Hotel'];
  const statuses: UTEventStaff['status'][] = ['completed', 'completed', 'completed', 'confirmed', 'assigned'];

  return Array.from({ length: 8 }, (_, idx) => {
    const daysAgo = idx * 7 - 14; // Mix of past and future
    const eventDate = new Date();
    eventDate.setDate(eventDate.getDate() + daysAgo);
    const status = daysAgo < 0 ? 'completed' : statuses[idx % statuses.length];

    return {
      id: `sim-es-${staffId}-${idx}`,
      event_id: `sim-event-${idx}`,
      staff_id: staffId,
      role_at_event: ['Server', 'Bartender', 'Host', 'Security', 'Decorator'][idx % 5],
      scheduled_start: '10:00',
      scheduled_end: '18:00',
      actual_check_in: status === 'completed' ? `${eventDate.toISOString().split('T')[0]}T10:05:00Z` : null,
      actual_check_out: status === 'completed' ? `${eventDate.toISOString().split('T')[0]}T18:15:00Z` : null,
      hours_worked: status === 'completed' ? 8 + Math.random() : null,
      pay_rate_applied: 25 + (idx * 5) % 25,
      amount_earned: status === 'completed' ? (25 + (idx * 5) % 25) * 8 : null,
      status,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      event: {
        id: `sim-event-${idx}`,
        business_slug: 'unforgettable_times_usa',
        event_name: `${eventTypes[idx % eventTypes.length]} - ${venues[idx % venues.length]}`,
        event_type: eventTypes[idx % eventTypes.length].split(' ')[0].toLowerCase(),
        venue_name: venues[idx % venues.length],
        venue_address: `${1000 + idx * 100} Event Avenue`,
        event_date: eventDate.toISOString().split('T')[0],
        start_time: '10:00',
        end_time: '18:00',
        status: daysAgo < 0 ? 'completed' : 'scheduled',
        client_name: `Client ${idx + 1}`,
        client_phone: `(555) ${100 + idx}-${1000 + idx}`,
        client_email: `client${idx + 1}@example.com`,
        notes: null,
        total_staff_needed: 3 + (idx % 4),
        total_revenue: 2500 + idx * 500,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    };
  });
};

const generateSimulatedPayments = (staffId: string): UTStaffPayment[] => {
  const paymentTypes: UTStaffPayment['payment_type'][] = ['event', 'event', 'event', 'bonus', 'reimbursement'];
  const methods: UTStaffPayment['payment_method'][] = ['direct_deposit', 'venmo', 'check', 'zelle', 'cash'];
  const statuses: UTStaffPayment['status'][] = ['paid', 'paid', 'paid', 'pending', 'processing'];

  return Array.from({ length: 10 }, (_, idx) => {
    const daysAgo = idx * 14;
    const paymentDate = new Date();
    paymentDate.setDate(paymentDate.getDate() - daysAgo);

    return {
      id: `sim-payment-${staffId}-${idx}`,
      staff_id: staffId,
      event_id: idx < 7 ? `sim-event-${idx}` : null,
      event_staff_id: null,
      business_slug: 'unforgettable_times_usa',
      payment_date: paymentDate.toISOString().split('T')[0],
      amount: 150 + Math.floor(Math.random() * 200),
      payment_type: paymentTypes[idx % paymentTypes.length],
      payment_method: methods[idx % methods.length],
      status: statuses[idx % statuses.length],
      reference_number: statuses[idx % statuses.length] === 'paid' ? `REF-${Date.now()}-${idx}` : null,
      notes: idx % 4 === 0 ? 'Great work on this event!' : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      event: idx < 7 ? {
        id: `sim-event-${idx}`,
        business_slug: 'unforgettable_times_usa',
        event_name: `Event ${idx + 1}`,
        event_type: 'party',
        venue_name: `Venue ${idx + 1}`,
        venue_address: null,
        event_date: paymentDate.toISOString().split('T')[0],
        start_time: null,
        end_time: null,
        status: 'completed',
        client_name: null,
        client_phone: null,
        client_email: null,
        notes: null,
        total_staff_needed: 1,
        total_revenue: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } : null,
    };
  });
};

const generateSimulatedDocuments = (staffId: string): UTStaffDocument[] => {
  const docTypes: UTStaffDocument['document_type'][] = ['contract', 'id', 'certification', 'tax_form', 'background_check'];
  const docNames = ['Employment Contract', 'Driver License', 'Food Handler Certificate', 'W-9 Form', 'Background Check Report'];

  return Array.from({ length: 5 }, (_, idx) => {
    const uploadDate = new Date();
    uploadDate.setMonth(uploadDate.getMonth() - idx * 2);
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    return {
      id: `sim-doc-${staffId}-${idx}`,
      staff_id: staffId,
      business_slug: 'unforgettable_times_usa',
      document_name: docNames[idx],
      document_type: docTypes[idx],
      file_url: null,
      file_size: 1024 * (50 + idx * 100),
      mime_type: 'application/pdf',
      uploaded_at: uploadDate.toISOString(),
      expiry_date: idx === 1 || idx === 2 ? expiryDate.toISOString().split('T')[0] : null,
      status: 'active',
      notes: null,
      created_at: uploadDate.toISOString(),
      updated_at: uploadDate.toISOString(),
    };
  });
};

// ============================================
// HOOKS: EVENTS TAB
// ============================================

export function useStaffEvents(staffId: string | undefined) {
  const { simulationMode } = useSimulationMode();

  return useQuery({
    queryKey: ['ut-staff-events', staffId],
    queryFn: async (): Promise<UTEventStaff[]> => {
      if (!staffId) return [];

      if (simulationMode) {
        return generateSimulatedEvents(staffId);
      }

      const { data, error } = await supabase
        .from('ut_event_staff')
        .select(`
          *,
          event:ut_events(*)
        `)
        .eq('staff_id', staffId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as UTEventStaff[];
    },
    enabled: !!staffId,
  });
}

// ============================================
// HOOKS: PAYMENTS TAB
// ============================================

export function useStaffPayments(staffId: string | undefined) {
  const { simulationMode } = useSimulationMode();

  return useQuery({
    queryKey: ['ut-staff-payments', staffId],
    queryFn: async (): Promise<UTStaffPayment[]> => {
      if (!staffId) return [];

      if (simulationMode) {
        return generateSimulatedPayments(staffId);
      }

      const { data, error } = await supabase
        .from('ut_staff_payments')
        .select(`
          *,
          event:ut_events(id, event_name, event_date)
        `)
        .eq('staff_id', staffId)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as UTStaffPayment[];
    },
    enabled: !!staffId,
  });
}

export function useCreateStaffPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<UTStaffPayment, 'id' | 'created_at' | 'updated_at'>) => {
      const { data: result, error } = await supabase
        .from('ut_staff_payments')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ut-staff-payments', variables.staff_id] });
      toast.success('Payment recorded successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to record payment: ${error.message}`);
    },
  });
}

export function useUpdatePaymentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, staffId, status }: { id: string; staffId: string; status: UTStaffPayment['status'] }) => {
      const { error } = await supabase
        .from('ut_staff_payments')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ut-staff-payments', variables.staffId] });
      toast.success('Payment status updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update payment: ${error.message}`);
    },
  });
}

// ============================================
// HOOKS: DOCUMENTS TAB
// ============================================

export function useStaffDocuments(staffId: string | undefined) {
  const { simulationMode } = useSimulationMode();

  return useQuery({
    queryKey: ['ut-staff-documents', staffId],
    queryFn: async (): Promise<UTStaffDocument[]> => {
      if (!staffId) return [];

      if (simulationMode) {
        return generateSimulatedDocuments(staffId);
      }

      const { data, error } = await supabase
        .from('ut_staff_documents')
        .select('*')
        .eq('staff_id', staffId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      return (data || []) as UTStaffDocument[];
    },
    enabled: !!staffId,
  });
}

export function useDeleteStaffDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, staffId }: { id: string; staffId: string }) => {
      const { error } = await supabase
        .from('ut_staff_documents')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ut-staff-documents', variables.staffId] });
      toast.success('Document deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete document: ${error.message}`);
    },
  });
}

// ============================================
// HOOKS: PERFORMANCE TAB
// ============================================

export function useStaffPerformance(staffId: string | undefined) {
  const { data: events, isLoading: eventsLoading } = useStaffEvents(staffId);
  const { data: payments, isLoading: paymentsLoading } = useStaffPayments(staffId);

  const metrics: StaffPerformanceMetrics | null = events && payments ? (() => {
    const completedEvents = events.filter(e => e.status === 'completed');
    const cancelledEvents = events.filter(e => e.status === 'cancelled');
    const noShowEvents = events.filter(e => e.status === 'no_show');
    const totalHours = completedEvents.reduce((sum, e) => sum + (e.hours_worked || 0), 0);
    const paidPayments = payments.filter(p => p.status === 'paid');
    const totalEarnings = paidPayments.reduce((sum, p) => sum + p.amount, 0);

    return {
      totalEvents: events.length,
      completedEvents: completedEvents.length,
      cancelledEvents: cancelledEvents.length,
      noShowEvents: noShowEvents.length,
      attendanceRate: events.length > 0 
        ? (completedEvents.length / (completedEvents.length + noShowEvents.length)) * 100 
        : 100,
      totalHoursWorked: totalHours,
      avgHoursPerEvent: completedEvents.length > 0 ? totalHours / completedEvents.length : 0,
      totalEarnings,
      avgEarningsPerEvent: completedEvents.length > 0 ? totalEarnings / completedEvents.length : 0,
      rating: null, // From staff record
      recentEvents: events.slice(0, 5),
    };
  })() : null;

  return {
    metrics,
    isLoading: eventsLoading || paymentsLoading,
  };
}
