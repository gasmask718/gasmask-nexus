import { useState } from 'react';
import { useTopTierKPIs, TopTierKPI } from '@/hooks/toptier/useTopTierKPIs';
import { TopTierKPISection } from './kpi/TopTierKPISection';
import { DriversModal, ExperiencesModal, JetsModal } from './modals';
import { Car, Sparkles, Plane, RefreshCw, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserRole } from '@/hooks/useUserRole';
import { cn } from '@/lib/utils';

interface TopTierCommandDashboardProps {
  className?: string;
}

export function TopTierCommandDashboard({ className }: TopTierCommandDashboardProps) {
  const { driversKPIs, experiencesKPIs, jetsKPIs, chartersKPIs, isLoading, refetch } = useTopTierKPIs();
  const { isAdmin } = useUserRole();
  
  // Modal states
  const [driversModalOpen, setDriversModalOpen] = useState(false);
  const [experiencesModalOpen, setExperiencesModalOpen] = useState(false);
  const [jetsModalOpen, setJetsModalOpen] = useState(false);
  
  // Active KPI filter
  const [activeKPIId, setActiveKPIId] = useState<string | null>(null);

  const handleKPIClick = (kpi: TopTierKPI) => {
    setActiveKPIId(prev => prev === kpi.id ? null : kpi.id);
    
    // Open appropriate modal based on section
    switch (kpi.section) {
      case 'drivers':
        setDriversModalOpen(true);
        break;
      case 'experiences':
        setExperiencesModalOpen(true);
        break;
      case 'jets':
      case 'charters':
        setJetsModalOpen(true);
        break;
    }
  };

  return (
    <div className={cn('space-y-8', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Command Dashboard</h2>
          <p className="text-muted-foreground">Real-time operational metrics across all TopTier services</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>
          {isAdmin && (
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Manage KPIs
            </Button>
          )}
        </div>
      </div>

      {/* Drivers Section */}
      <TopTierKPISection
        title="Drivers"
        icon={Car}
        kpis={driversKPIs}
        isLoading={isLoading}
        onSectionClick={() => setDriversModalOpen(true)}
        onKPIClick={handleKPIClick}
        activeKPIId={activeKPIId}
        maxCards={6}
      />

      {/* Things To Do (Experiences) Section */}
      <TopTierKPISection
        title="Things To Do"
        icon={Sparkles}
        kpis={experiencesKPIs}
        isLoading={isLoading}
        onSectionClick={() => setExperiencesModalOpen(true)}
        onKPIClick={handleKPIClick}
        activeKPIId={activeKPIId}
        maxCards={7}
      />

      {/* Private Jet Section */}
      <TopTierKPISection
        title="Private Jet"
        icon={Plane}
        kpis={[...jetsKPIs, ...chartersKPIs]}
        isLoading={isLoading}
        onSectionClick={() => setJetsModalOpen(true)}
        onKPIClick={handleKPIClick}
        activeKPIId={activeKPIId}
        maxCards={9}
      />

      {/* Modals */}
      <DriversModal open={driversModalOpen} onOpenChange={setDriversModalOpen} />
      <ExperiencesModal open={experiencesModalOpen} onOpenChange={setExperiencesModalOpen} />
      <JetsModal open={jetsModalOpen} onOpenChange={setJetsModalOpen} />
    </div>
  );
}
