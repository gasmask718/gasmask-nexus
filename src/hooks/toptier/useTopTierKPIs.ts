import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSimulationMode } from '@/contexts/SimulationModeContext';
import { 
  Car, 
  Users, 
  UserCheck, 
  UserX, 
  Clock, 
  AlertCircle,
  Sparkles,
  Calendar,
  CheckCircle,
  DollarSign,
  Gift,
  Plane,
  PlaneTakeoff,
  PlaneLanding,
  Timer,
  Building2,
  LucideIcon
} from 'lucide-react';

export interface TopTierKPI {
  id: string;
  section: 'drivers' | 'experiences' | 'jets' | 'charters';
  name: string;
  description?: string;
  value: number;
  icon: LucideIcon;
  color: 'cyan' | 'green' | 'amber' | 'purple' | 'red' | 'default';
  isCore: boolean; // true = code-defined, false = admin-created
}

interface KPICounts {
  drivers: {
    total: number;
    withVehicle: number;
    withoutVehicle: number;
    active: number;
    onDuty: number;
    offDuty: number;
    assigned: number;
    unassigned: number;
  };
  experiences: {
    total: number;
    available: number;
    booked: number;
    pending: number;
    partnerProvided: number;
    complimentary: number;
    revenueGenerating: number;
  };
  jets: {
    total: number;
    available: number;
    booked: number;
    maintenance: number;
    pendingApproval: number;
    partnerJets: number;
  };
  charters: {
    total: number;
    pending: number;
    approved: number;
    confirmed: number;
    completed: number;
  };
}

