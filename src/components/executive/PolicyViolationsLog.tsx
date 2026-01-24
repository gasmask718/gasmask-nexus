import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react';

interface PolicyViolation {
  id: string;
  policy_id?: string;
  campaign_id?: string;
  violation_type: string;
  severity: string;
  description: string;
  context_snapshot?: unknown;
  containment_action?: string | null;
  resolved_at?: string | null;
  created_at: string;
}

interface PolicyViolationsLogProps {
  businessId?: string;
}

export function PolicyViolationsLog({ businessId }: PolicyViolationsLogProps) {
  const [violations, setViolations] = useState<PolicyViolation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;

    const fetchViolations = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('policy_violations')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setViolations(data);
      }
      setIsLoading(false);
    };

    fetchViolations();
  }, [businessId]);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'major': return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'minor': return <Info className="h-4 w-4 text-yellow-500" />;
      default: return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'major': return 'bg-orange-500';
      case 'minor': return 'bg-yellow-500';
      default: return 'bg-muted';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading violations...
        </CardContent>
      </Card>
    );
  }

  if (violations.length === 0) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="py-8 text-center">
          <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-3" />
          <p className="text-lg font-medium text-green-600">No Violations</p>
          <p className="text-muted-foreground">
            AI operations are compliant with all active policies
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {violations.map(violation => (
        <Card key={violation.id} className={violation.resolved_at ? 'opacity-60' : ''}>
          <CardContent className="py-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                {getSeverityIcon(violation.severity)}
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{violation.violation_type.replace(/_/g, ' ')}</p>
                    <Badge className={getSeverityColor(violation.severity)}>
                      {violation.severity}
                    </Badge>
                    {violation.resolved_at && (
                      <Badge variant="outline" className="text-green-500 border-green-500">
                        Resolved
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {violation.description}
                  </p>
                  {violation.containment_action && (
                    <p className="text-sm mt-2">
                      <span className="text-muted-foreground">Containment:</span>{' '}
                      {violation.containment_action}
                    </p>
                  )}
                </div>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(violation.created_at).toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default PolicyViolationsLog;
