import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bot, Play, Clock, MessageSquare } from 'lucide-react';

const automationJobs = [
  {
    name: 'Lead Import Cron',
    description: 'Imports leads from county records and public sources',
    schedule: 'Monday 6am',
    lastRun: null,
    status: 'ready',
  },
  {
    name: 'Skip Trace Cron',
    description: 'Finds phone numbers for leads via BatchSkipTracing',
    schedule: 'Daily 7am',
    lastRun: null,
    status: 'ready',
  },
  {
    name: 'DC Campaign Queue',
    description: 'Queues qualified leads for Dynasty Connect calling',
    schedule: 'Weekdays 9am',
    lastRun: null,
    status: 'ready',
  },
  {
    name: 'Agent Self-Learn',
    description: 'AI analyzes call outcomes and updates scripts',
    schedule: '2am nightly',
    lastRun: null,
    status: 'ready',
  },
];

const objections = [
  { objection: '"This sounds like a scam"', response: '"I totally understand your concern. We\'re a licensed recovery firm that works with attorneys to file legitimate court claims. You can verify us at [website]. We don\'t get paid unless you get paid — that\'s our guarantee."' },
  { objection: '"I already claimed my funds"', response: '"That\'s great! Just to confirm — are you sure there isn\'t an additional surplus from a separate sale or judgment? We often find people have more than one claim. Can I verify that for you at no cost?"' },
  { objection: '"How much do you take?"', response: '"Our standard is 35% of recovered funds. But here\'s the thing — without us, most people never find out this money exists. We handle everything: the legal work, the court filings, the attorney coordination. You don\'t pay a dime unless we recover your money."' },
  { objection: '"I need to talk to my lawyer"', response: '"Absolutely, please do! In fact, we work with attorneys ourselves. If your lawyer wants to handle it directly, that\'s fine. But most attorneys don\'t specialize in surplus recovery — we do. Happy to speak with your attorney directly."' },
  { objection: '"How long does this take?"', response: '"Typically 60-90 days depending on the county and court schedule. Some states move faster. We\'ll keep you updated every step of the way — you\'ll always know exactly where your case stands."' },
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
              {job.lastRun && (
                <p className="text-xs text-muted-foreground mt-2">Last run: {job.lastRun}</p>
              )}
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

      {/* Objection Library */}
      <Card className="border-amber-500/20">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-amber-500" />
            Sales Mastery — Objection Library
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {objections.map((o, i) => (
            <div key={i} className="border-b border-border/50 pb-3 last:border-0 last:pb-0">
              <p className="text-sm font-medium text-red-400 mb-1">🗣️ {o.objection}</p>
              <p className="text-sm text-green-400 pl-4">✅ {o.response}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
