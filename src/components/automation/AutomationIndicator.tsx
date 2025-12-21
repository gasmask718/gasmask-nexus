import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Zap } from 'lucide-react';
import { useAutomationIndicator } from '@/hooks/useAutomation';
import { AutomationPanel } from './AutomationPanel';

interface AutomationIndicatorProps {
  floorId?: string;
}

export function AutomationIndicator({ floorId }: AutomationIndicatorProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const { activeCount, recentEvent } = useAutomationIndicator();

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setPanelOpen(true);
              }}
              className={`relative ${recentEvent?.status === 'running' ? 'animate-pulse' : ''}`}
            >
              <Zap className="h-4 w-4 text-yellow-500" />
              <span className="ml-1 hidden sm:inline">Automations</span>
              {activeCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1">
                  {activeCount}
                </Badge>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{activeCount} automations active</p>
            {recentEvent && (
              <p className="text-xs text-muted-foreground">
                Last: {recentEvent.ruleName}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <AutomationPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        floorId={floorId}
      />
    </>
  );
}
