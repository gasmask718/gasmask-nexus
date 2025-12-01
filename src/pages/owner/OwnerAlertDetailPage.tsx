import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, AlertTriangle, CheckCircle2, Clock, User, Building2 } from 'lucide-react';
import { toast } from 'sonner';

const alertsData: Record<string, { type: string; system: string; message: string; time: string; details: string; impact: string; recommendation: string }> = {
  'alert-1': { 
    type: 'Critical', 
    system: 'Funding Company', 
    message: '1 large file in underwriting over SLA',
    time: '1h ago',
    details: 'File #FC-2024-0892 has been in underwriting for 72 hours, exceeding the 48-hour SLA. Client: Johnson Holdings LLC. Loan amount: $2.4M.',
    impact: 'Potential loss of $24,000 in origination fees if client walks.',
    recommendation: 'Escalate to senior underwriter immediately. Contact client with status update.'
  },
  'alert-2': { 
    type: 'Warning', 
    system: 'TopTier Experience', 
    message: '3 bookings missing payment confirmation',
    time: '3h ago',
    details: 'Bookings #TT-4521, #TT-4523, #TT-4528 are confirmed but payment has not been captured.',
    impact: 'Risk of no-show without deposit. Combined booking value: $8,500.',
    recommendation: 'Send payment reminder via SMS and email. If no response in 2 hours, call clients.'
  },
  'alert-3': { 
    type: 'Warning', 
    system: 'PlayBoxxx', 
    message: '2 creator payout reviews pending',
    time: '5h ago',
    details: 'Creators @luxe_lifestyle and @urban_vibes have pending payouts awaiting manual review.',
    impact: 'Delayed payouts may affect creator satisfaction and retention.',
    recommendation: 'Review flagged transactions and approve or escalate within 24 hours.'
  },
  'alert-4': { 
    type: 'Info', 
    system: 'GasMask / Grabba', 
    message: '5 stores flagged for low inventory',
    time: 'Today',
    details: 'Stores in Brooklyn (2), Queens (2), and Bronx (1) are below reorder threshold for key SKUs.',
    impact: 'Potential stockouts within 48-72 hours if not restocked.',
    recommendation: 'Dispatch restocking route or contact wholesaler for priority delivery.'
  },
};

export default function OwnerAlertDetailPage() {
  const { alertId } = useParams<{ alertId: string }>();
  const navigate = useNavigate();
  
  const alert = alertId ? alertsData[alertId] : null;
  
  if (!alert) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Alert not found</p>
        <Button variant="outline" onClick={() => navigate('/os/owner')} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const handleAssignVA = () => {
    toast.info('VA assignment workflow coming soon', {
      description: 'This will allow you to assign alerts to VAs for resolution.'
    });
  };

  const handleResolve = () => {
    toast.success('Alert marked as resolved', {
      description: 'This alert has been archived.'
    });
    navigate('/os/owner');
  };

  const typeColors = {
    Critical: 'border-red-500/50 text-red-300 bg-red-500/10',
    Warning: 'border-amber-500/50 text-amber-300 bg-amber-500/10',
    Info: 'border-blue-500/40 text-blue-300 bg-blue-500/10',
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/os/owner')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30">
            <AlertTriangle className="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Alert Details</h1>
            <p className="text-sm text-muted-foreground">Alert ID: {alertId}</p>
          </div>
        </div>
      </div>

      {/* Alert Overview */}
      <Card className="rounded-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className={typeColors[alert.type as keyof typeof typeColors]}>
                {alert.type}
              </Badge>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" />
                {alert.system}
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {alert.time}
            </div>
          </div>
          <CardTitle className="text-lg mt-2">{alert.message}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-1">Details</h3>
            <p className="text-sm text-muted-foreground">{alert.details}</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-1 text-amber-400">Impact</h3>
            <p className="text-sm text-muted-foreground">{alert.impact}</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-1 text-emerald-400">Recommended Action</h3>
            <p className="text-sm text-muted-foreground">{alert.recommendation}</p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={handleAssignVA} className="gap-2">
          <User className="h-4 w-4" />
          Assign to VA
        </Button>
        <Button onClick={handleResolve} className="gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Mark as Resolved
        </Button>
      </div>
    </div>
  );
}
