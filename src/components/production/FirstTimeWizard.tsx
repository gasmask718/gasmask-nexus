/**
 * FIRST TIME OFFICE MANAGER WIZARD
 * 
 * Guides new office managers through their first production day.
 * Cannot be dismissed until completed.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle2, 
  Circle, 
  Boxes, 
  FileOutput, 
  Lock,
  ArrowRight,
  Sparkles,
  GraduationCap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FirstTimeWizardProps {
  officeId: string;
  officeName: string;
  hasBatch: boolean;
  hasOutput: boolean;
  isClosed: boolean;
  onDismiss: () => void;
}

interface WizardStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  completed: boolean;
  action?: string;
}

export function FirstTimeWizard({ 
  officeId, 
  officeName, 
  hasBatch, 
  hasOutput, 
  isClosed,
  onDismiss 
}: FirstTimeWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps: WizardStep[] = [
    {
      id: 'batch',
      title: 'Create Your First Batch',
      description: 'A batch represents a production run. Click "+ New Batch" in the Batches tab to create one.',
      icon: <Boxes className="h-5 w-5" />,
      completed: hasBatch,
      action: 'Go to Batches tab and click "+ New Batch"',
    },
    {
      id: 'output',
      title: 'Enter Today\'s Output',
      description: 'Record the boxes completed, tubes used, and any defects for your batch.',
      icon: <FileOutput className="h-5 w-5" />,
      completed: hasOutput,
      action: 'Click on your batch and enter production numbers',
    },
    {
      id: 'close',
      title: 'Close the Day',
      description: 'Lock all data for the day. This finalizes variance and creates an audit record.',
      icon: <Lock className="h-5 w-5" />,
      completed: isClosed,
      action: 'Click "Close Day" in the right panel',
    },
  ];

  // Auto-advance step when completed
  useEffect(() => {
    const nextIncomplete = steps.findIndex(s => !s.completed);
    if (nextIncomplete !== -1) {
      setCurrentStep(nextIncomplete);
    }
  }, [hasBatch, hasOutput, isClosed]);

  const allCompleted = steps.every(s => s.completed);
  const completedCount = steps.filter(s => s.completed).length;
  const progressPct = (completedCount / steps.length) * 100;

  if (allCompleted) {
    return (
      <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-background mb-6">
        <CardContent className="p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="h-8 w-8 text-emerald-600" />
          </div>
          <h3 className="text-xl font-bold text-emerald-800 dark:text-emerald-200 mb-2">
            Training Complete! 🎉
          </h3>
          <p className="text-emerald-700 dark:text-emerald-300 mb-4">
            You've successfully completed your first production day at {officeName}.
            You're now ready to run this office independently.
          </p>
          <Button onClick={onDismiss} className="bg-emerald-600 hover:bg-emerald-700">
            Start Managing Production
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-background mb-6 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Welcome to {officeName}</CardTitle>
              <CardDescription>Complete these steps to finish your training</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-primary">
            {completedCount} of {steps.length} complete
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-1">
          <Progress value={progressPct} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">{Math.round(progressPct)}% complete</p>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {steps.map((step, index) => {
            const isActive = index === currentStep;
            const isPast = step.completed;
            
            return (
              <div 
                key={step.id}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg transition-all',
                  isActive && !isPast && 'bg-primary/10 border border-primary/20',
                  isPast && 'opacity-70'
                )}
              >
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                  isPast ? 'bg-emerald-100 dark:bg-emerald-900' : isActive ? 'bg-primary/20' : 'bg-muted'
                )}>
                  {isPast ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <span className={cn(
                      'text-sm font-bold',
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    )}>
                      {index + 1}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {step.icon}
                    <h4 className={cn(
                      'font-medium',
                      isPast && 'line-through text-muted-foreground'
                    )}>
                      {step.title}
                    </h4>
                    {isPast && (
                      <Badge className="bg-emerald-100 text-emerald-800 text-xs">Done</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                  {isActive && !isPast && step.action && (
                    <p className="text-sm font-medium text-primary mt-2 flex items-center gap-1">
                      <ArrowRight className="h-3 w-3" />
                      {step.action}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
