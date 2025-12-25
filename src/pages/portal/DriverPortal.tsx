import { useState } from 'react';
import { MapPin, Package, DollarSign, Clock, CheckCircle2, Camera, Truck, AlertTriangle, Play } from 'lucide-react';
import PortalDashboard from '@/layouts/PortalDashboard';
import { HudCard } from '@/components/portal/HudCard';
import { HudMetric } from '@/components/portal/HudMetric';
import { HudProgress } from '@/components/portal/HudProgress';
import { HudButton } from '@/components/portal/HudButton';
import { HudStatusBadge } from '@/components/portal/HudStatusBadge';
import { PermissionGate } from '@/components/portal/PermissionGate';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { useTranslation } from '@/hooks/useTranslation';
import { ViewDetailsBar, KpiType } from '@/components/portal/driver/ViewDetailsBar';
import { cn } from '@/lib/utils';

const todayStops = [
  { id: 1, store: 'Smoke King Miami', address: '123 Main St', eta: '10:00 AM', status: 'completed', boxes: 12 },
  { id: 2, store: 'Quick Stop Tobacco', address: '456 Oak Ave', eta: '10:45 AM', status: 'current', boxes: 8 },
  { id: 3, store: 'Downtown Smoke Shop', address: '789 Central Blvd', eta: '11:30 AM', status: 'pending', boxes: 15 },
];

export default function DriverPortal() {
  const { data: profileData } = useCurrentUserProfile();
  const { t } = useTranslation();
  const driverProfile = profileData?.roleProfile;
  const [selectedKpi, setSelectedKpi] = useState<KpiType>(null);

  const handleKpiClick = (kpi: KpiType) => {
    setSelectedKpi(selectedKpi === kpi ? null : kpi);
  };

  const completedStops = todayStops.filter(s => s.status === 'completed').length;
  const stopsLeft = todayStops.filter(s => s.status !== 'completed').length;

  return (
    <PortalDashboard title={t('driver.title')} subtitle="Route Day: Monday" roleColor="cyan">
      {driverProfile?.status === 'pending' && (
        <div className="mb-6 p-4 rounded-lg border border-hud-amber/30 bg-hud-amber/10">
          <div className="flex items-center gap-2 text-hud-amber">
            <AlertTriangle className="h-5 w-5" />
            <span>Account pending approval.</span>
          </div>
        </div>
      )}

      {/* Interactive KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-4">
        <HudCard 
          variant="cyan" 
          glow 
          className={cn(
            "cursor-pointer transition-all hover:scale-[1.02]",
            selectedKpi === 'routes' && "ring-2 ring-hud-cyan"
          )}
          onClick={() => handleKpiClick('routes')}
        >
          <HudMetric label="Routes Today" value={2} icon={<MapPin className="h-4 w-4" />} variant="cyan" size="lg" />
          <p className="text-xs text-muted-foreground mt-1">Click to view details</p>
        </HudCard>
        
        <HudCard 
          variant="amber" 
          glow
          className={cn(
            "cursor-pointer transition-all hover:scale-[1.02]",
            selectedKpi === 'stops_left' && "ring-2 ring-hud-amber"
          )}
          onClick={() => handleKpiClick('stops_left')}
        >
          <HudMetric label="Stops Left" value={stopsLeft} icon={<Package className="h-4 w-4" />} variant="amber" size="lg" />
          <p className="text-xs text-muted-foreground mt-1">Click to view details</p>
        </HudCard>
        
        <HudCard 
          variant="green" 
          glow
          className={cn(
            "cursor-pointer transition-all hover:scale-[1.02]",
            selectedKpi === 'stops_completed' && "ring-2 ring-hud-green"
          )}
          onClick={() => handleKpiClick('stops_completed')}
        >
          <HudMetric label="Stops Completed" value={completedStops} icon={<CheckCircle2 className="h-4 w-4" />} variant="green" size="lg" />
          <p className="text-xs text-muted-foreground mt-1">Click to view details</p>
        </HudCard>
        
        <PermissionGate permission="view_driver_earnings">
          <HudCard 
            variant="purple" 
            glow
            className={cn(
              "cursor-pointer transition-all hover:scale-[1.02]",
              selectedKpi === 'earnings' && "ring-2 ring-hud-purple"
            )}
            onClick={() => handleKpiClick('earnings')}
          >
            <HudMetric label="Est. Earnings" value="$95" icon={<DollarSign className="h-4 w-4" />} variant="purple" size="lg" />
            <p className="text-xs text-muted-foreground mt-1">Click to view details</p>
          </HudCard>
        </PermissionGate>
      </div>

      {/* View Details Bar */}
      <div className="mb-6">
        <ViewDetailsBar selectedKpi={selectedKpi} onClose={() => setSelectedKpi(null)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PermissionGate permission="view_routes">
            <HudCard title={t('driver.todays_route')} icon={<MapPin className="h-5 w-5" />} variant="cyan">
              <div className="flex items-center justify-between mb-4">
                <HudStatusBadge status="active" label="Route Active" pulse />
                <HudButton variant="cyan" size="sm" icon={<Play className="h-4 w-4" />}>Navigate</HudButton>
              </div>
              <div className="space-y-3">
                {todayStops.map((stop, idx) => (
                  <div key={stop.id} className={`flex items-center gap-4 p-3 rounded-lg border ${stop.status === 'current' ? 'border-hud-cyan bg-hud-cyan/10' : stop.status === 'completed' ? 'border-hud-green/30 bg-hud-green/5' : 'border-border/50'}`}>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-mono font-bold ${stop.status === 'completed' ? 'bg-hud-green/20 text-hud-green' : stop.status === 'current' ? 'bg-hud-cyan/20 text-hud-cyan' : 'bg-muted text-muted-foreground'}`}>
                      {stop.status === 'completed' ? <CheckCircle2 className="h-5 w-5" /> : idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{stop.store}</p>
                      <p className="text-sm text-muted-foreground truncate">{stop.address}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono text-hud-cyan">{stop.eta}</p>
                      <p className="text-xs text-muted-foreground">{stop.boxes} boxes</p>
                    </div>
                    <PermissionGate permission="update_store_status">
                      {stop.status === 'current' && <HudButton variant="green" size="sm" icon={<CheckCircle2 className="h-4 w-4" />}>Complete</HudButton>}
                    </PermissionGate>
                  </div>
                ))}
              </div>
            </HudCard>
          </PermissionGate>
        </div>
        <div className="space-y-4">
          <HudCard title="Quick Actions" variant="default">
            <div className="grid grid-cols-2 gap-2">
              <HudButton variant="cyan" size="sm" icon={<Camera className="h-4 w-4" />} className="w-full">Photo</HudButton>
              <HudButton variant="amber" size="sm" icon={<AlertTriangle className="h-4 w-4" />} className="w-full">Report</HudButton>
              <HudButton variant="green" size="sm" icon={<Package className="h-4 w-4" />} className="w-full">Inventory</HudButton>
              <HudButton variant="purple" size="sm" icon={<Truck className="h-4 w-4" />} className="w-full">Vehicle</HudButton>
            </div>
          </HudCard>
          <HudCard title="Performance" variant="green">
            <div className="space-y-3">
              <HudProgress value={92} label="On-Time Rate" variant="green" />
              <HudProgress value={98} label="Delivery Success" variant="cyan" />
            </div>
          </HudCard>
        </div>
      </div>
    </PortalDashboard>
  );
}
