import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Phone, Zap } from 'lucide-react';

export default function UTAutomation() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Floor 6 — AI & Automation</h1>
        <p className="text-muted-foreground">AI calling scripts, automation flows, and outreach intelligence</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Phone className="h-5 w-5 text-pink-500" />
            <CardTitle className="text-base">AI Calling Scripts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Category-specific scripts for event halls, decorators, caterers with objection handling</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Bot className="h-5 w-5 text-purple-500" />
            <CardTitle className="text-base">AI Dialer Integration</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">ElevenLabs agent routing — Sales Intro, Follow-up, Win-back</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-base">Automation Flows</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Auto-disposition, follow-up scheduling, onboarding triggers</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
