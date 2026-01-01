import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSimulationMode } from '@/contexts/SimulationModeContext';

// Types
export interface StaffCategory {
  id: string;
  business_slug: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StaffCategoryKPI {
  id: string;
  staff_category_id: string;
  business_slug: string;
  total_staff: number;
  active_shifts: number;
  completed_events: number;
  revenue_generated: number;
  performance_score: number | null;
  status: 'active' | 'inactive' | 'archived';
  created_at: string;
  updated_at: string;
  // Joined category info
  category?: StaffCategory;
}

export interface StaffCategoryWithKPI extends StaffCategory {
  kpi: StaffCategoryKPI | null;
}

export interface UTStaffMember {
  id: string;
  business_slug: string;
  first_name: string;
  last_name: string;
  display_name?: string;
  email: string | null;
  phone: string | null;
  category_id: string | null;
  category?: StaffCategory;
  dob: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  status: string;
  preferred_contact_method: string | null;
  pay_type: string | null;
  pay_rate: number | null;
  availability_notes: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  events_completed: number | null;
  rating: number | null;
  total_earnings: number | null;
  hire_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateStaffData {
  first_name: string;
  last_name: string;
  email?: string;
  phone: string;
  category_id: string;
  dob: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  zip: string;
  status?: 'active' | 'inactive' | 'pending' | 'on_leave' | 'terminated';
  preferred_contact_method?: string;
  pay_type?: string;
  pay_rate?: number;
  availability_notes?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  notes?: string;
}

// Generate mock staff for simulation
const generateMockStaff = (categories: StaffCategory[]): UTStaffMember[] => {
  const firstNames = ['Maria', 'Carlos', 'Jessica', 'David', 'Sofia', 'Michael', 'Angela', 'Roberto', 'Diana', 'Luis'];
  const lastNames = ['Rodriguez', 'Martinez', 'Garcia', 'Johnson', 'Williams', 'Brown', 'Davis', 'Lopez'];
  const states = ['Florida', 'Texas', 'California', 'New York', 'Nevada', 'Arizona'];
  const cities = ['Miami', 'Houston', 'Los Angeles', 'New York City', 'Las Vegas', 'Phoenix'];

  return Array.from({ length: 25 }, (_, idx) => {
    const firstName = firstNames[idx % firstNames.length];
    const lastName = lastNames[idx % lastNames.length];
    const category = categories[idx % categories.length];
    const stateIdx = idx % states.length;

    return {
      id: `sim-staff-${idx + 1}`,
      business_slug: 'unforgettable_times_usa',
      first_name: firstName,
      last_name: lastName,
      display_name: `${firstName} ${lastName}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@unforgettable.com`,
      phone: `(555) ${String(100 + idx).padStart(3, '0')}-${String(1000 + idx * 11).slice(0, 4)}`,
      category_id: category?.id || null,
      category,
      dob: `19${85 + (idx % 15)}-${String((idx % 12) + 1).padStart(2, '0')}-${String((idx % 28) + 1).padStart(2, '0')}`,
      address_line_1: `${1000 + idx * 10} Event Street`,
      address_line_2: idx % 3 === 0 ? `Suite ${idx + 100}` : null,
      city: cities[stateIdx],
      state: states[stateIdx],
      zip: `${30000 + idx * 100}`,
      status: idx < 20 ? 'active' : idx < 23 ? 'pending' : 'on_leave',
      preferred_contact_method: idx % 3 === 0 ? 'call' : idx % 3 === 1 ? 'text' : 'email',
      pay_type: idx % 2 === 0 ? 'hourly' : 'per_event',
      pay_rate: 25 + (idx * 5) % 50,
      availability_notes: idx % 4 === 0 ? 'Weekends only' : null,
      emergency_contact_name: `Emergency Contact ${idx}`,
      emergency_contact_phone: `(555) 999-${String(1000 + idx).slice(0, 4)}`,
      notes: null,
      events_completed: Math.floor(Math.random() * 50) + 5,
      rating: 4 + Math.random(),
      total_earnings: Math.floor(Math.random() * 15000) + 2000,
      hire_date: `2023-${String((idx % 12) + 1).padStart(2, '0')}-${String((idx % 28) + 1).padStart(2, '0')}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });
};

// Hook: Fetch staff categories
export function useStaffCategories() {
  const { simulationMode } = useSimulationMode();

  return useQuery({
    queryKey: ['ut-staff-categories'],
    queryFn: async (): Promise<StaffCategory[]> => {
      if (simulationMode) {
        return [
          { id: 'sim-1', business_slug: 'unforgettable_times_usa', name: 'Security', description: 'Event security personnel', is_active: true, created_at: '', updated_at: '' },
          { id: 'sim-2', business_slug: 'unforgettable_times_usa', name: 'Decorators', description: 'Event decoration specialists', is_active: true, created_at: '', updated_at: '' },
          { id: 'sim-3', business_slug: 'unforgettable_times_usa', name: 'Bartenders', description: 'Beverage service professionals', is_active: true, created_at: '', updated_at: '' },
          { id: 'sim-4', business_slug: 'unforgettable_times_usa', name: 'Host', description: 'Event hosts and hostesses', is_active: true, created_at: '', updated_at: '' },
          { id: 'sim-5', business_slug: 'unforgettable_times_usa', name: 'Costume Wearers', description: 'Character performers and mascots', is_active: true, created_at: '', updated_at: '' },
          { id: 'sim-6', business_slug: 'unforgettable_times_usa', name: 'Magicians', description: 'Magic and illusion performers', is_active: true, created_at: '', updated_at: '' },
          { id: 'sim-7', business_slug: 'unforgettable_times_usa', name: 'Clowns', description: 'Clown entertainers', is_active: true, created_at: '', updated_at: '' },
          { id: 'sim-8', business_slug: 'unforgettable_times_usa', name: 'Private Chefs', description: 'Personal and event chefs', is_active: true, created_at: '', updated_at: '' },
          { id: 'sim-9', business_slug: 'unforgettable_times_usa', name: 'Catering Crews', description: 'Catering service teams', is_active: true, created_at: '', updated_at: '' },
          { id: 'sim-10', business_slug: 'unforgettable_times_usa', name: 'DJ', description: 'Disc jockeys and music entertainment', is_active: true, created_at: '', updated_at: '' },
        ];
      }

      const { data, error } = await supabase
        .from('ut_staff_categories')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as StaffCategory[];
    },
  });
}

// Hook: Fetch staff categories with KPI cards joined
export function useStaffCategoriesWithKPIs() {
  const { simulationMode } = useSimulationMode();

  return useQuery({
    queryKey: ['ut-staff-categories-with-kpis'],
    queryFn: async (): Promise<StaffCategoryWithKPI[]> => {
      if (simulationMode) {
        return [
          { id: 'sim-1', business_slug: 'unforgettable_times_usa', name: 'Security', description: 'Event security personnel', is_active: true, created_at: '', updated_at: '', kpi: { id: 'kpi-1', staff_category_id: 'sim-1', business_slug: 'unforgettable_times_usa', total_staff: 12, active_shifts: 5, completed_events: 48, revenue_generated: 24000, performance_score: 4.5, status: 'active', created_at: '', updated_at: '' } },
          { id: 'sim-2', business_slug: 'unforgettable_times_usa', name: 'Decorators', description: 'Event decoration specialists', is_active: true, created_at: '', updated_at: '', kpi: { id: 'kpi-2', staff_category_id: 'sim-2', business_slug: 'unforgettable_times_usa', total_staff: 8, active_shifts: 3, completed_events: 32, revenue_generated: 18500, performance_score: 4.8, status: 'active', created_at: '', updated_at: '' } },
          { id: 'sim-3', business_slug: 'unforgettable_times_usa', name: 'Bartenders', description: 'Beverage service professionals', is_active: true, created_at: '', updated_at: '', kpi: { id: 'kpi-3', staff_category_id: 'sim-3', business_slug: 'unforgettable_times_usa', total_staff: 15, active_shifts: 8, completed_events: 67, revenue_generated: 42000, performance_score: 4.7, status: 'active', created_at: '', updated_at: '' } },
          { id: 'sim-4', business_slug: 'unforgettable_times_usa', name: 'Host', description: 'Event hosts and hostesses', is_active: true, created_at: '', updated_at: '', kpi: { id: 'kpi-4', staff_category_id: 'sim-4', business_slug: 'unforgettable_times_usa', total_staff: 6, active_shifts: 2, completed_events: 25, revenue_generated: 12000, performance_score: 4.9, status: 'active', created_at: '', updated_at: '' } },
          { id: 'sim-5', business_slug: 'unforgettable_times_usa', name: 'Costume Wearers', description: 'Character performers and mascots', is_active: true, created_at: '', updated_at: '', kpi: { id: 'kpi-5', staff_category_id: 'sim-5', business_slug: 'unforgettable_times_usa', total_staff: 10, active_shifts: 4, completed_events: 38, revenue_generated: 22000, performance_score: 4.6, status: 'active', created_at: '', updated_at: '' } },
        ];
      }

      // Query categories with their KPI cards joined
      const { data, error } = await supabase
        .from('ut_staff_categories')
        .select(`
          *,
          kpi:ut_staff_category_kpis(*)
        `)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      // Transform the data - kpi comes as an array from the join, we need the first item
      return (data || []).map((cat: Record<string, unknown>) => ({
        ...cat,
        kpi: Array.isArray(cat.kpi) && cat.kpi.length > 0 ? cat.kpi[0] : null,
      })) as StaffCategoryWithKPI[];
    },
  });
}

// Hook: Create staff category (KPI auto-created via database trigger)
export function useCreateStaffCategory() {
  const queryClient = useQueryClient();
  const { simulationMode } = useSimulationMode();

  return useMutation({
    mutationFn: async (data: { name: string; description?: string }): Promise<StaffCategory> => {
      if (simulationMode) {
        toast.success('Category created (simulation)');
        return {
          id: `sim-new-${Date.now()}`,
          business_slug: 'unforgettable_times_usa',
          name: data.name,
          description: data.description || null,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      const { data: result, error } = await supabase
        .from('ut_staff_categories')
        .insert({
          name: data.name,
          description: data.description,
          business_slug: 'unforgettable_times_usa',
        })
        .select()
        .single();

      if (error) throw error;
      return result as StaffCategory;
    },
    onSuccess: () => {
      // Invalidate both category queries to ensure UI updates
      queryClient.invalidateQueries({ queryKey: ['ut-staff-categories'] });
      queryClient.invalidateQueries({ queryKey: ['ut-staff-categories-with-kpis'] });
      toast.success('Category created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create category: ${error.message}`);
    },
  });
}

// Hook: Fetch staff list
export function useStaffList(filters?: { category_id?: string; state?: string; status?: string }) {
  const { simulationMode } = useSimulationMode();
  const { data: categories } = useStaffCategories();

  return useQuery({
    queryKey: ['ut-staff-list', filters],
    queryFn: async (): Promise<UTStaffMember[]> => {
      if (simulationMode && categories) {
        let staff = generateMockStaff(categories);
        if (filters?.category_id) {
          staff = staff.filter(s => s.category_id === filters.category_id);
        }
        if (filters?.state) {
          staff = staff.filter(s => s.state === filters.state);
        }
        if (filters?.status) {
          staff = staff.filter(s => s.status === filters.status);
        }
        return staff;
      }

      const baseQuery = supabase
        .from('ut_staff')
        .select(`
          *,
          category:ut_staff_categories(*)
        `)
        .eq('business_slug', 'unforgettable_times_usa')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      // Apply filters - use type assertion since we know the column values
      let finalQuery = baseQuery;
      if (filters?.category_id) {
        finalQuery = finalQuery.eq('category_id', filters.category_id);
      }
      if (filters?.state) {
        finalQuery = finalQuery.eq('state', filters.state);
      }
      if (filters?.status && ['active', 'inactive', 'pending', 'on_leave', 'terminated'].includes(filters.status)) {
        finalQuery = finalQuery.eq('status', filters.status as 'active' | 'inactive' | 'pending' | 'on_leave' | 'terminated');
      }

      const { data, error } = await finalQuery;
      if (error) throw error;
      return (data || []) as unknown as UTStaffMember[];
    },
    enabled: !simulationMode || !!categories,
  });
}

// Hook: Fetch single staff member
export function useStaffMember(staffId: string | undefined) {
  const { simulationMode } = useSimulationMode();
  const { data: categories } = useStaffCategories();

  return useQuery({
    queryKey: ['ut-staff-member', staffId],
    queryFn: async (): Promise<UTStaffMember | null> => {
      if (!staffId) return null;

      if (simulationMode && categories) {
        const mockStaff = generateMockStaff(categories);
        return mockStaff.find(s => s.id === staffId) || mockStaff[0];
      }

      const { data, error } = await supabase
        .from('ut_staff')
        .select(`
          *,
          category:ut_staff_categories(*)
        `)
        .eq('id', staffId)
        .single();

      if (error) throw error;
      return data as unknown as UTStaffMember;
    },
    enabled: !!staffId && (!simulationMode || !!categories),
  });
}

// Hook: Create staff member
export function useCreateStaff() {
  const queryClient = useQueryClient();
  const { simulationMode } = useSimulationMode();

  return useMutation({
    mutationFn: async (data: CreateStaffData): Promise<UTStaffMember> => {
      if (simulationMode) {
        toast.success('Staff member created (simulation)');
        return {
          id: `sim-new-${Date.now()}`,
          business_slug: 'unforgettable_times_usa',
          first_name: data.first_name,
          last_name: data.last_name,
          display_name: `${data.first_name} ${data.last_name}`,
          email: data.email || null,
          phone: data.phone,
          category_id: data.category_id,
          dob: data.dob,
          address_line_1: data.address_line_1,
          address_line_2: data.address_line_2 || null,
          city: data.city,
          state: data.state,
          zip: data.zip,
          status: data.status || 'active',
          preferred_contact_method: data.preferred_contact_method || 'call',
          pay_type: data.pay_type || 'hourly',
          pay_rate: data.pay_rate || null,
          availability_notes: data.availability_notes || null,
          emergency_contact_name: data.emergency_contact_name || null,
          emergency_contact_phone: data.emergency_contact_phone || null,
          notes: data.notes || null,
          events_completed: 0,
          rating: 5.0,
          total_earnings: 0,
          hire_date: new Date().toISOString().split('T')[0],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      // Build insert object and use type bypass
      const insertPayload = {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email || null,
        phone: data.phone,
        category_id: data.category_id,
        dob: data.dob,
        address_line_1: data.address_line_1,
        address_line_2: data.address_line_2 || null,
        city: data.city,
        state: data.state,
        zip: data.zip,
        status: 'active' as const,
        preferred_contact_method: data.preferred_contact_method || null,
        pay_type: data.pay_type || null,
        pay_rate: data.pay_rate || null,
        availability_notes: data.availability_notes || null,
        emergency_contact_name: data.emergency_contact_name || null,
        emergency_contact_phone: data.emergency_contact_phone || null,
        notes: data.notes || null,
        business_slug: 'unforgettable_times_usa',
        role: 'event_coordinator_assistant' as const,
        category: 'event_staff' as const,
        employment_type: 'contractor' as const,
      };

      const { data: result, error } = await supabase
        .from('ut_staff')
        .insert(insertPayload)
        .select(`
          *,
          category:ut_staff_categories(*)
        `)
        .single();

      if (error) throw error;
      return result as unknown as UTStaffMember;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ut-staff-list'] });
      toast.success('Staff member created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create staff: ${error.message}`);
    },
  });
}

// Hook: Update staff member
export function useUpdateStaff() {
  const queryClient = useQueryClient();
  const { simulationMode } = useSimulationMode();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateStaffData> }): Promise<UTStaffMember> => {
      if (simulationMode) {
        toast.success('Staff member updated (simulation)');
        return { id, ...data } as unknown as UTStaffMember;
      }

      const { data: result, error } = await supabase
        .from('ut_staff')
        .update(data as Record<string, unknown>)
        .eq('id', id)
        .select(`
          *,
          category:ut_staff_categories(*)
        `)
        .single();

      if (error) throw error;
      return result as unknown as UTStaffMember;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ut-staff-list'] });
      queryClient.invalidateQueries({ queryKey: ['ut-staff-member', variables.id] });
      toast.success('Staff member updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update staff: ${error.message}`);
    },
  });
}
