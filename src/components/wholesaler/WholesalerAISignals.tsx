import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Zap, AlertTriangle, TrendingDown, MapPin, 
  DollarSign, TrendingUp, CheckCircle, Eye, Clock
} from 'lucide-react';
import { format } from 'date-fns';
import type { WholesalerAISignal } from '@/hooks/useWholesalerIntelligence';

interface WholesalerAISignalsProps {
  signals: WholesalerAISignal[];
  onAcknowledge: (signalId: string) => Promise<void>;
  onResolve: (signalId: string) => Promise<void>;
}

export function WholesalerAISignals({ signals, onAcknowledge, onResolve }: WholesalerAISignalsProps) {
  const criticalSignals = signals.filter(s => s.severity === 'critical');
  const warningSignals = signals.filter(s => s.severity === 'warning');
  const infoSignals = signals.filter(s => s.severity === 'info');

  const getSignalIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'frequency_drop': return TrendingDown;
      case 'territory_underperformance': return MapPin;
      case 'payment_risk': return DollarSign;
      case 'competitive_displacement': return AlertTriangle;
      case 'growth_opportunity': return TrendingUp;
      default: return Zap;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'warning': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      default: return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
  };

  const getSignalBg = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'bg-red-500/5 border-red-500/20';
      case 'warning': return 'bg-amber-500/5 border-amber-500/20';
      default: return 'bg-blue-500/5 border-blue-500/20';
    }
  };

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            AI Signals & Predictive Alerts
          </CardTitle>
          <div className="flex items-center gap-2">
            {criticalSignals.length > 0 && (
              <Badge variant="destructive" className="animate-pulse">
                {criticalSignals.length} Critical
              </Badge>
            )}
            {warningSignals.length > 0 && (
              <Badge variant="outline" className="text-amber-400 border-amber-500/30">
                {warningSignals.length} Warning
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {signals.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500/50 mb-2" />
            <p className="text-sm text-muted-foreground">No active signals</p>
            <p className="text-xs text-muted-foreground mt-1">All clear — relationship is healthy</p>
          </div>
        ) : (
          <ScrollArea className="h-80">
            <div className="space-y-3">
              {signals.map((signal) => {
                const SignalIcon = getSignalIcon(signal.signal_type);
                
                return (
                  <div 
                    key={signal.id}
                    className={`p-4 rounded-lg border ${getSignalBg(signal.severity)}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${getSeverityColor(signal.severity)}`}>
                          <SignalIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={getSeverityColor(signal.severity)}>
                              {signal.severity}
                            </Badge>
                            <span className="text-xs text-muted-foreground capitalize">
                              {signal.signal_type.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="text-sm font-medium">{signal.headline}</p>
                          {signal.details && (
                            <p className="text-xs text-muted-foreground mt-1">{signal.details}</p>
                          )}
                          {signal.recommended_action && (
                            <div className="mt-2 p-2 rounded bg-muted/50">
                              <p className="text-xs text-muted-foreground">Recommended Action:</p>
                              <p className="text-sm">{signal.recommended_action}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(signal.detected_at), 'MMM d, yyyy')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(signal.detected_at), 'h:mm a')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/30">
                      {!signal.acknowledged_at && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => onAcknowledge(signal.id)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Acknowledge
                        </Button>
                      )}
                      {signal.acknowledged_at && !signal.resolved_at && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Acknowledged {format(new Date(signal.acknowledged_at), 'MMM d, yyyy')}
                        </div>
                      )}
                      <Button 
                        size="sm" 
                        variant="default"
                        onClick={() => onResolve(signal.id)}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Resolve
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {/* Signal Type Legend */}
        <div className="pt-4 border-t border-border/50">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Signal Types</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-3 w-3 text-muted-foreground" />
              <span>Frequency Drop</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-3 w-3 text-muted-foreground" />
              <span>Territory Issues</span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-3 w-3 text-muted-foreground" />
              <span>Payment Risk</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-3 w-3 text-muted-foreground" />
              <span>Competitive</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3 w-3 text-muted-foreground" />
              <span>Growth Opportunity</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
