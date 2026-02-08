import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Loader2, Wifi, WifiOff, Activity, Signal, Clock,
  CheckCircle2, AlertCircle, Circle,
} from 'lucide-react';
import {
  useBusinessEntities,
  getConnectionLabel,
  getReportingLabel,
  type BusinessEntity,
  type ConnectionStatus,
} from '@/hooks/useGlobalFinancialData';

interface ReadinessTier {
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  borderColor: string;
  bgColor: string;
  businesses: BusinessEntity[];
}

export default function CashflowReadiness() {
  const { data: businesses, isLoading } = useBusinessEntities();

  const tiers: ReadinessTier[] = useMemo(() => {
    const active = (businesses || []).filter(b => b.is_active);

    return [
      {
        label: 'Live Connected',
        description: 'Real-time data sync — highest confidence',
        icon: <Wifi className="h-5 w-5 text-emerald-400" />,
        color: 'text-emerald-400',
        borderColor: 'border-emerald-500/30',
        bgColor: 'bg-emerald-500/5',
        businesses: active.filter(b => b.connection_status === 'api_connected'),
      },
      {
        label: 'Partially Connected',
        description: 'Some data flowing — needs full integration',
        icon: <Activity className="h-5 w-5 text-amber-400" />,
        color: 'text-amber-400',
        borderColor: 'border-amber-500/30',
        bgColor: 'bg-amber-500/5',
        businesses: active.filter(b => b.connection_status === 'partial'),
      },
      {
        label: 'Manual Only',
        description: 'Data entered manually — snapshot based',
        icon: <Clock className="h-5 w-5 text-blue-400" />,
        color: 'text-blue-400',
        borderColor: 'border-blue-500/30',
        bgColor: 'bg-blue-500/5',
        businesses: active.filter(b => b.connection_status === 'manual'),
      },
      {
        label: 'Pending Integration',
        description: 'Registered but awaiting external connection',
        icon: <Signal className="h-5 w-5 text-purple-400" />,
        color: 'text-purple-400',
        borderColor: 'border-purple-500/30',
        bgColor: 'bg-purple-500/5',
        businesses: active.filter(b => b.connection_status === 'external_pending'),
      },
      {
        label: 'Not Reporting',
        description: 'No data connection — placeholder only',
        icon: <WifiOff className="h-5 w-5 text-muted-foreground" />,
        color: 'text-muted-foreground',
        borderColor: 'border-muted',
        bgColor: 'bg-muted/10',
        businesses: active.filter(b => b.connection_status === 'not_connected'),
      },
    ];
  }, [businesses]);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const activeBiz = (businesses || []).filter(b => b.is_active);
  const reportingBiz = activeBiz.filter(b => b.connection_status !== 'not_connected');
  const readinessPct = activeBiz.length > 0 ? Math.round((reportingBiz.length / activeBiz.length) * 100) : 0;
  const avgConfidence = activeBiz.length > 0
    ? Math.round(activeBiz.reduce((s, b) => s + b.data_confidence_pct, 0) / activeBiz.length)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          Cashflow Readiness
        </h2>
        <p className="text-sm text-muted-foreground">
          Integration status and data quality across all dynasty entities
        </p>
      </div>

      {/* Readiness Score */}
      <Card className="bg-gradient-to-br from-primary/5 to-card border-primary/20">
        <CardContent className="pt-6 pb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-muted-foreground">Overall Readiness</p>
              <p className="text-3xl font-bold">{readinessPct}%</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Avg Data Confidence</p>
              <p className={`text-3xl font-bold ${avgConfidence >= 60 ? 'text-emerald-400' : avgConfidence >= 30 ? 'text-amber-400' : 'text-muted-foreground'}`}>
                {avgConfidence}%
              </p>
            </div>
          </div>
          <Progress value={readinessPct} className="h-3" />
          <p className="text-xs text-muted-foreground mt-2">
            {reportingBiz.length} of {activeBiz.length} businesses actively reporting data
          </p>
        </CardContent>
      </Card>

      {/* Tier Breakdown */}
      <div className="space-y-4">
        {tiers.map(tier => (
          <Card key={tier.label} className={`${tier.borderColor} ${tier.bgColor}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {tier.icon}
                  <div>
                    <CardTitle className={`text-base ${tier.color}`}>{tier.label}</CardTitle>
                    <CardDescription className="text-xs">{tier.description}</CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className={`${tier.color} text-sm font-bold`}>
                  {tier.businesses.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {tier.businesses.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">No businesses in this tier</p>
              ) : (
                <div className="space-y-2">
                  {tier.businesses.map(biz => (
                    <div key={biz.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-background/50">
                      <div>
                        <p className="text-sm font-medium">{biz.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground capitalize">
                            {biz.industry?.replace(/_/g, ' ') || 'Unclassified'}
                          </span>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground">
                            {getReportingLabel(biz.reporting_mode)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <div className="w-10 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${biz.data_confidence_pct >= 70 ? 'bg-emerald-500' : biz.data_confidence_pct >= 40 ? 'bg-amber-500' : 'bg-muted-foreground/30'}`}
                              style={{ width: `${biz.data_confidence_pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground">{biz.data_confidence_pct}%</span>
                        </div>
                        {biz.monthly_revenue_estimate > 0 && (
                          <span className="text-xs text-muted-foreground">~${biz.monthly_revenue_estimate.toLocaleString()}/mo</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Inactive businesses */}
      {(businesses || []).filter(b => !b.is_active).length > 0 && (
        <Card className="border-muted bg-muted/5 opacity-60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-muted-foreground flex items-center gap-2">
              <Circle className="h-4 w-4" />
              Inactive / Archived
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(businesses || []).filter(b => !b.is_active).map(biz => (
                <Badge key={biz.id} variant="outline" className="text-[10px]">{biz.name}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
