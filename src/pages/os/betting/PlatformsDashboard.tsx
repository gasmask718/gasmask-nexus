import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Building2, Lock, CheckCircle2, XCircle } from 'lucide-react';
import { useStateCompliance, STATE_LABELS } from '@/hooks/useStateCompliance';

export default function PlatformsDashboard() {
  const { currentState, allowedPlatforms, disabledPlatforms, currentStateRules, isLoading } = useStateCompliance();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Building2 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Platforms</h1>
          <p className="text-muted-foreground">
            Platform availability for {STATE_LABELS[currentState]}
          </p>
        </div>
      </div>

      {currentStateRules?.tooltip_text && (
        <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
          <p className="text-sm">{currentStateRules.tooltip_text}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Enabled Platforms */}
        {allowedPlatforms.map((platform) => (
          <Card key={platform.platform_key} className="border-green-500/30 bg-green-500/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{platform.platform_name}</CardTitle>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <CardDescription>
                {platform.platform_type === 'sportsbook' ? 'Sportsbook' : 'Fantasy Pick\'em'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="outline" className="bg-green-500/20 text-green-700 dark:text-green-300">
                Available in {currentState}
              </Badge>
            </CardContent>
          </Card>
        ))}

        {/* Disabled Platforms */}
        <TooltipProvider>
          {disabledPlatforms.map((platform) => (
            <Tooltip key={platform.platform_key}>
              <TooltipTrigger asChild>
                <Card className="border-muted opacity-60 cursor-not-allowed">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg text-muted-foreground">
                        {platform.platform_name}
                      </CardTitle>
                      <Lock className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <CardDescription>
                      {platform.platform_type === 'sportsbook' ? 'Sportsbook' : 'Fantasy Pick\'em'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="secondary">
                      <XCircle className="h-3 w-3 mr-1" />
                      Unavailable
                    </Badge>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>This platform is not available in {STATE_LABELS[currentState]}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </div>
    </div>
  );
}
