import CommSystemsLayout from "../CommSystemsLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, PhoneMissed, MessageSquare, Mail, ArrowRight } from "lucide-react";

export default function CommAutomationPage() {
  const automations = [
    { trigger: 'Missed Call', action: 'Send SMS', status: 'active' },
    { trigger: 'No Reply (24h)', action: 'Send Email', status: 'active' },
    { trigger: 'Negative Sentiment', action: 'Assign Human', status: 'active' },
    { trigger: 'VIP Contact', action: 'Priority Queue', status: 'paused' },
  ];

  return (
    <CommSystemsLayout title="Comm Automation" subtitle="Trigger-based execution flows">
      <div className="space-y-4">
        {automations.map((auto, i) => (
          <Card key={i}>
            <CardContent className="py-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"><Zap className="h-5 w-5 text-primary" /></div>
              <div className="flex-1 flex items-center gap-2">
                <span className="font-medium">{auto.trigger}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span>{auto.action}</span>
              </div>
              <span className={`text-sm ${auto.status === 'active' ? 'text-green-600' : 'text-muted-foreground'}`}>{auto.status}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </CommSystemsLayout>
  );
}
