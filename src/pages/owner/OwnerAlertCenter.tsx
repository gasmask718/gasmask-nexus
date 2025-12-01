import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Bell, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

const allAlerts = [
  { id: 'alert-1', type: 'Critical', system: 'Funding Company', message: '1 large file in underwriting over SLA', time: '1h ago' },
  { id: 'alert-2', type: 'Warning', system: 'TopTier Experience', message: '3 bookings missing payment confirmation', time: '3h ago' },
  { id: 'alert-3', type: 'Warning', system: 'PlayBoxxx', message: '2 creator payout reviews pending', time: '5h ago' },
  { id: 'alert-4', type: 'Info', system: 'GasMask / Grabba', message: '5 stores flagged for low inventory', time: 'Today' },
  { id: 'alert-5', type: 'Info', system: 'Driver Ops', message: '2 routes need optimization', time: 'Today' },
  { id: 'alert-6', type: 'Warning', system: 'Grants', message: '3 applications approaching deadline', time: '2h ago' },
];

export default function OwnerAlertCenter() {
  const navigate = useNavigate();

  const typeColors = {
    Critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    Warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    Info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
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
            <Bell className="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Alert Center</h1>
            <p className="text-sm text-muted-foreground">All empire alerts</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30 ml-auto">
          {allAlerts.filter(a => a.type === 'Critical').length} Critical
        </Badge>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-xl border-red-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Critical</p>
                <p className="text-2xl font-bold text-red-400">{allAlerts.filter(a => a.type === 'Critical').length}</p>
              </div>
              <AlertTriangle className="h-6 w-6 text-red-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-amber-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Warnings</p>
                <p className="text-2xl font-bold text-amber-400">{allAlerts.filter(a => a.type === 'Warning').length}</p>
              </div>
              <Clock className="h-6 w-6 text-amber-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-blue-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Info</p>
                <p className="text-2xl font-bold text-blue-400">{allAlerts.filter(a => a.type === 'Info').length}</p>
              </div>
              <Bell className="h-6 w-6 text-blue-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* All Alerts */}
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">All Alerts</CardTitle>
          <CardDescription className="text-xs">Click to view details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {allAlerts.map((alert) => (
              <div 
                key={alert.id} 
                className="flex items-center justify-between p-4 rounded-lg border bg-card/50 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => navigate(`/os/owner/alert/${alert.id}`)}
              >
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={typeColors[alert.type as keyof typeof typeColors]}>
                    {alert.type}
                  </Badge>
                  <div>
                    <p className="font-medium text-sm">{alert.message}</p>
                    <p className="text-xs text-muted-foreground">{alert.system}</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{alert.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button variant="outline" onClick={() => navigate('/os/owner')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Owner Dashboard
      </Button>
    </div>
  );
}
