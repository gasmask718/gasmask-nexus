/**
 * STAFFING FORECAST PANEL
 * 
 * Predictive staffing & capacity forecasting:
 * - Expected output with current staff
 * - Workers needed to hit targets
 * - Risk indicators
 * - What-if simulations
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  useWorkerSkillProfiles,
  useCycleBenchmarks,
  WorkerSkillProfile,
} from '@/hooks/useWorkerPerformance';
import { useWorkerAttendance, useProductionWorkers } from '@/hooks/useProductionPortal';
import { 
  Users, 
  Target, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Calculator,
  Clock,
  Zap,
  UserPlus,
  UserMinus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StaffingForecastProps {
  officeId: string;
}

interface ForecastResult {
  expectedOutput: number;
  workersPresent: number;
  avgBoxesPerWorkerHour: number;
  hoursRemaining: number;
  targetOutput: number;
  gapToTarget: number;
  workersNeededForTarget: number;
  riskLevel: 'low' | 'medium' | 'high';
  riskFactors: string[];
}

function calculateForecast(
  profiles: WorkerSkillProfile[],
  workersPresent: number,
  targetOutput: number,
  hoursRemaining: number = 8,
  avgDefectRate: number = 0
): ForecastResult {
  // Calculate average productivity from skill profiles
  const avgBoxesPerHour = profiles.length > 0
    ? profiles.reduce((sum, p) => sum + (p.boxes_per_hour || 8), 0) / profiles.length
    : 8; // Default 8 boxes/hr if no data
  
  // Expected output = workers × hours × productivity
  const expectedOutput = Math.round(workersPresent * hoursRemaining * avgBoxesPerHour);
  
  // Gap analysis
  const gapToTarget = targetOutput - expectedOutput;
  
  // Workers needed to hit target
  const workersNeededForTarget = gapToTarget > 0
    ? Math.ceil(gapToTarget / (hoursRemaining * avgBoxesPerHour))
    : 0;
  
  // Risk assessment
  const riskFactors: string[] = [];
  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  
  if (gapToTarget > targetOutput * 0.2) {
    riskFactors.push('Significantly behind target');
    riskLevel = 'high';
  } else if (gapToTarget > 0) {
    riskFactors.push('Slightly behind target');
    riskLevel = 'medium';
  }
  
  if (avgDefectRate > 5) {
    riskFactors.push('Elevated defect rate');
    riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
  }
  
  if (workersPresent < 3) {
    riskFactors.push('Minimal staffing');
    riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
  }
  
  const lowPerformers = profiles.filter(p => (p.overall_score || 50) < 40).length;
  if (lowPerformers > profiles.length * 0.3) {
    riskFactors.push('Many low-performing workers');
    riskLevel = 'high';
  }

  return {
    expectedOutput,
    workersPresent,
    avgBoxesPerWorkerHour: avgBoxesPerHour,
    hoursRemaining,
    targetOutput,
    gapToTarget,
    workersNeededForTarget,
    riskLevel,
    riskFactors,
  };
}

function RiskIndicator({ level, factors }: { level: 'low' | 'medium' | 'high'; factors: string[] }) {
  const config = {
    low: { 
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200', 
      icon: <CheckCircle className="h-4 w-4" />,
      label: 'Low Risk',
    },
    medium: { 
      color: 'text-amber-600 bg-amber-50 border-amber-200', 
      icon: <AlertTriangle className="h-4 w-4" />,
      label: 'Medium Risk',
    },
    high: { 
      color: 'text-red-600 bg-red-50 border-red-200', 
      icon: <AlertTriangle className="h-4 w-4" />,
      label: 'High Risk',
    },
  };

  const { color, icon, label } = config[level];

  return (
    <div className={cn("rounded-lg border p-3", color)}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="font-medium">{label}</span>
      </div>
      {factors.length > 0 && (
        <ul className="text-xs space-y-1">
          {factors.map((f, i) => (
            <li key={i}>• {f}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function WhatIfSimulator({ 
  baseForcast, 
  profiles,
  onSimulate,
}: { 
  baseForcast: ForecastResult;
  profiles: WorkerSkillProfile[];
  onSimulate: (workers: number, hours: number) => ForecastResult;
}) {
  const [simWorkers, setSimWorkers] = useState(baseForcast.workersPresent);
  const [simHours, setSimHours] = useState(baseForcast.hoursRemaining);
  const [simResult, setSimResult] = useState<ForecastResult | null>(null);

  const handleSimulate = () => {
    const result = onSimulate(simWorkers, simHours);
    setSimResult(result);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          What-If Simulator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Workers</Label>
            <div className="flex items-center gap-2 mt-1">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSimWorkers(Math.max(1, simWorkers - 1))}
              >
                <UserMinus className="h-3 w-3" />
              </Button>
              <Input 
                type="number" 
                value={simWorkers}
                onChange={(e) => setSimWorkers(parseInt(e.target.value) || 1)}
                className="w-16 text-center"
              />
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSimWorkers(simWorkers + 1)}
              >
                <UserPlus className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div>
            <Label className="text-xs">Hours Remaining</Label>
            <div className="flex items-center gap-2 mt-1">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSimHours(Math.max(1, simHours - 1))}
              >
                -1
              </Button>
              <Input 
                type="number" 
                value={simHours}
                onChange={(e) => setSimHours(parseInt(e.target.value) || 1)}
                className="w-16 text-center"
              />
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSimHours(simHours + 1)}
              >
                +1
              </Button>
            </div>
          </div>
        </div>

        <Button onClick={handleSimulate} className="w-full" size="sm">
          <Calculator className="h-4 w-4 mr-2" />
          Simulate
        </Button>

        {simResult && (
          <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Projected Output</span>
              <span className="font-semibold">{simResult.expectedOutput} boxes</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">vs Target</span>
              <Badge variant={simResult.gapToTarget <= 0 ? "default" : "destructive"}>
                {simResult.gapToTarget <= 0 ? 'On Track' : `${simResult.gapToTarget} short`}
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function StaffingForecast({ officeId }: StaffingForecastProps) {
  const [targetOutput, setTargetOutput] = useState(100);
  const [hoursRemaining, setHoursRemaining] = useState(8);
  
  const { data: profiles = [], isLoading: profilesLoading } = useWorkerSkillProfiles(officeId);
  const { data: attendance = [], isLoading: attendanceLoading } = useWorkerAttendance(officeId);
  const { data: workers = [] } = useProductionWorkers(officeId);
  const { data: benchmarks = [] } = useCycleBenchmarks(officeId);

  const isLoading = profilesLoading || attendanceLoading;

  // Count workers currently checked in (not checked out)
  const workersPresent = attendance.filter(a => a.checked_in_at && !a.checked_out_at).length;

  // Calculate avg defect rate from profiles
  const avgDefectRate = profiles.length > 0
    ? profiles.reduce((sum, p) => sum + (p.defect_rate_per_thousand || 0), 0) / profiles.length
    : 0;

  // Calculate forecast
  const forecast = calculateForecast(
    profiles,
    workersPresent,
    targetOutput,
    hoursRemaining,
    avgDefectRate
  );

  const simulateForecast = (workers: number, hours: number) => {
    return calculateForecast(profiles, workers, targetOutput, hours, avgDefectRate);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const progressPct = targetOutput > 0 
    ? Math.min(100, (forecast.expectedOutput / targetOutput) * 100) 
    : 0;

  return (
    <div className="space-y-4">
      {/* Main Forecast Card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4" />
              Daily Capacity Forecast
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              <Users className="h-3 w-3 mr-1" />
              {workersPresent} on-site
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Target Input */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Daily Target</Label>
              <Input 
                type="number" 
                value={targetOutput}
                onChange={(e) => setTargetOutput(parseInt(e.target.value) || 0)}
                className="mt-1"
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Hours Remaining</Label>
              <Input 
                type="number" 
                value={hoursRemaining}
                onChange={(e) => setHoursRemaining(parseInt(e.target.value) || 1)}
                className="mt-1"
              />
            </div>
          </div>

          {/* Forecast Results */}
          <div className="border rounded-lg p-4 bg-muted/30">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-muted-foreground">Expected Output</p>
                <p className="text-2xl font-bold">{forecast.expectedOutput} boxes</p>
              </div>
              <div className="text-right">
                {forecast.gapToTarget <= 0 ? (
                  <Badge className="bg-emerald-500">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    On Track
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <TrendingDown className="h-3 w-3 mr-1" />
                    {forecast.gapToTarget} short
                  </Badge>
                )}
              </div>
            </div>

            <Progress 
              value={progressPct} 
              className={cn(
                "h-2 mb-2",
                progressPct >= 100 && "[&>div]:bg-emerald-500",
                progressPct >= 80 && progressPct < 100 && "[&>div]:bg-amber-500",
                progressPct < 80 && "[&>div]:bg-red-500"
              )}
            />

            <div className="grid grid-cols-3 gap-4 mt-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Workers</p>
                <p className="font-semibold">{workersPresent}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg/Hr</p>
                <p className="font-semibold">{forecast.avgBoxesPerWorkerHour.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Hours Left</p>
                <p className="font-semibold">{hoursRemaining}</p>
              </div>
            </div>
          </div>

          {/* Recommendation */}
          {forecast.workersNeededForTarget > 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
              <UserPlus className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">
                Add <strong>{forecast.workersNeededForTarget}</strong> worker{forecast.workersNeededForTarget > 1 ? 's' : ''} to hit target
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Risk Assessment */}
      <RiskIndicator level={forecast.riskLevel} factors={forecast.riskFactors} />

      {/* What-If Simulator */}
      <WhatIfSimulator 
        baseForcast={forecast}
        profiles={profiles}
        onSimulate={simulateForecast}
      />

      {/* Worker Capacity Breakdown */}
      {profiles.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Team Capacity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {profiles.slice(0, 5).map(profile => {
                const worker = workers.find(w => w.id === profile.worker_id);
                const capacity = (profile.boxes_per_hour || 8) * hoursRemaining;
                return (
                  <div key={profile.id} className="flex items-center gap-2">
                    <span className="text-sm flex-1 truncate">
                      {worker?.full_name || 'Unknown'}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {capacity.toFixed(0)} boxes
                    </Badge>
                    <Progress 
                      value={(profile.overall_score || 50)} 
                      className="w-16 h-1.5"
                    />
                  </div>
                );
              })}
              {profiles.length > 5 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{profiles.length - 5} more workers
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
