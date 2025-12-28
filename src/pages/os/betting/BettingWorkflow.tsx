import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Sun, 
  Clock, 
  Moon, 
  Zap, 
  Search, 
  TrendingUp, 
  FileText, 
  Activity,
  CheckCircle2,
  ArrowRight,
  Lock
} from 'lucide-react';
import { useStateCompliance, STATE_LABELS, FORMAT_LABELS } from '@/hooks/useStateCompliance';

interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  link: string;
  timeOfDay: 'morning' | 'midday' | 'evening' | 'late';
  requiresFormat?: string;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: 'line-scan',
    title: 'Line Scan',
    description: 'Upload and compare lines across platforms',
    icon: <Search className="h-5 w-5" />,
    link: '/os/sports-betting/line-intake',
    timeOfDay: 'morning',
  },
  {
    id: 'line-shopping',
    title: 'Line Shopping',
    description: 'Find the best available lines',
    icon: <TrendingUp className="h-5 w-5" />,
    link: '/os/sports-betting/line-shopping',
    timeOfDay: 'morning',
  },
  {
    id: 'edge-review',
    title: 'Edge Review',
    description: 'Review AI projections and identify edges',
    icon: <Zap className="h-5 w-5" />,
    link: '/os/sports-betting',
    timeOfDay: 'midday',
  },
  {
    id: 'final-entries',
    title: 'Final Entries',
    description: 'Log your picks before games start',
    icon: <FileText className="h-5 w-5" />,
    link: '/os/sports-betting/entries/new',
    timeOfDay: 'evening',
  },
  {
    id: 'live-review',
    title: 'Live Review',
    description: 'Monitor and adjust live positions',
    icon: <Activity className="h-5 w-5" />,
    link: '/os/sports-betting/entries',
    timeOfDay: 'late',
    requiresFormat: 'live_bet',
  },
];

const TIME_OF_DAY_CONFIG = {
  morning: { label: 'Morning', icon: <Sun className="h-4 w-4" />, color: 'text-amber-500' },
  midday: { label: 'Midday', icon: <Clock className="h-4 w-4" />, color: 'text-blue-500' },
  evening: { label: 'Evening', icon: <Moon className="h-4 w-4" />, color: 'text-purple-500' },
  late: { label: 'Late Night', icon: <Zap className="h-4 w-4" />, color: 'text-red-500' },
};

export default function BettingWorkflow() {
  const { currentState, allowedFormats, isFormatAllowed } = useStateCompliance();
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  const toggleStep = (stepId: string) => {
    setCompletedSteps(prev => 
      prev.includes(stepId) 
        ? prev.filter(id => id !== stepId)
        : [...prev, stepId]
    );
  };

  const availableSteps = WORKFLOW_STEPS.filter(step => {
    if (!step.requiresFormat) return true;
    return isFormatAllowed(step.requiresFormat as any);
  });

  const progress = (completedSteps.length / availableSteps.length) * 100;

  const groupedSteps = {
    morning: availableSteps.filter(s => s.timeOfDay === 'morning'),
    midday: availableSteps.filter(s => s.timeOfDay === 'midday'),
    evening: availableSteps.filter(s => s.timeOfDay === 'evening'),
    late: availableSteps.filter(s => s.timeOfDay === 'late'),
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Activity className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Daily Workflow</h1>
          <p className="text-muted-foreground">
            Structured flow for {STATE_LABELS[currentState]}
          </p>
        </div>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Today's Progress</CardTitle>
            <Badge variant="outline">
              {completedSteps.length} / {availableSteps.length} steps
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground mt-2">
            {progress === 100 
              ? 'All steps completed!' 
              : `${Math.round(progress)}% complete`}
          </p>
        </CardContent>
      </Card>

      {/* Workflow Steps by Time of Day */}
      <div className="space-y-6">
        {(['morning', 'midday', 'evening', 'late'] as const).map((timeOfDay) => {
          const steps = groupedSteps[timeOfDay];
          if (steps.length === 0) return null;
          
          const config = TIME_OF_DAY_CONFIG[timeOfDay];
          
          return (
            <div key={timeOfDay} className="space-y-3">
              <div className={`flex items-center gap-2 ${config.color}`}>
                {config.icon}
                <h2 className="font-semibold">{config.label}</h2>
              </div>
              
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {steps.map((step) => {
                  const isCompleted = completedSteps.includes(step.id);
                  const isLocked = step.requiresFormat && !isFormatAllowed(step.requiresFormat as any);
                  
                  return (
                    <Card 
                      key={step.id} 
                      className={`transition-all ${
                        isCompleted 
                          ? 'border-green-500/50 bg-green-500/5' 
                          : isLocked 
                            ? 'opacity-50' 
                            : 'hover:border-primary/50'
                      }`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`p-2 rounded-lg ${isCompleted ? 'bg-green-500/20' : 'bg-muted'}`}>
                              {step.icon}
                            </div>
                            <CardTitle className="text-base">{step.title}</CardTitle>
                          </div>
                          {isLocked ? (
                            <Lock className="h-4 w-4 text-muted-foreground" />
                          ) : isCompleted ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : null}
                        </div>
                        <CardDescription>{step.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => !isLocked && toggleStep(step.id)}
                            disabled={isLocked}
                          >
                            {isCompleted ? 'Mark Incomplete' : 'Mark Complete'}
                          </Button>
                          <Link to={step.link}>
                            <Button size="sm" variant="ghost" disabled={isLocked}>
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                        {isLocked && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Not available in {currentState}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Available Formats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Available Formats in {STATE_LABELS[currentState]}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {allowedFormats.map(fmt => (
              <Badge key={fmt} variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-300">
                {FORMAT_LABELS[fmt]}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
