/**
 * Governance Command Center Page
 * Phase H: Human Operator View
 * 
 * Unified view for all active, blocked, awaiting approval, and completed tasks
 */

import { GovernanceCommandCenter as CommandCenterUI } from '@/components/taskGovernance';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function GovernanceCommandCenterPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/grabba/floor9/tasks">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Floor 9
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Governance Command Center</h1>
          <p className="text-muted-foreground text-sm">
            Phase H: Human Operator View — Monitor all task execution across Floors 1–9
          </p>
        </div>
      </div>

      {/* Command Center UI */}
      <CommandCenterUI />
    </div>
  );
}
