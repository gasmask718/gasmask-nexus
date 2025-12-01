import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Terminal,
  Send,
  Bot,
  User,
  Sparkles,
  Clock,
  Loader2,
} from 'lucide-react';

const sampleCommands = [
  "Summarize yesterday's performance and give me 3 actions per brand.",
  "Find any system that is under-utilized but high potential.",
  "Which business needs my attention most right now?",
  "Show me the top 5 revenue opportunities across all businesses.",
  "List all automations that failed in the last 24 hours.",
];

const commandHistory = [
  {
    id: '1',
    command: "What's the status of the Funding Company pipeline?",
    response: "The Funding Company pipeline has 12 active files. 4 are in underwriting (2 over SLA), 5 awaiting documentation, and 3 ready for closing. Total potential revenue: $45,000 in fees. Recommendation: Focus on the 2 over-SLA files immediately.",
    timestamp: '10 min ago',
  },
  {
    id: '2',
    command: "How are ambassadors performing this week?",
    response: "Ambassador performance this week: 40 active ambassadors generated 85 referrals (+12% vs last week). Top performer: Marcus T. with 14 referrals. 12 ambassadors are dormant (no activity in 30 days). Recommendation: Send re-engagement campaign to dormant ambassadors.",
    timestamp: '1 hour ago',
  },
];

export default function OwnerAICommandConsole() {
  const [command, setCommand] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [history, setHistory] = useState(commandHistory);

  const generateMockCommandResponse = (cmd: string): string => {
    const c = cmd.toLowerCase();

    if (c.includes('gasmask') || c.includes('grabba') || c.includes('tobacco'))
      return "GasMask/Grabba Operations Summary: 5 stores flagged for low inventory. 3 dormant ambassadors need reactivation. Brooklyn delivery routes showing 12% inefficiency - recommend route optimization. Weekly revenue up 8% vs last week.";

    if (c.includes('toptier') || c.includes('black truck') || c.includes('experience'))
      return "TopTier Strategy: Weekend bookings at 78% capacity. Recommend: Raise base price by $15 for premium slots. Bundle roses + champagne for +$85 AOV. 2 new drivers needed for NJ expansion. 3 bookings missing payment confirmation.";

    if (c.includes('playbox') || c.includes('creator') || c.includes('adult'))
      return "PlayBoxxx Focus: 12 active creators, 3 pending onboarding. Top performer: @luxe_lifestyle at $4,200 MTD. 2 payout reviews pending approval. Celebration product line showing 34% growth. Compliance: all clear.";

    if (c.includes('funding') || c.includes('loan') || c.includes('underwriting'))
      return "Funding Company Pipeline: 12 active files, 4 in underwriting (2 over 48hr SLA). Expected fees: $45,000. Action needed: Escalate SLA breaches to senior underwriter. 3 files ready for closing this week.";

    if (c.includes('grant') || c.includes('application'))
      return "Grants Status: 8 active applications across clients. 3 approaching deadline (next 7 days). 2 in final review stage. Success rate this quarter: 67%. Recommendation: Follow up on dormant applications.";

    if (c.includes('sports') || c.includes('betting') || c.includes('bankroll'))
      return "Sports AI Report: Bankroll at $15,400. Win rate: 58% (last 30 days). Today's high-confidence plays: 2 identified. Recommendation: Stick to unit sizing, avoid parlays. Hedge calculator suggests 12% allocation to tonight's main event.";

    if (c.includes('real estate') || c.includes('property') || c.includes('holding'))
      return "Real Estate Holdings: 8 properties, $450K equity. Monthly cash flow: $12,500. 1 property under renovation (expected completion: 6 weeks). Airbnb occupancy: 82%. No immediate action required.";

    if (c.includes('ambassador') || c.includes('referral'))
      return "Ambassador Network: 40 active, 12 dormant. Top performer: Marcus T. (14 referrals this week). Total referrals this month: 85 (+12% vs last month). Action: Send re-engagement campaign to dormant ambassadors.";

    if (c.includes('driver') || c.includes('delivery') || c.includes('route'))
      return "Driver Operations: 50 active drivers. On-time rate: 94%. 3 routes need optimization (Queens, Brooklyn East, Bronx South). 2 drivers approaching overtime threshold. Fleet utilization: 87%.";

    if (c.includes('summary') || c.includes('performance') || c.includes('yesterday'))
      return "Empire Performance Summary: Total revenue +11% WoW. Top performer: TopTier Experience (+18%). Needs attention: Funding Company (SLA issues). Quick wins: 1) Raise TopTier weekend prices 2) Activate dormant ambassadors 3) Clear underwriting backlog.";

    if (c.includes('risk') || c.includes('alert') || c.includes('warning'))
      return "Active Risks: 1 Critical (Funding SLA breach), 2 Warnings (TopTier payments, PlayBoxxx payouts). Operational health: 87%. Recommendation: Address critical item within 2 hours.";

    return "Command processed. Analysis complete across all empire data. Key metrics are stable. No immediate action required. For specific insights, try: 'Show me TopTier performance' or 'What needs my attention today?'";
  };

  const handleSubmit = () => {
    if (!command.trim()) return;
    
    setIsProcessing(true);
    
    // Generate smart AI response
    setTimeout(() => {
      const aiResponse = generateMockCommandResponse(command);
      const newEntry = {
        id: Date.now().toString(),
        command: command,
        response: aiResponse,
        timestamp: 'Just now',
      };
      setHistory([newEntry, ...history]);
      setCommand('');
      setIsProcessing(false);
    }, 1500);
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/10 border border-violet-500/30">
            <Terminal className="h-8 w-8 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI Command Console</h1>
            <p className="text-sm text-muted-foreground">
              Natural language control over your entire empire
            </p>
          </div>
        </div>
        <Badge variant="outline" className="bg-violet-500/20 text-violet-400 border-violet-500/30 w-fit">
          <Sparkles className="h-3 w-3 mr-1" />
          AI-Powered
        </Badge>
      </div>

      {/* Command Input */}
      <Card className="rounded-xl border-violet-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-4 w-4 text-violet-400" />
            Enter Command
          </CardTitle>
          <CardDescription className="text-xs">
            Ask anything about your businesses, data, or operations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Type your command here... e.g., 'Summarize yesterday's performance across all businesses'"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            className="min-h-[100px] resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.metaKey) {
                handleSubmit();
              }
            }}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Press ⌘+Enter to run
            </p>
            <Button 
              onClick={handleSubmit} 
              disabled={isProcessing || !command.trim()}
              className="gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Run Command
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sample Commands */}
      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sample Commands</CardTitle>
          <CardDescription className="text-xs">Click to use</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {sampleCommands.map((sample, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setCommand(sample)}
              >
                {sample.length > 50 ? sample.slice(0, 50) + '...' : sample}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Command History */}
      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Command History
          </CardTitle>
          <CardDescription className="text-xs">Previous commands and AI responses</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {history.map((entry) => (
                <div key={entry.id} className="space-y-3 pb-4 border-b border-border/50 last:border-0">
                  {/* User Command */}
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/20">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{entry.command}</p>
                      <p className="text-xs text-muted-foreground">{entry.timestamp}</p>
                    </div>
                  </div>
                  {/* AI Response */}
                  <div className="flex items-start gap-3 ml-6">
                    <div className="p-2 rounded-lg bg-violet-500/20">
                      <Bot className="h-4 w-4 text-violet-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">{entry.response}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
