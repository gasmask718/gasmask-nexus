import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Calendar,
  Sun,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageSquare,
  Send,
  Loader2,
  Sparkles,
  Bot,
} from 'lucide-react';

const briefingData = {
  date: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
  greeting: "Good morning! Here's your empire status.",
  highlights: [
    { type: 'positive', text: 'TopTier Experience revenue up 24% this week', icon: TrendingUp },
    { type: 'positive', text: '85 new referrals from ambassadors', icon: CheckCircle2 },
    { type: 'warning', text: '4 funding files over SLA - needs attention', icon: AlertTriangle },
    { type: 'positive', text: 'All 10 core automations running smoothly', icon: CheckCircle2 },
  ],
  todayFocus: [
    { priority: 'high', task: 'Review 4 over-SLA funding files', business: 'Funding Company' },
    { priority: 'high', task: 'Complete grant client documentation', business: 'Grant Company' },
    { priority: 'medium', task: 'Review creator payouts', business: 'Playboxxx' },
    { priority: 'medium', task: 'Check driver coverage in Zone 3', business: 'GasMask / Grabba' },
  ],
  metrics: {
    revenueYesterday: 12450,
    revenueTrend: +8,
    activeOrders: 47,
    openTasks: 23,
  },
};

const sampleQuestions = [
  "What should I prioritize today?",
  "Which business needs my attention most?",
  "Are there any urgent issues?",
  "How are we tracking vs last week?",
];

export default function OwnerDailyBriefing() {
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);

  const handleAsk = () => {
    if (!question.trim()) return;
    setIsAsking(true);
    
    // Simulate AI response
    setTimeout(() => {
      setAnswer("Based on today's data, I recommend prioritizing the 4 funding files that are over SLA. These represent approximately $15,000 in potential revenue and have been waiting over 48 hours. After that, focus on the grant documentation deadline in 72 hours. The driver shortage in Zone 3 can be addressed by end of day through reassignment.");
      setIsAsking(false);
    }, 2000);
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30">
            <Sun className="h-8 w-8 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Daily Briefing</h1>
            <p className="text-sm text-muted-foreground">{briefingData.date}</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30 w-fit">
          <Clock className="h-3 w-3 mr-1" />
          Updated 5 min ago
        </Badge>
      </div>

      {/* Greeting Card */}
      <Card className="rounded-xl bg-gradient-to-r from-amber-950/30 via-orange-950/20 to-background border-amber-500/30">
        <CardContent className="pt-6">
          <p className="text-lg font-medium text-amber-100">{briefingData.greeting}</p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Key Highlights */}
          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                Key Highlights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {briefingData.highlights.map((highlight, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <div className={cn(
                      "p-2 rounded-lg",
                      highlight.type === 'positive' ? 'bg-emerald-500/20' : 'bg-amber-500/20'
                    )}>
                      <highlight.icon className={cn(
                        "h-4 w-4",
                        highlight.type === 'positive' ? 'text-emerald-400' : 'text-amber-400'
                      )} />
                    </div>
                    <p className="text-sm">{highlight.text}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Today's Focus */}
          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Today's Focus
              </CardTitle>
              <CardDescription className="text-xs">Priority tasks for today</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {briefingData.todayFocus.map((task, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={cn(
                        task.priority === 'high' 
                          ? 'bg-red-500/20 text-red-400 border-red-500/30' 
                          : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                      )}>
                        {task.priority}
                      </Badge>
                      <span className="text-sm">{task.task}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{task.business}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Ask the Briefing */}
          <Card className="rounded-xl border-violet-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="h-4 w-4 text-violet-400" />
                Ask Today's Briefing
              </CardTitle>
              <CardDescription className="text-xs">Get AI-powered answers about your day</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Ask a question about today..."
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
                />
                <Button onClick={handleAsk} disabled={isAsking || !question.trim()}>
                  {isAsking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              
              {/* Sample Questions */}
              <div className="flex flex-wrap gap-2">
                {sampleQuestions.map((q, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setQuestion(q)}
                  >
                    {q}
                  </Button>
                ))}
              </div>

              {/* Answer */}
              {answer && (
                <div className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/20">
                  <div className="flex items-start gap-3">
                    <Bot className="h-5 w-5 text-violet-400 mt-0.5" />
                    <p className="text-sm text-foreground/90">{answer}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Metrics */}
          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Yesterday's Revenue</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold">${briefingData.metrics.revenueYesterday.toLocaleString()}</span>
                  <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                    +{briefingData.metrics.revenueTrend}%
                  </Badge>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Active Orders</span>
                <span className="font-bold">{briefingData.metrics.activeOrders}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Open Tasks</span>
                <span className="font-bold">{briefingData.metrics.openTasks}</span>
              </div>
            </CardContent>
          </Card>

          {/* Weather / Time Widget Placeholder */}
          <Card className="rounded-xl bg-gradient-to-br from-sky-950/30 to-blue-950/20 border-sky-500/30">
            <CardContent className="pt-6 text-center">
              <Sun className="h-12 w-12 text-amber-400 mx-auto mb-2" />
              <p className="text-2xl font-bold">72°F</p>
              <p className="text-sm text-muted-foreground">Clear skies in your area</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
