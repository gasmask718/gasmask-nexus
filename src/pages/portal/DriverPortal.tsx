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

const todayStops = [
  { id: 1, store: 'Smoke King Miami', address: '123 Main St', eta: '10:00 AM', status: 'completed', boxes: 12 },
  { id: 2, store: 'Quick Stop Tobacco', address: '456 Oak Ave', eta: '10:45 AM', status: 'current', boxes: 8 },
  { id: 3, store: 'Downtown Smoke Shop', address: '789 Central Blvd', eta: '11:30 AM', status: 'pending', boxes: 15 },
];

export default function DriverPortal() {
  const { data: profileData } = useCurrentUserProfile();
  const { t } = useTranslation();
  const driverProfile = profileData?.roleProfile;

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

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <HudCard variant="cyan" glow>
          <HudMetric label={t('driver.todays_route')} value={todayStops.length} icon={<MapPin className="h-4 w-4" />} variant="cyan" size="lg" />
          <HudProgress value={1} max={3} label="Completed" variant="cyan" size="sm" />
        </HudCard>
        <HudCard variant="green" glow>
          <HudMetric label="Boxes Delivered" value={12} icon={<Package className="h-4 w-4" />} trend="up" trendValue="+3 today" variant="green" size="lg" />
        </HudCard>
        <PermissionGate permission="view_driver_earnings">
          <HudCard variant="amber" glow>
            <HudMetric label={t('driver.earnings')} value="$485" icon={<DollarSign className="h-4 w-4" />} variant="amber" size="lg" />
          </HudCard>
        </PermissionGate>
        <HudCard variant="purple" glow>
          <HudMetric label="ETA Next" value="15 min" icon={<Clock className="h-4 w-4" />} variant="purple" size="lg" />
        </HudCard>
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
