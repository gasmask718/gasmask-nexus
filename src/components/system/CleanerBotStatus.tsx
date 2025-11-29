// Phase 12 - Background Cleaner Bot Status

import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Bot, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CleanerBotStatusProps {
  className?: string;
}

interface CleanerStats {
  lastRun: Date | null;
  fixesApplied: number;
  isRunning: boolean;
}

export function CleanerBotStatus({ className }: CleanerBotStatusProps) {
  const [stats, setStats] = useState<CleanerStats>({
    lastRun: null,
    fixesApplied: 0,
    isRunning: false,
  });

  // Simulate cleaner bot running on navigation/login
  useEffect(() => {
    const runCleaner = async () => {
      setStats(prev => ({ ...prev, isRunning: true }));
      
      // Simulate cleaning process
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setStats({
        lastRun: new Date(),
        fixesApplied: Math.floor(Math.random() * 5),
        isRunning: false,
      });
    };

    // Run on mount (simulating login/navigation trigger)
    runCleaner();

    // Run periodically (every 5 minutes)
    const interval = setInterval(runCleaner, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Badge
        variant="outline"
        className={cn(
          'text-[10px] px-2 py-0.5',
          stats.isRunning ? 'bg-blue-500/10 text-blue-500 border-blue-500/30' : 'bg-green-500/10 text-green-500 border-green-500/30'
        )}
      >
        {stats.isRunning ? (
          <>
            <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />
            Cleaning...
          </>
        ) : (
          <>
            <Bot className="h-2.5 w-2.5 mr-1" />
            Bot Active
          </>
        )}
      </Badge>
      
      {stats.lastRun && !stats.isRunning && (
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <CheckCircle className="h-2.5 w-2.5 text-green-500" />
          {stats.fixesApplied > 0 ? `${stats.fixesApplied} fixes` : 'All clean'}
        </span>
      )}
    </div>
  );
}

// Hook for cleaner bot integration
export function useCleanerBot() {
  const [isRunning, setIsRunning] = useState(false);
  const [lastResults, setLastResults] = useState<{
    fixes: number;
    errors: number;
    timestamp: Date;
  } | null>(null);

  const runCleaner = async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    
    try {
      // This would connect to actual cleaning logic
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setLastResults({
        fixes: Math.floor(Math.random() * 10),
        errors: 0,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Cleaner bot error:', error);
    } finally {
      setIsRunning(false);
    }
  };

  return {
    isRunning,
    lastResults,
    runCleaner,
  };
}
