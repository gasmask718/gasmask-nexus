import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { 
  Phone, Play, Pause, Square, Users, CheckCircle, Voicemail, XCircle, 
  RefreshCw, Headphones, Volume2, Clock, Zap, Target, BarChart3, 
  Brain, TrendingUp, TrendingDown, AlertTriangle, Sparkles, Settings,
  ArrowUpRight, ArrowDownRight, Calendar, MessageSquare, UserCheck,
  Activity, Mic, Radio, Shield, LineChart
} from "lucide-react";

// Mock data for V2 features
const mockPriorityQueue = [
  { id: "1", storeName: "Mike's Corner Store", priority: 95, lastOrder: "45 days ago", risk: 85, opportunity: 92, status: "pending", reason: "High churn risk + past big spender" },
  { id: "2", storeName: "Downtown Liquor", priority: 88, lastOrder: "12 days ago", risk: 25, opportunity: 78, status: "pending", reason: "Reorder window open" },
  { id: "3", storeName: "Quick Mart #42", priority: 82, lastOrder: "60 days ago", risk: 92, opportunity: 65, status: "calling", reason: "Win-back candidate" },
  { id: "4", storeName: "Sam's Tobacco", priority: 75, lastOrder: "8 days ago", risk: 15, opportunity: 88, status: "completed", reason: "Upsell opportunity" },
  { id: "5", storeName: "City Smoke Shop", priority: 70, lastOrder: "30 days ago", risk: 55, opportunity: 60, status: "pending", reason: "Regular check-in due" },
];

const mockActiveCalls = [
  { 
    id: "1", 
    storeName: "Quick Mart #42", 
    phone: "+1 555-0123", 
    duration: "2:34", 
    persona: "Sales Pro",
    currentPersona: "Calm Professional", 
    sentiment: "neutral",
    sentimentTrend: "improving",
    transcript: "...yes, I understand. We have some new products that might interest you...",
    prediction: { orderLikely: 72, followUpNeeded: true }
  },
  { 
    id: "2", 
    storeName: "City Smoke Shop", 
    phone: "+1 555-0456", 
    duration: "1:12", 
    persona: "Friendly Helper",
    currentPersona: "Friendly Helper", 
    sentiment: "positive",
    sentimentTrend: "stable",
    transcript: "That sounds great! When can I expect the delivery?",
    prediction: { orderLikely: 89, followUpNeeded: false }
  },
];

const mockOptimizationData = {
  bestTimeToCall: "10:00 AM - 11:30 AM",
  bestPersona: "Friendly Helper",
  bestScript: "Reactivation Flow v2",
  weeklyInsights: [
    "Answer rates 23% higher on Tuesdays",
    "Stores respond better to personalized intros",
    "Follow-up texts increase conversion by 34%",
    "Shorter calls (< 2 min) have higher success"
  ],
  answerRateByDay: [
    { day: "Mon", rate: 42 },
    { day: "Tue", rate: 58 },
    { day: "Wed", rate: 51 },
    { day: "Thu", rate: 48 },
    { day: "Fri", rate: 38 },
  ],
  conversionBySegment: [
    { segment: "Dead Stores", rate: 18 },
    { segment: "New Stores", rate: 45 },
    { segment: "High Value", rate: 62 },
    { segment: "At Risk", rate: 28 },
  ]
};