export function useTopTierKPIs() {
  const { simulationMode } = useSimulationMode();

  const { data: counts, isLoading, refetch } = useQuery({
    queryKey: ['toptier-kpis', simulationMode],
    queryFn: async (): Promise<KPICounts> => {
      const simFilter = simulationMode !== undefined 
        ? { is_simulation: simulationMode } 
        : {};

      // Fetch all counts in parallel
      const [
        driversData,
        experiencesData,
        jetsData,
        chartersData
      ] = await Promise.all([
        supabase.from('tt_drivers').select('id, status, duty_status, assignment_status, has_vehicle').match(simFilter),
        supabase.from('tt_experiences').select('id, status, is_partner_provided, is_complimentary, price').match(simFilter),
        supabase.from('tt_private_jets').select('id, status, approval_status, is_partner_jet').match(simFilter),
        supabase.from('tt_charter_requests').select('id, status').match(simFilter)
      ]);

      const drivers = driversData.data || [];
      const experiences = experiencesData.data || [];
      const jets = jetsData.data || [];
      const charters = chartersData.data || [];

      return {
        drivers: {
          total: drivers.length,
          withVehicle: drivers.filter(d => d.has_vehicle).length,
          withoutVehicle: drivers.filter(d => !d.has_vehicle).length,
          active: drivers.filter(d => d.status === 'active').length,
          onDuty: drivers.filter(d => d.duty_status === 'on_duty').length,
          offDuty: drivers.filter(d => d.duty_status === 'off_duty').length,
          assigned: drivers.filter(d => d.assignment_status === 'assigned').length,
          unassigned: drivers.filter(d => d.assignment_status === 'unassigned').length,
        },
        experiences: {
          total: experiences.length,
          available: experiences.filter(e => e.status === 'available').length,
          booked: experiences.filter(e => e.status === 'booked').length,
          pending: experiences.filter(e => e.status === 'pending').length,
          partnerProvided: experiences.filter(e => e.is_partner_provided).length,
          complimentary: experiences.filter(e => e.is_complimentary).length,
          revenueGenerating: experiences.filter(e => !e.is_complimentary && e.price && e.price > 0).length,
        },
        jets: {
          total: jets.length,
          available: jets.filter(j => j.status === 'available').length,
          booked: jets.filter(j => j.status === 'booked').length,
          maintenance: jets.filter(j => j.status === 'maintenance').length,
          pendingApproval: jets.filter(j => j.approval_status === 'pending').length,
          partnerJets: jets.filter(j => j.is_partner_jet).length,
        },
        charters: {
          total: charters.length,
          pending: charters.filter(c => c.status === 'pending').length,
          approved: charters.filter(c => c.status === 'approved').length,
          confirmed: charters.filter(c => c.status === 'confirmed').length,
          completed: charters.filter(c => c.status === 'completed').length,
        }
      };
    },
    staleTime: 30000, // 30 seconds
  });

  // Generate core KPIs from counts
  const generateCoreKPIs = (counts: KPICounts): TopTierKPI[] => {
    return [
      // DRIVERS KPIs
      { id: 'drivers-total', section: 'drivers', name: 'Total Drivers', value: counts.drivers.total, icon: Users, color: 'cyan', isCore: true },
      { id: 'drivers-with-vehicle', section: 'drivers', name: 'Drivers With Cars', value: counts.drivers.withVehicle, icon: Car, color: 'green', isCore: true },
      { id: 'drivers-no-vehicle', section: 'drivers', name: 'Drivers Without Cars', value: counts.drivers.withoutVehicle, icon: AlertCircle, color: 'amber', isCore: true },
      { id: 'drivers-active', section: 'drivers', name: 'Active Drivers', value: counts.drivers.active, icon: UserCheck, color: 'green', isCore: true },
      { id: 'drivers-on-duty', section: 'drivers', name: 'On Duty Now', value: counts.drivers.onDuty, icon: Clock, color: 'cyan', isCore: true },
      { id: 'drivers-unassigned', section: 'drivers', name: 'Awaiting Assignment', value: counts.drivers.unassigned, icon: UserX, color: 'amber', isCore: true },
      
      // EXPERIENCES KPIs
      { id: 'exp-total', section: 'experiences', name: 'Total Experiences', value: counts.experiences.total, icon: Sparkles, color: 'purple', isCore: true },
      { id: 'exp-available', section: 'experiences', name: 'Available Now', value: counts.experiences.available, icon: CheckCircle, color: 'green', isCore: true },
      { id: 'exp-booked', section: 'experiences', name: 'Booked', value: counts.experiences.booked, icon: Calendar, color: 'cyan', isCore: true },
      { id: 'exp-pending', section: 'experiences', name: 'Pending Confirmation', value: counts.experiences.pending, icon: Timer, color: 'amber', isCore: true },
      { id: 'exp-partner', section: 'experiences', name: 'Partner Experiences', value: counts.experiences.partnerProvided, icon: Building2, color: 'purple', isCore: true },
      { id: 'exp-complimentary', section: 'experiences', name: 'Complimentary', value: counts.experiences.complimentary, icon: Gift, color: 'green', isCore: true },
      { id: 'exp-revenue', section: 'experiences', name: 'Revenue Generating', value: counts.experiences.revenueGenerating, icon: DollarSign, color: 'cyan', isCore: true },
      
      // JETS KPIs
      { id: 'jets-total', section: 'jets', name: 'Total Jets', value: counts.jets.total, icon: Plane, color: 'purple', isCore: true },
      { id: 'jets-available', section: 'jets', name: 'Jets Available', value: counts.jets.available, icon: PlaneTakeoff, color: 'green', isCore: true },
      { id: 'jets-booked', section: 'jets', name: 'Active Charters', value: counts.jets.booked, icon: PlaneLanding, color: 'cyan', isCore: true },
      { id: 'jets-maintenance', section: 'jets', name: 'In Maintenance', value: counts.jets.maintenance, icon: AlertCircle, color: 'amber', isCore: true },
      { id: 'jets-pending', section: 'jets', name: 'Pending Approval', value: counts.jets.pendingApproval, icon: Timer, color: 'amber', isCore: true },
      { id: 'jets-partner', section: 'jets', name: 'Partner Jets', value: counts.jets.partnerJets, icon: Building2, color: 'purple', isCore: true },
      
      // CHARTERS KPIs
      { id: 'charters-pending', section: 'charters', name: 'Pending Requests', value: counts.charters.pending, icon: Timer, color: 'amber', isCore: true },
      { id: 'charters-confirmed', section: 'charters', name: 'Confirmed Charters', value: counts.charters.confirmed, icon: CheckCircle, color: 'green', isCore: true },
      { id: 'charters-completed', section: 'charters', name: 'Completed', value: counts.charters.completed, icon: DollarSign, color: 'cyan', isCore: true },
    ];
  };

  const kpis = counts ? generateCoreKPIs(counts) : [];

  const getKPIsBySection = (section: TopTierKPI['section']) => {
    return kpis.filter(kpi => kpi.section === section);
  };

  return {
    kpis,
    counts,
    isLoading,
    refetch,
    getKPIsBySection,
    driversKPIs: getKPIsBySection('drivers'),
    experiencesKPIs: getKPIsBySection('experiences'),
    jetsKPIs: getKPIsBySection('jets'),
    chartersKPIs: getKPIsBySection('charters'),
  };
}
