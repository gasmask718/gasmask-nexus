/**
 * TRAINING MODE BANNER
 * 
 * Shows when demo/training mode is active.
 * No data is persisted in training mode.
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  GraduationCap, 
  AlertTriangle, 
  PlayCircle,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrainingModeBannerProps {
  isTrainingMode: boolean;
  onToggle: (enabled: boolean) => void;
  className?: string;
}

export function TrainingModeBanner({ 
  isTrainingMode, 
  onToggle,
  className,
}: TrainingModeBannerProps) {
  if (!isTrainingMode) {
    return null;
  }

  return (
    <div className={cn(
      'bg-gradient-to-r from-purple-500 to-indigo-600 text-white p-3 rounded-lg mb-6',
      className
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">Training Mode Active</span>
              <Badge className="bg-white/20 text-white border-0">Demo</Badge>
            </div>
            <p className="text-sm text-white/80">
              No data will be saved. Perfect for onboarding new staff.
            </p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="sm"
          className="text-white hover:bg-white/20"
          onClick={() => onToggle(false)}
        >
          <X className="h-4 w-4 mr-1" />
          Exit Training
        </Button>
      </div>
    </div>
  );
}

interface TrainingModeToggleProps {
  isTrainingMode: boolean;
  onToggle: (enabled: boolean) => void;
}

export function TrainingModeToggle({ isTrainingMode, onToggle }: TrainingModeToggleProps) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
      <div className="flex items-center gap-3">
        <GraduationCap className="h-5 w-5 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">Training Mode</p>
          <p className="text-xs text-muted-foreground">
            Demo day with fake data (no permanent records)
          </p>
        </div>
      </div>
      <Switch 
        checked={isTrainingMode}
        onCheckedChange={onToggle}
      />
    </div>
  );
}