export default function AIAutoDialerPage() {
  const [campaignName, setCampaignName] = useState("");
  const [selectedPersona, setSelectedPersona] = useState("");
  const [selectedFlow, setSelectedFlow] = useState("");
  const [selectedSegment, setSelectedSegment] = useState("");
  const [priorityMode, setPriorityMode] = useState("predictive");
  const [throttle, setThrottle] = useState("5");
  const [enableSequence, setEnableSequence] = useState(false);
  const [enableFollowUp, setEnableFollowUp] = useState(true);
  const [enablePersonaSwitching, setEnablePersonaSwitching] = useState(true);
  const [enableSentimentAdaptation, setEnableSentimentAdaptation] = useState(true);
  const [followUpTemplate, setFollowUpTemplate] = useState("Thanks for chatting with us! Here's a quick link to place your order: {order_link}");
  const [day1Flow, setDay1Flow] = useState("");
  const [day3Flow, setDay3Flow] = useState("");
  const [day7Flow, setDay7Flow] = useState("");

  const stats = {
    todayCalls: 245,
    answerRate: 68,
    connected: 167,
    conversions: 42,
    voicemailRate: 22,
    bestPersona: "Friendly Helper",
    bestTime: "10:30 AM",
    atRisk: 34,
    likelyOrder: 78,
  };

  return (
    <div className="w-full min-h-full flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="h-6 w-6 text-primary" />
            AI Auto Dialer
            <Badge variant="secondary" className="ml-2">V2</Badge>
          </h1>
          <p className="text-muted-foreground">Intelligent outbound calling with predictive targeting & adaptive AI</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            {mockActiveCalls.length} Active Calls
          </Badge>
          <Badge variant="outline" className="gap-1 text-primary">
            <Brain className="h-3 w-3" />
            AI Learning
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-5">
          <TabsTrigger value="overview" className="gap-1">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="targeting" className="gap-1">
            <Target className="h-4 w-4" />
            Smart Targeting
          </TabsTrigger>
          <TabsTrigger value="live" className="gap-1">
            <Headphones className="h-4 w-4" />
            Live Calls
          </TabsTrigger>
          <TabsTrigger value="optimization" className="gap-1">
            <LineChart className="h-4 w-4" />
            Optimization
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        {/* OVERVIEW TAB */}
        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="overview" className="space-y-6">
          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Today's Calls</p>
                    <p className="text-2xl font-bold">{stats.todayCalls}</p>
                  </div>
                  <Phone className="h-8 w-8 text-primary/20" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Answer Rate</p>
                    <p className="text-2xl font-bold text-green-600">{stats.answerRate}%</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-500/20" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Conversions</p>
                    <p className="text-2xl font-bold text-blue-600">{stats.conversions}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-blue-500/20" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">At Risk Stores</p>
                    <p className="text-2xl font-bold text-orange-600">{stats.atRisk}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-orange-500/20" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Likely to Order</p>
                    <p className="text-2xl font-bold text-emerald-600">{stats.likelyOrder}</p>
                  </div>
                  <Sparkles className="h-8 w-8 text-emerald-500/20" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Campaign Creator */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Quick Campaign Launch
                </CardTitle>
                <CardDescription>Create and launch AI calling campaigns</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Campaign Name</Label>
                    <Input
                      placeholder="e.g., Q1 Win-Back"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Priority Mode</Label>
                    <Select value={priorityMode} onValueChange={setPriorityMode}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="predictive">🧠 Predictive (AI Ranked)</SelectItem>
                        <SelectItem value="high_value">💎 High Value First</SelectItem>
                        <SelectItem value="high_risk">⚠️ High Risk First</SelectItem>
                        <SelectItem value="reactivation">🔄 Reactivation</SelectItem>
                        <SelectItem value="even">⚖️ Even Distribution</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Voice Persona</Label>
                    <Select value={selectedPersona} onValueChange={setSelectedPersona}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select persona" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sales-pro">Sales Pro</SelectItem>
                        <SelectItem value="friendly">Friendly Helper</SelectItem>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="empathetic">Empathetic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Target Segment</Label>
                    <Select value={selectedSegment} onValueChange={setSelectedSegment}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select segment" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Stores</SelectItem>
                        <SelectItem value="dead">Dead Stores (60+ days)</SelectItem>
                        <SelectItem value="at-risk">At Risk Stores</SelectItem>
                        <SelectItem value="high-value">High Value</SelectItem>
                        <SelectItem value="new">New Stores</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button className="flex-1 gap-2">
                    <Play className="h-4 w-4" />
                    Launch Campaign
                  </Button>
                  <Button variant="outline" className="gap-2">
                    <Calendar className="h-4 w-4" />
                    Schedule
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* AI Insights */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  AI Insights
                </CardTitle>
                <CardDescription>What AI learned this week</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-3 rounded-lg bg-primary/5 border">
                    <p className="text-xs text-muted-foreground">Best Time to Call</p>
                    <p className="font-semibold">{stats.bestTime}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-primary/5 border">
                    <p className="text-xs text-muted-foreground">Best Persona</p>
                    <p className="font-semibold">{stats.bestPersona}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {mockOptimizationData.weeklyInsights.slice(0, 3).map((insight, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{insight}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Active Campaign */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Active Campaign: Dead Stores Revival
                </span>
                <Badge variant="default" className="gap-1">
                  <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                  Running
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span>Progress: 180 / 250 stores</span>
                  <span>72%</span>
                </div>
                <Progress value={72} className="h-2" />
                <div className="grid gap-4 sm:grid-cols-4">
                  <div className="text-center p-2 rounded bg-green-500/10">
                    <p className="text-2xl font-bold text-green-600">145</p>
                    <p className="text-xs text-muted-foreground">Answered</p>
                  </div>
                  <div className="text-center p-2 rounded bg-yellow-500/10">
                    <p className="text-2xl font-bold text-yellow-600">28</p>
                    <p className="text-xs text-muted-foreground">Voicemail</p>
                  </div>
                  <div className="text-center p-2 rounded bg-red-500/10">
                    <p className="text-2xl font-bold text-red-600">7</p>
                    <p className="text-xs text-muted-foreground">Failed</p>
                  </div>
                  <div className="text-center p-2 rounded bg-blue-500/10">
                    <p className="text-2xl font-bold text-blue-600">42</p>
                    <p className="text-xs text-muted-foreground">Conversions</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1">
                    <Pause className="h-4 w-4" />
                    Pause
                  </Button>
                  <Button variant="destructive" size="sm" className="gap-1">
                    <Square className="h-4 w-4" />
                    Stop
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        {/* SMART TARGETING TAB */}
        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="targeting" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Smart Priority Queue
              </CardTitle>
              <CardDescription>AI-ranked stores based on CRM behavior, risk, and opportunity scores</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Button size="sm" className="gap-1">
                  <RefreshCw className="h-4 w-4" />
                  Rebuild Queue
                </Button>
                <Button size="sm" variant="outline" className="gap-1">
                  <Play className="h-4 w-4" />
                  Start Calling Queue
                </Button>
              </div>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Priority</TableHead>
                      <TableHead>Store</TableHead>
                      <TableHead>Last Order</TableHead>
                      <TableHead>Risk Score</TableHead>
                      <TableHead>Opportunity</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockPriorityQueue.map((store) => (
                      <TableRow key={store.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                              store.priority >= 90 ? 'bg-red-500 text-white' :
                              store.priority >= 80 ? 'bg-orange-500 text-white' :
                              store.priority >= 70 ? 'bg-yellow-500 text-black' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {store.priority}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{store.storeName}</TableCell>
                        <TableCell className="text-muted-foreground">{store.lastOrder}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {store.risk >= 70 ? (
                              <TrendingDown className="h-4 w-4 text-red-500" />
                            ) : (
                              <TrendingUp className="h-4 w-4 text-green-500" />
                            )}
                            <span className={store.risk >= 70 ? 'text-red-600' : 'text-green-600'}>{store.risk}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Sparkles className="h-4 w-4 text-blue-500" />
                            <span className="text-blue-600">{store.opportunity}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{store.reason}</TableCell>
                        <TableCell>
                          <Badge variant={
                            store.status === 'completed' ? 'secondary' :
                            store.status === 'calling' ? 'default' :
                            'outline'
                          }>
                            {store.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        {/* LIVE CALLS TAB */}
        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="live" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {mockActiveCalls.map((call) => (
              <Card key={call.id} className="border-2 border-green-500/30">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{call.storeName}</CardTitle>
                    <Badge variant="outline" className="gap-1 text-green-600">
                      <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      Live
                    </Badge>
                  </div>
                  <CardDescription>{call.phone} • Duration: {call.duration}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Persona & Sentiment */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{call.currentPersona}</Badge>
                      {call.currentPersona !== call.persona && (
                        <span className="text-xs text-muted-foreground">
                          (switched from {call.persona})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Sentiment:</span>
                      <Badge variant={
                        call.sentiment === 'positive' ? 'default' :
                        call.sentiment === 'negative' ? 'destructive' :
                        'secondary'
                      } className="gap-1">
                        {call.sentimentTrend === 'improving' && <ArrowUpRight className="h-3 w-3" />}
                        {call.sentimentTrend === 'declining' && <ArrowDownRight className="h-3 w-3" />}
                        {call.sentiment}
                      </Badge>
                    </div>
                  </div>

                  {/* Live Transcript */}
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <div className="flex items-center gap-2 mb-2">
                      <Mic className="h-4 w-4 text-primary animate-pulse" />
                      <span className="text-xs font-medium">Live Transcript</span>
                    </div>
                    <p className="text-sm italic">"{call.transcript}"</p>
                  </div>

                  {/* AI Prediction */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded bg-primary/5 text-center">
                      <p className="text-xs text-muted-foreground">Order Likelihood</p>
                      <p className="text-lg font-bold text-primary">{call.prediction.orderLikely}%</p>
                    </div>
                    <div className="p-2 rounded bg-primary/5 text-center">
                      <p className="text-xs text-muted-foreground">Follow-up Needed</p>
                      <p className="text-lg font-bold">{call.prediction.followUpNeeded ? 'Yes' : 'No'}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 gap-1">
                      <Volume2 className="h-4 w-4" />
                      Listen
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 gap-1">
                      <Radio className="h-4 w-4" />
                      Whisper
                    </Button>
                    <Button size="sm" className="flex-1 gap-1">
                      <UserCheck className="h-4 w-4" />
                      Join Call
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {mockActiveCalls.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Phone className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">No active calls at the moment</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        {/* OPTIMIZATION TAB */}
        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="optimization" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Best Time Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Answer Rate by Day
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockOptimizationData.answerRateByDay.map((item) => (
                    <div key={item.day} className="flex items-center gap-3">
                      <span className="w-10 text-sm font-medium">{item.day}</span>
                      <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all"
                          style={{ width: `${item.rate}%` }}
                        />
                      </div>
                      <span className="w-12 text-sm text-right">{item.rate}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Conversion by Segment */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Conversion by Segment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockOptimizationData.conversionBySegment.map((item) => (
                    <div key={item.segment} className="flex items-center gap-3">
                      <span className="w-24 text-sm font-medium truncate">{item.segment}</span>
                      <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                        <div 
                          className={`h-full transition-all ${
                            item.rate >= 50 ? 'bg-green-500' :
                            item.rate >= 30 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${item.rate}%` }}
                        />
                      </div>
                      <span className="w-12 text-sm text-right">{item.rate}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* AI Learnings */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  What AI Learned This Week
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {mockOptimizationData.weeklyInsights.map((insight, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
                      <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <p className="text-sm">{insight}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Performers */}
            <Card>
              <CardHeader>
                <CardTitle>Best Performing Personas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2 rounded bg-primary/10">
                    <span className="font-medium">Friendly Helper</span>
                    <Badge>68% conversion</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-muted">
                    <span className="font-medium">Sales Pro</span>
                    <Badge variant="secondary">54% conversion</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-muted">
                    <span className="font-medium">Empathetic</span>
                    <Badge variant="secondary">48% conversion</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Best Scripts */}
            <Card>
              <CardHeader>
                <CardTitle>Best Performing Scripts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2 rounded bg-primary/10">
                    <span className="font-medium">Reactivation Flow v2</span>
                    <Badge>72% success</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-muted">
                    <span className="font-medium">New Product Intro</span>
                    <Badge variant="secondary">61% success</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-muted">
                    <span className="font-medium">General Check-in</span>
                    <Badge variant="secondary">45% success</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        {/* SETTINGS TAB */}
        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="settings" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Campaign Behavior */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-primary" />
                  Campaign Behavior
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Max Concurrent Calls</Label>
                  <Select value={throttle} onValueChange={setThrottle}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 call</SelectItem>
                      <SelectItem value="5">5 calls</SelectItem>
                      <SelectItem value="10">10 calls</SelectItem>
                      <SelectItem value="20">20 calls</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Dynamic Persona Switching</Label>
                    <p className="text-xs text-muted-foreground">AI adapts persona based on customer mood</p>
                  </div>
                  <Switch checked={enablePersonaSwitching} onCheckedChange={setEnablePersonaSwitching} />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Sentiment Adaptation</Label>
                    <p className="text-xs text-muted-foreground">AI adjusts tone in real-time</p>
                  </div>
                  <Switch checked={enableSentimentAdaptation} onCheckedChange={setEnableSentimentAdaptation} />
                </div>
              </CardContent>
            </Card>

            {/* Multi-Call Sequence */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-primary" />
                  Multi-Call Sequence
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable Multi-Step Sequence</Label>
                  <Switch checked={enableSequence} onCheckedChange={setEnableSequence} />
                </div>

                {enableSequence && (
                  <div className="space-y-3 pt-2">
                    <div className="space-y-2">
                      <Label className="text-sm">Day 1 Flow</Label>
                      <Select value={day1Flow} onValueChange={setDay1Flow}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select flow" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="main">Main Outreach</SelectItem>
                          <SelectItem value="reactivation">Reactivation</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Day 3 Flow (if no answer)</Label>
                      <Select value={day3Flow} onValueChange={setDay3Flow}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select flow" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="followup">Follow-up</SelectItem>
                          <SelectItem value="reminder">Reminder</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Day 7 Flow (final attempt)</Label>
                      <Select value={day7Flow} onValueChange={setDay7Flow}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select flow" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="final">Final Attempt</SelectItem>
                          <SelectItem value="winback">Win-Back</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Auto Follow-up SMS */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Auto Follow-up SMS
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Auto Follow-up Text</Label>
                    <p className="text-xs text-muted-foreground">Send SMS immediately after each call</p>
                  </div>
                  <Switch checked={enableFollowUp} onCheckedChange={setEnableFollowUp} />
                </div>

                {enableFollowUp && (
                  <div className="space-y-2">
                    <Label>Follow-up Template</Label>
                    <Textarea
                      value={followUpTemplate}
                      onChange={(e) => setFollowUpTemplate(e.target.value)}
                      placeholder="Enter follow-up message template..."
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      Variables: {'{first_name}'}, {'{store_name}'}, {'{order_link}'}, {'{brand}'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button className="gap-2">
              <Shield className="h-4 w-4" />
              Save Settings
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
