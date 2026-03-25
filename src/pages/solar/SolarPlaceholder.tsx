import { useLocation } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Sun } from 'lucide-react';

const AMBER = '#E8A317';

const FLOOR_NAMES: Record<string, string> = {
  '/solar/outreach': 'Floor 2 — AI Outreach Engine',
  '/solar/qualification': 'Floor 3 — AI Qualification',
  '/solar/appointments': 'Floor 4 — Appointment Booking',
  '/solar/live-calls': 'Floor 5 — Live Call Assist',
  '/solar/deals': 'Floor 6 — Deals & Commissions',
  '/solar/partners': 'Floor 7 — Partner Network',
  '/solar/agents': 'Floor 8 — Agent Management',
  '/solar/ai-brain': 'Floor 9 — AI Brain (Self-Learning)',
  '/solar/analytics': 'Floor 10 — Analytics Dashboard',
};

export default function SolarPlaceholder() {
  const { pathname } = useLocation();
  const floorName = FLOOR_NAMES[pathname] || 'Solar Module';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sun className="h-6 w-6" style={{ color: AMBER }} />
          {floorName}
        </h1>
        <p className="text-sm text-muted-foreground">BrightSun Solar Deal Engine</p>
      </div>
      <Card className="border-dashed" style={{ borderColor: `${AMBER}40` }}>
        <CardContent className="py-16 text-center">
          <Sun className="h-16 w-16 mx-auto mb-4" style={{ color: `${AMBER}60` }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: AMBER }}>Building out...</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            This floor of the BrightSun Solar Engine is being constructed. Full functionality coming soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
