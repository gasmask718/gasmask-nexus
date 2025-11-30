import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, AlertTriangle, Building, Target, CheckCircle2, UserPlus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const riskData: Record<string, { title: string; severity: string; business: string; type: string; description: string; impact: string; action: string }> = {
  'risk-1': { title: 'Revenue Drop in Unforgettable Times', severity: 'high', business: 'Unforgettable Times', type: 'financial', description: 'Monthly revenue has decreased by 15% compared to the previous quarter. This trend indicates potential market saturation or competitive pressure.', impact: 'Projected loss of $12,000 in Q1 if not addressed', action: 'Review pricing strategy and launch targeted marketing campaign' },
  'risk-2': { title: 'Late Deliveries in GasMask', severity: 'medium', business: 'GasMask', type: 'operational', description: 'On-time delivery rate has dropped to 89% from the target of 95%. Driver shortages in certain zones are contributing to delays.', impact: 'Customer satisfaction scores declining, potential churn risk', action: 'Hire 2 additional drivers for high-demand zones' },
  'risk-3': { title: 'VA Overload - Admin Tasks', severity: 'medium', business: 'Dynasty OS', type: 'operational', description: 'Current VA workload is at 120% capacity. Administrative tasks are being delayed, affecting response times across all businesses.', impact: 'Slower customer response times, potential missed deadlines', action: 'Consider hiring additional VA or implementing automation' },
  'risk-4': { title: 'Compliance Review Required', severity: 'critical', business: 'PlayBoxxx', type: 'compliance', description: 'Adult content platform requires annual compliance review. Documentation needs to be updated to meet new regulatory requirements.', impact: 'Risk of platform suspension if not addressed within 30 days', action: 'Schedule compliance review with legal team immediately' },
  'risk-5': { title: 'Funding File SLA Breach', severity: 'high', business: 'Funding Company', type: 'operational', description: 'Two funding files have exceeded the 48-hour SLA for underwriting review. This affects client trust and commission timelines.', impact: 'Potential loss of $5,000 in commissions, client relationship damage', action: 'Escalate files to senior underwriter for immediate review' },
};

export default function OwnerRiskDetailPage() {
  const { riskId } = useParams<{ riskId: string }>();
  const navigate = useNavigate();
  const [resolved, setResolved] = useState(false);
  
  const risk = riskId ? riskData[riskId] : null;

  const handleAssignVA = () => {
    toast({
      title: "Coming Soon",
      description: "VA assignment workflow will be available in a future update.",
    });
  };

  const handleMarkResolved = () => {
    setResolved(true);
    toast({
      title: "Risk Marked as Resolved",
      description: "This risk has been marked as resolved locally.",
    });
  };
  
  if (!risk) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Risk not found</p>
        <Button variant="outline" onClick={() => navigate('/os/owner/risk-radar')} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Risk Radar
        </Button>
      </div>
    );
  }

  const severityColors: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };

  const typeColors: Record<string, string> = {
    financial: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    operational: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    tech: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    compliance: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/os/owner/risk-radar')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30">
              <AlertTriangle className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{risk.title}</h1>
              <p className="text-sm text-muted-foreground">Risk ID: {riskId}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={severityColors[risk.severity]}>
            {risk.severity.toUpperCase()}
          </Badge>
          {resolved && (
            <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Resolved
            </Badge>
          )}
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-xl">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Building className="h-5 w-5 text-blue-400" />
              <div>
                <p className="text-sm text-muted-foreground">Business</p>
                <p className="text-lg font-semibold">{risk.business}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Target className="h-5 w-5 text-purple-400" />
              <div>
                <p className="text-sm text-muted-foreground">Type</p>
                <Badge variant="outline" className={typeColors[risk.type]}>{risk.type}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Description */}
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{risk.description}</p>
        </CardContent>
      </Card>

      {/* Impact */}
      <Card className="rounded-xl border-amber-500/30">
        <CardHeader>
          <CardTitle className="text-base text-amber-400">Impact</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{risk.impact}</p>
        </CardContent>
      </Card>

      {/* Recommended Action */}
      <Card className="rounded-xl border-emerald-500/30">
        <CardHeader>
          <CardTitle className="text-base text-emerald-400">Recommended Action</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{risk.action}</p>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3 flex-wrap">
        <Button variant="outline" onClick={handleAssignVA} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Assign to VA
        </Button>
        <Button onClick={handleMarkResolved} disabled={resolved} className="gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {resolved ? 'Resolved' : 'Mark as Resolved'}
        </Button>
      </div>
    </div>
  );
}
