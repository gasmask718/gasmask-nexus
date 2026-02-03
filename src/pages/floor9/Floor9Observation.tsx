/**
 * Floor 9 Observation Mode Page
 * Phase 4.5 — Instrumented Learning Dashboard
 */

import { ObservationDashboard } from '@/components/taskGovernance';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Floor9Observation() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/grabba/floor9">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Floor 9
          </Button>
        </Link>
      </div>

      {/* Observation Dashboard */}
      <ObservationDashboard floorId="floor9_ai" />
    </div>
  );
}
