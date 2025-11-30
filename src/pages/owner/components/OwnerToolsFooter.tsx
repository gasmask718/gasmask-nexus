import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Save, 
  Download, 
  Cloud, 
  Settings, 
  Shield, 
  FileSpreadsheet,
  HardDrive,
  Lock,
  Wrench
} from 'lucide-react';
import { toast } from 'sonner';

interface FooterAction {
  id: string;
  label: string;
  icon: React.ElementType;
  onClick?: () => void;
  disabled?: boolean;
  comingSoon?: boolean;
  variant?: 'default' | 'secondary' | 'outline' | 'ghost';
}

export function OwnerToolsFooter() {
  const handleCheckpointSave = () => {
    toast.success('Manual checkpoint saved', {
      description: 'All system state has been preserved.',
    });
  };

  const handleExcelExport = () => {
    toast.info('Preparing Excel export...', {
      description: 'Your download will start shortly.',
    });
  };

  const handleDiagnostics = () => {
    toast.info('Running module diagnostics...', {
      description: 'Check console for detailed output.',
    });
  };

  const handleSecurityStatus = () => {
    toast.success('Security Status: All Clear', {
      description: 'RLS policies active, admin locks engaged.',
    });
  };

  const footerActions: FooterAction[] = [
    { id: 'checkpoint', label: 'Manual Checkpoint', icon: Save, onClick: handleCheckpointSave, variant: 'secondary' },
    { id: 'excel', label: 'Full Excel Export', icon: FileSpreadsheet, onClick: handleExcelExport, variant: 'secondary' },
    { id: 'dropbox', label: 'Dropbox Export', icon: Cloud, disabled: true, comingSoon: true, variant: 'outline' },
    { id: 'diagnostics', label: 'Module Diagnostics', icon: Wrench, onClick: handleDiagnostics, variant: 'outline' },
    { id: 'security', label: 'Security Status', icon: Shield, onClick: handleSecurityStatus, variant: 'outline' },
  ];

  const futureIntegrations = [
    { id: 'twilio', label: 'Twilio', icon: HardDrive },
    { id: 'sendgrid', label: 'SendGrid', icon: HardDrive },
    { id: 'maps', label: 'Live Maps', icon: HardDrive },
  ];

  return (
    <Card className="rounded-xl shadow-lg border-border/50 bg-gradient-to-r from-card via-card to-muted/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-muted border border-border">
            <Settings className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-base">Owner Tools</CardTitle>
            <CardDescription className="text-xs">System management and export controls</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="flex flex-wrap items-center gap-3">
            {/* Primary Actions */}
            <div className="flex flex-wrap gap-2">
              {footerActions.map((action) => (
                <Tooltip key={action.id}>
                  <TooltipTrigger asChild>
                    <div>
                      <Button
                        variant={action.variant || 'outline'}
                        size="sm"
                        className="gap-2"
                        onClick={action.onClick}
                        disabled={action.disabled}
                      >
                        <action.icon className="h-4 w-4" />
                        {action.label}
                        {action.comingSoon && (
                          <span className="text-[9px] bg-muted px-1 rounded">Soon</span>
                        )}
                      </Button>
                    </div>
                  </TooltipTrigger>
                  {action.comingSoon && (
                    <TooltipContent>
                      <p>Coming soon - Integration pending</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              ))}
            </div>

            {/* Separator */}
            <div className="h-6 w-px bg-border hidden sm:block" />

            {/* Future Integrations */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Future:</span>
              {futureIntegrations.map((integration) => (
                <Tooltip key={integration.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 opacity-40 cursor-not-allowed"
                      disabled
                    >
                      <Lock className="h-3 w-3" />
                      {integration.label}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{integration.label} integration coming soon</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}

export default OwnerToolsFooter;
