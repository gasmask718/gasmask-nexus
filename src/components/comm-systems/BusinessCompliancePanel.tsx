import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Shield, 
  Bot, 
  User, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Building2,
  Phone,
  MessageSquare,
  Mail,
} from 'lucide-react';

interface BusinessCompliancePanelProps {
  businessId: string | null;
  businessName: string | null;
  isAllBusinesses?: boolean;
}

export function BusinessCompliancePanel({ 
  businessId, 
  businessName, 
  isAllBusinesses = false 
}: BusinessCompliancePanelProps) {
  // Mock compliance data - would come from database
  const complianceData = {
    aiAllowed: true,
    humanRequired: false,
    channels: {
      call: true,
      text: true,
      email: true,
    },
    slaMinutes: 5,
    escalationRules: ['Legal keywords', 'Payment issues', 'Angry sentiment'],
    riskLevel: 'low' as 'low' | 'medium' | 'high',
    healthScore: 94,
  };

  if (isAllBusinesses) {
    return (
      <Card className="bg-muted/30">
        <CardContent className="py-4">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Building2 className="h-5 w-5" />
            <div>
              <p className="font-medium">Aggregate View Active</p>
              <p className="text-sm">Select a specific business for compliance rules</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Business Compliance
          </span>
          <Badge 
            variant={complianceData.riskLevel === 'low' ? 'default' : 
                    complianceData.riskLevel === 'medium' ? 'secondary' : 'destructive'}
          >
            {complianceData.riskLevel} risk
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Business Name */}
        <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-md">
          <Building2 className="h-4 w-4 text-primary" />
          <span className="font-medium">{businessName || 'Unknown'}</span>
        </div>

        {/* Health Score */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Communication Health</span>
            <span className="font-medium">{complianceData.healthScore}%</span>
          </div>
          <Progress value={complianceData.healthScore} className="h-2" />
        </div>

        {/* AI/Human Rules */}
        <div className="grid grid-cols-2 gap-2">
          <div className={`p-2 rounded-md text-sm ${complianceData.aiAllowed ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted'}`}>
            <Bot className="h-4 w-4 mb-1" />
            <p className="font-medium">AI Agent</p>
            <p className="text-xs">{complianceData.aiAllowed ? 'Allowed' : 'Disabled'}</p>
          </div>
          <div className={`p-2 rounded-md text-sm ${complianceData.humanRequired ? 'bg-amber-500/10 text-amber-600' : 'bg-muted'}`}>
            <User className="h-4 w-4 mb-1" />
            <p className="font-medium">Human</p>
            <p className="text-xs">{complianceData.humanRequired ? 'Required' : 'Optional'}</p>
          </div>
        </div>

        {/* Allowed Channels */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Allowed Channels</p>
          <div className="flex gap-2">
            {complianceData.channels.call && (
              <Badge variant="outline" className="gap-1">
                <Phone className="h-3 w-3" /> Call
              </Badge>
            )}
            {complianceData.channels.text && (
              <Badge variant="outline" className="gap-1">
                <MessageSquare className="h-3 w-3" /> Text
              </Badge>
            )}
            {complianceData.channels.email && (
              <Badge variant="outline" className="gap-1">
                <Mail className="h-3 w-3" /> Email
              </Badge>
            )}
          </div>
        </div>

        {/* SLA */}
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">SLA Target:</span>
          <span className="font-medium">{complianceData.slaMinutes} min response</span>
        </div>

        {/* Escalation Rules */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Auto-Escalation Triggers</p>
          <div className="flex flex-wrap gap-1">
            {complianceData.escalationRules.map((rule, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {rule}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
