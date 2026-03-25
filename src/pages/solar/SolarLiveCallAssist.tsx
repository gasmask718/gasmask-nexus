import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Phone, Mic, AlertTriangle, CheckCircle2, Brain, MessageSquare,
  ThumbsUp, ThumbsDown, Zap, Sun, Volume2, User
} from 'lucide-react';

const AMBER = '#E8A317';

// Mock live call data for UI demonstration
const MOCK_SUGGESTIONS = [
  { type: 'opener', text: '"I\'m not here to sell you anything today — just want to see if you\'d even qualify for the savings program."' },
  { type: 'qualifying', text: 'Ask about their current monthly electric bill — key qualifier.' },
  { type: 'objection', text: '"I totally understand. Most of our happiest customers felt the same way initially. Can I ask what specifically concerns you?"' },
];

const MOCK_OBJECTIONS = [
  { keyword: 'too expensive', response: '"Actually, most homeowners go solar with $0 down. Your monthly payment is typically less than your current electric bill."' },
  { keyword: 'not interested', response: '"I hear you. Before you go — did you know homeowners in your area are saving $150-300/month? It literally costs nothing to find out your number."' },
  { keyword: 'need to think', response: '"Absolutely, take your time. Just so you know, the federal tax credit drops from 30% to 26% next quarter. Can I send you the details?"' },
  { keyword: 'renting', response: '"Got it — unfortunately the program is only for homeowners. Do you own any other property? If not, totally understand."' },
  { keyword: 'already have solar', response: '"Great! How\'s it working for you? We actually help existing solar owners optimize and expand their systems for even more savings."' },
];

export default function SolarLiveCallAssist() {
  const [activeCall, setActiveCall] = useState<any>(null);
  const [sentiment, setSentiment] = useState<'positive' | 'neutral' | 'negative'>('neutral');

  // Recent calls
  const { data: recentCalls = [] } = useQuery({
    queryKey: ['solar-live-calls'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solar_interactions')
        .select('*, solar_leads(full_name, phone, city, state, monthly_bill_range, lead_score)')
        .eq('interaction_type', 'call')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 5000,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="h-6 w-6" style={{ color: AMBER }} />
            Floor 5 — Live Call Assist
          </h1>
          <p className="text-sm text-muted-foreground">Real-time transcript, AI coaching, and objection handling</p>
        </div>
        <Badge variant="outline" className="text-green-400 border-green-400 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block mr-1.5" />
          SYSTEM READY
        </Badge>
      </div>

      {/* Active Call Panel */}
      <Card className="border-2" style={{ borderColor: `${AMBER}40` }}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mic className="h-5 w-5" style={{ color: AMBER }} />
              <span>Active Call Monitor</span>
            </div>
            {!activeCall && (
              <Badge variant="outline" className="text-muted-foreground">No active call</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!activeCall ? (
            <div className="py-12 text-center">
              <Phone className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="text-lg font-semibold mb-2">Waiting for active call...</h3>
              <p className="text-sm text-muted-foreground mb-4">Start a call from the Outreach Engine or Campaign Manager</p>
              <Button
                style={{ backgroundColor: AMBER }}
                onClick={() => setActiveCall({ name: 'Demo Call', phone: '+1 (555) 123-4567' })}
              >
                <Phone className="h-4 w-4 mr-1" /> Start Demo Call
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left — Live Transcript */}
              <div className="lg:col-span-2 space-y-4">
                {/* Sentiment Bar */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <span className="text-sm font-medium">Sentiment:</span>
                  <div className="flex gap-2">
                    {(['positive', 'neutral', 'negative'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setSentiment(s)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                          sentiment === s
                            ? s === 'positive' ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500'
                            : s === 'neutral' ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500'
                            : 'bg-red-500/20 text-red-400 ring-1 ring-red-500'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {s === 'positive' ? '😊 Positive' : s === 'neutral' ? '😐 Neutral' : '😟 Negative'}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1" />
                  <Badge variant="outline" className="text-red-400 border-red-400 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-red-400 inline-block mr-1" />
                    LIVE
                  </Badge>
                </div>

                {/* Transcript */}
                <div className="bg-muted/20 rounded-lg p-4 h-72 overflow-auto space-y-3">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ backgroundColor: `${AMBER}30`, color: AMBER }}>AI</div>
                    <div className="bg-muted/40 rounded-lg p-3 flex-1">
                      <p className="text-sm">"Hey there! This is Sarah from BrightSun Energy. I'm calling about a savings program for homeowners in your area. Got 60 seconds?"</p>
                      <p className="text-xs text-muted-foreground mt-1">0:03</p>
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <div className="bg-muted/20 rounded-lg p-3 max-w-[80%]">
                      <p className="text-sm">"Yeah, what is it about?"</p>
                      <p className="text-xs text-muted-foreground mt-1">0:08</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ backgroundColor: `${AMBER}30`, color: AMBER }}>AI</div>
                    <div className="bg-muted/40 rounded-lg p-3 flex-1">
                      <p className="text-sm">"Great question. We've been helping homeowners in your area eliminate their electric bill completely through solar. Are you the homeowner?"</p>
                      <p className="text-xs text-muted-foreground mt-1">0:15</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 justify-center py-2">
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: AMBER }} />
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: AMBER, animationDelay: '0.2s' }} />
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: AMBER, animationDelay: '0.4s' }} />
                    <span className="text-xs text-muted-foreground ml-1">Listening...</span>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm"><Volume2 className="h-3 w-3 mr-1" /> Whisper</Button>
                  <Button variant="outline" size="sm"><Zap className="h-3 w-3 mr-1" /> Transfer</Button>
                  <Button variant="destructive" size="sm" onClick={() => setActiveCall(null)}>End Call</Button>
                </div>
              </div>

              {/* Right — AI Assist Panel */}
              <div className="space-y-4">
                {/* AI Suggestions */}
                <Card className="border" style={{ borderColor: `${AMBER}30` }}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Brain className="h-4 w-4" style={{ color: AMBER }} />
                      AI Suggestions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {MOCK_SUGGESTIONS.map((s, i) => (
                      <div key={i} className="p-2 rounded border border-border/30 bg-muted/20">
                        <Badge variant="outline" className="text-[10px] mb-1" style={{ color: AMBER, borderColor: AMBER }}>
                          {s.type}
                        </Badge>
                        <p className="text-xs italic">{s.text}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Close Signal */}
                <Card className="border-green-500/30 bg-green-500/5">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-4 w-4 text-green-400" />
                      <span className="text-sm font-bold text-green-400">CLOSE NOW</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      "Prospect confirmed homeowner + $200/mo bill. High buying signal detected. Push for appointment."
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Objection Library */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" style={{ color: AMBER }} />
            Objection Response Library
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {MOCK_OBJECTIONS.map((obj, i) => (
            <div key={i} className="p-3 rounded-lg border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="text-red-400 border-red-400 text-xs">"{obj.keyword}"</Badge>
              </div>
              <p className="text-sm text-muted-foreground italic">{obj.response}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Recent Calls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Calls</CardTitle>
        </CardHeader>
        <CardContent>
          {recentCalls.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">No calls recorded yet</p>
          ) : (
            <div className="space-y-2">
              {recentCalls.map((call: any) => (
                <div key={call.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/30">
                  <Phone className="h-4 w-4 text-green-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{call.solar_leads?.full_name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{call.summary || 'Call completed'}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
