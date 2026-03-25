import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bot, Play, Clock } from 'lucide-react';
import { SalesMasteryEngine } from '@/components/sales-mastery';

const SF_ACCENT = '#BA7517';

const automationJobs = [
  { name: 'Lead Import Cron', description: 'Imports leads from county records and public sources', schedule: 'Monday 6am', lastRun: null, status: 'ready' },
  { name: 'Skip Trace Cron', description: 'Finds phone numbers for leads via BatchSkipTracing', schedule: 'Daily 7am', lastRun: null, status: 'ready' },
  { name: 'DC Campaign Queue', description: 'Queues qualified leads for Dynasty Connect calling', schedule: 'Weekdays 9am', lastRun: null, status: 'ready' },
  { name: 'Agent Self-Learn', description: 'AI analyzes call outcomes and updates scripts', schedule: '2am nightly', lastRun: null, status: 'ready' },
];

export default function SFAutomation() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-amber-500">🤖 Floor 6 — AI & Automation</h1>
        <p className="text-sm text-muted-foreground">The engine room — controls all automated processes</p>
      </div>

      {/* Automation Status Panel */}
      <div className="grid md:grid-cols-2 gap-4">
        {automationJobs.map(job => (
          <Card key={job.name} className="border-amber-500/20">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
                  <span className="font-medium text-sm">{job.name}</span>
                </div>
                <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500 text-xs">Ready</Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{job.description}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Schedule: {job.schedule}</span>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs">
                  <Play className="h-3 w-3 mr-1" />Run Now
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Agent Performance */}
      <Card className="border-amber-500/20">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><Bot className="h-4 w-4 text-amber-500" />DC Agent Performance — Surplus Funds</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div><p className="text-2xl font-bold">0</p><p className="text-xs text-muted-foreground">Calls Made</p></div>
            <div><p className="text-2xl font-bold">0</p><p className="text-xs text-muted-foreground">Contacts</p></div>
            <div><p className="text-2xl font-bold">0%</p><p className="text-xs text-muted-foreground">Interest Rate</p></div>
            <div><p className="text-2xl font-bold">—</p><p className="text-xs text-muted-foreground">Best Script</p></div>
          </div>
        </CardContent>
      </Card>

      {/* Sales Mastery Engine — Full Integration */}
      <SalesMasteryEngine hub="surplus_funds" accentColor={SF_ACCENT} />
    </div>
  );
}
