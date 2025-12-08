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
import { Slider } from "@/components/ui/slider";
import { 
  Phone, Play, Pause, Square, Users, CheckCircle, Voicemail, XCircle, 
  RefreshCw, Headphones, Volume2, Clock, Zap, Target, BarChart3, 
  Brain, TrendingUp, TrendingDown, AlertTriangle, Sparkles, Settings,
  ArrowUpRight, ArrowDownRight, Calendar, MessageSquare, UserCheck,
  Activity, Mic, Radio, Shield, LineChart, FlaskConical, Lightbulb,
  ShieldCheck, Eye, Beaker
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Mock data for V3 Predictions
const mockPredictions = [
  { id: "1", storeName: "Mike's Corner Store", answerProb: 0.82, orderProb: 0.65, churnRisk: 0.15, complaintRisk: 0.08, suggestedPersona: "Friendly Sales", suggestedFlow: "Upsell Flow v2", bestWindow: "10am-12pm", experimentGroup: "variant_a" },
  { id: "2", storeName: "Downtown Liquor", answerProb: 0.45, orderProb: 0.22, churnRisk: 0.78, complaintRisk: 0.35, suggestedPersona: "Retention Calm", suggestedFlow: "Win-Back Flow", bestWindow: "2pm-4pm", experimentGroup: "control" },
  { id: "3", storeName: "Quick Mart #42", answerProb: 0.91, orderProb: 0.88, churnRisk: 0.05, complaintRisk: 0.02, suggestedPersona: "Hype Sales", suggestedFlow: "VIP Upsell", bestWindow: "9am-11am", experimentGroup: "variant_b" },
  { id: "4", storeName: "Sam's Tobacco", answerProb: 0.67, orderProb: 0.41, churnRisk: 0.45, complaintRisk: 0.12, suggestedPersona: "Professional", suggestedFlow: "Check-in Flow", bestWindow: "11am-1pm", experimentGroup: "control" },
  { id: "5", storeName: "City Smoke Shop", answerProb: 0.38, orderProb: 0.15, churnRisk: 0.89, complaintRisk: 0.55, suggestedPersona: "Empathetic Support", suggestedFlow: "Recovery Flow", bestWindow: "3pm-5pm", experimentGroup: "variant_a" },
];

const mockExperimentResults = [
  { variant: "Control", persona: "Standard Flow", calls: 150, answered: 89, orders: 34, complaints: 3, sentiment: 0.72 },
  { variant: "Variant A", persona: "Friendly Sales + Upsell", calls: 75, answered: 52, orders: 24, complaints: 1, sentiment: 0.81 },
  { variant: "Variant B", persona: "Retention Calm + Win-Back", calls: 75, answered: 48, orders: 19, complaints: 2, sentiment: 0.78 },
];

const mockAILearnings = [
  { insight: "Flow 'Retention Calm' + Persona 'Empathetic Support' works best for high-churn stores", impact: "high", metric: "+23% retention" },
  { insight: "Best call window for dead stores is 2pm-4pm on Tuesdays", impact: "medium", metric: "+15% answer rate" },
  { insight: "Persona 'Hype Sales' underperforms for stores with previous complaints", impact: "high", metric: "Avoid" },
  { insight: "Multi-step sequences (Day 1 + Day 3) increase order probability by 31%", impact: "high", metric: "+31% orders" },
  { insight: "Personalized opening lines mentioning last order increase engagement by 42%", impact: "medium", metric: "+42% engagement" },
];

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
    prediction: { orderLikely: 72, followUpNeeded: true },
    generatedScript: {
      opening: "Good morning! I noticed you haven't ordered in a while and wanted to check in personally.",
      offer: "We have some new Grabba varieties that your customers have been asking about.",
      closing: "Can I set up a quick order for you today?"
    }
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
    prediction: { orderLikely: 89, followUpNeeded: false },
    generatedScript: {
      opening: "Hi! Great to hear from you again. Your last order was fantastic.",
      offer: "Based on your usual orders, I think you'd love our new Hot Mama bundle.",
      closing: "Should I add that to your regular order?"
    }
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
  const { toast } = useToast();
  const [campaignName, setCampaignName] = useState("");
  const [selectedPersona, setSelectedPersona] = useState("");
  const [selectedFlow, setSelectedFlow] = useState("");
  const [selectedSegment, setSelectedSegment] = useState("");
  const [priorityMode, setPriorityMode] = useState("predictive");
  const [predictiveGoal, setPredictiveGoal] = useState("max_orders");
  const [throttle, setThrottle] = useState("5");
  const [enableSequence, setEnableSequence] = useState(false);
  const [enableFollowUp, setEnableFollowUp] = useState(true);
  const [enablePersonaSwitching, setEnablePersonaSwitching] = useState(true);
  const [enableSentimentAdaptation, setEnableSentimentAdaptation] = useState(true);
  const [experimentMode, setExperimentMode] = useState(false);
  const [maxAggression, setMaxAggression] = useState("medium");
  const [sensitivityMode, setSensitivityMode] = useState(false);
  const [experimentSplit, setExperimentSplit] = useState({ control: 50, variantA: 25, variantB: 25 });
  const [selectedPrediction, setSelectedPrediction] = useState<typeof mockPredictions[0] | null>(null);
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

  const getRiskColor = (risk: number) => {
    if (risk < 0.3) return "text-green-500";
    if (risk < 0.6) return "text-yellow-500";
    return "text-red-500";
  };

  const getProbColor = (prob: number) => {
    if (prob > 0.7) return "text-green-500";
    if (prob > 0.4) return "text-yellow-500";
    return "text-red-500";
  };

  const handleLaunchCampaign = () => {
    toast({
      title: "Predictive Campaign Launched",
      description: `AI V3 campaign "${campaignName || 'New Campaign'}" is now running with ${experimentMode ? 'experiment mode' : 'standard mode'}.`,
    });
  };

  return (
    <div className="w-full min-h-full flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            AI Auto Dialer
            <Badge variant="secondary" className="ml-2">V3 Predictive</Badge>
          </h1>
          <p className="text-muted-foreground">Self-optimizing AI with predictive targeting, A/B testing & reinforcement learning</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            {mockActiveCalls.length} Active Calls
          </Badge>
          <Badge variant="outline" className="gap-1 text-primary">
            <FlaskConical className="h-3 w-3" />
            Experiment Active
          </Badge>
          <Badge variant="outline" className="gap-1 text-purple-600">
            <Brain className="h-3 w-3" />
            AI Learning
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full max-w-3xl grid-cols-6">
          <TabsTrigger value="overview" className="gap-1">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="predictions" className="gap-1">
            <Brain className="h-4 w-4" />
            Predictions
          </TabsTrigger>
          <TabsTrigger value="targeting" className="gap-1">
            <Target className="h-4 w-4" />
            Targeting
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
            {/* Campaign Creator V3 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Predictive Campaign Launch
                </CardTitle>
                <CardDescription>AI predicts outcomes and optimizes in real-time</CardDescription>
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
                    <Label>Predictive Goal</Label>
                    <Select value={predictiveGoal} onValueChange={setPredictiveGoal}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="max_orders">📈 Maximize Orders</SelectItem>
                        <SelectItem value="reduce_churn">🛡️ Reduce Churn</SelectItem>
                        <SelectItem value="reawaken_dead">🔄 Reawaken Dead Stores</SelectItem>
                        <SelectItem value="collect_feedback">📝 Collect Feedback</SelectItem>
                        <SelectItem value="predictive">🧠 AI Best Outcome</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Default Persona</Label>
                    <Select value={selectedPersona} onValueChange={setSelectedPersona}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select persona" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="friendly">Friendly Sales</SelectItem>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="retention">Retention Calm</SelectItem>
                        <SelectItem value="hype">Hype Sales</SelectItem>
                        <SelectItem value="empathetic">Empathetic Support</SelectItem>
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
                        <SelectItem value="at-risk">At Risk (High Churn)</SelectItem>
                        <SelectItem value="high-value">High Value</SelectItem>
                        <SelectItem value="new">New Stores</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Experiment Mode Toggle */}
                <Card className="border-dashed border-purple-500/50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FlaskConical className="h-4 w-4 text-purple-500" />
                        Experiment Mode (A/B Testing)
                      </CardTitle>
                      <Switch checked={experimentMode} onCheckedChange={setExperimentMode} />
                    </div>
                  </CardHeader>
                  {experimentMode && (
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        AI will test different flows/personas and learn what works best
                      </p>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Control Flow</Label>
                          <Select>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Standard" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="standard">Standard Flow</SelectItem>
                              <SelectItem value="upsell">Upsell Flow</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Variant A</Label>
                          <Select>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="retention">Retention Flow</SelectItem>
                              <SelectItem value="winback">Win-Back Flow</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Variant B</Label>
                          <Select>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="vip">VIP Upsell</SelectItem>
                              <SelectItem value="checkin">Check-in Flow</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Traffic Split</Label>
                        <div className="flex h-3 rounded-full overflow-hidden mt-2">
                          <div className="bg-blue-500" style={{ width: `${experimentSplit.control}%` }} />
                          <div className="bg-green-500" style={{ width: `${experimentSplit.variantA}%` }} />
                          <div className="bg-purple-500" style={{ width: `${experimentSplit.variantB}%` }} />
                        </div>
                        <div className="flex justify-between text-xs mt-1 text-muted-foreground">
                          <span>Control: {experimentSplit.control}%</span>
                          <span>A: {experimentSplit.variantA}%</span>
                          <span>B: {experimentSplit.variantB}%</span>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>

                <div className="flex gap-2 pt-2">
                  <Button className="flex-1 gap-2" onClick={handleLaunchCampaign}>
                    <Play className="h-4 w-4" />
                    Launch Predictive Campaign
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
                  <Lightbulb className="h-5 w-5 text-yellow-500" />
                  AI Learning Insights
                </CardTitle>
                <CardDescription>What AI learned this week</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {mockAILearnings.slice(0, 4).map((learning, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
                    <Badge variant={learning.impact === "high" ? "default" : "secondary"} className="mt-0.5">
                      {learning.impact}
                    </Badge>
                    <div className="flex-1">
                      <p className="text-sm">{learning.insight}</p>
                    </div>
                    <Badge variant="outline" className={learning.metric === "Avoid" ? "text-red-500" : "text-green-500"}>
                      {learning.metric}
                    </Badge>
                  </div>
                ))}
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
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="gap-1">
                    <FlaskConical className="h-3 w-3" />
                    A/B Test Active
                  </Badge>
                  <Badge variant="default" className="gap-1">
                    <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                    Running
                  </Badge>
                </div>
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
        {/* PREDICTIONS TAB (NEW V3) */}
        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="predictions" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Prediction List */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-primary" />
                    Store Predictions (AI Ranked)
                  </CardTitle>
                  <CardDescription>Click a store to see detailed prediction and pre-call insights</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 mb-4">
                    <Button size="sm" className="gap-1">
                      <RefreshCw className="h-4 w-4" />
                      Refresh Predictions
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1">
                      <Eye className="h-4 w-4" />
                      Top 20 to Call Now
                    </Button>
                  </div>
                  <ScrollArea className="h-[450px]">
                    <div className="space-y-2">
                      {mockPredictions.map((pred) => (
                        <div 
                          key={pred.id}
                          onClick={() => setSelectedPrediction(pred)}
                          className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                            selectedPrediction?.id === pred.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{pred.storeName}</p>
                                <Badge variant="outline" className="text-xs">
                                  {pred.experimentGroup === "control" ? "Control" : pred.experimentGroup === "variant_a" ? "Variant A" : "Variant B"}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Best: {pred.bestWindow} • {pred.suggestedPersona}
                              </p>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <div className="text-center">
                                <p className={`font-bold ${getProbColor(pred.answerProb)}`}>
                                  {Math.round(pred.answerProb * 100)}%
                                </p>
                                <p className="text-xs text-muted-foreground">Answer</p>
                              </div>
                              <div className="text-center">
                                <p className={`font-bold ${getProbColor(pred.orderProb)}`}>
                                  {Math.round(pred.orderProb * 100)}%
                                </p>
                                <p className="text-xs text-muted-foreground">Order</p>
                              </div>
                              <div className="text-center">
                                <p className={`font-bold ${getRiskColor(pred.churnRisk)}`}>
                                  {Math.round(pred.churnRisk * 100)}%
                                </p>
                                <p className="text-xs text-muted-foreground">Churn</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Prediction Detail Panel */}
            <div>
              <Card className="sticky top-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Expected Outcome
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedPrediction ? (
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-bold text-lg">{selectedPrediction.storeName}</h3>
                        <p className="text-sm text-muted-foreground">Pre-call prediction snapshot</p>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Answer Probability</span>
                            <span className={getProbColor(selectedPrediction.answerProb)}>
                              {Math.round(selectedPrediction.answerProb * 100)}%
                            </span>
                          </div>
                          <Progress value={selectedPrediction.answerProb * 100} className="h-2" />
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Order Probability</span>
                            <span className={getProbColor(selectedPrediction.orderProb)}>
                              {Math.round(selectedPrediction.orderProb * 100)}%
                            </span>
                          </div>
                          <Progress value={selectedPrediction.orderProb * 100} className="h-2" />
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Churn Risk</span>
                            <span className={getRiskColor(selectedPrediction.churnRisk)}>
                              {Math.round(selectedPrediction.churnRisk * 100)}%
                            </span>
                          </div>
                          <Progress value={selectedPrediction.churnRisk * 100} className="h-2 [&>div]:bg-red-500" />
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Complaint Risk</span>
                            <span className={getRiskColor(selectedPrediction.complaintRisk)}>
                              {Math.round(selectedPrediction.complaintRisk * 100)}%
                            </span>
                          </div>
                          <Progress value={selectedPrediction.complaintRisk * 100} className="h-2 [&>div]:bg-orange-500" />
                        </div>
                      </div>

                      <div className="pt-4 border-t space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Suggested Persona</span>
                          <Badge>{selectedPrediction.suggestedPersona}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Suggested Flow</span>
                          <Badge variant="outline">{selectedPrediction.suggestedFlow}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Best Call Window</span>
                          <span className="text-sm font-medium">{selectedPrediction.bestWindow}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Experiment Group</span>
                          <Badge variant="secondary">{selectedPrediction.experimentGroup}</Badge>
                        </div>
                      </div>

                      <Button className="w-full gap-2">
                        <Phone className="h-4 w-4" />
                        Call Now with AI
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p className="text-muted-foreground">Select a store to see prediction details</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Prediction Distribution Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Order Probability Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-20 text-sm">High (70%+)</span>
                    <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                      <div className="h-full bg-green-500" style={{ width: "35%" }} />
                    </div>
                    <span className="w-12 text-sm text-right">35 stores</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-20 text-sm">Medium</span>
                    <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                      <div className="h-full bg-yellow-500" style={{ width: "45%" }} />
                    </div>
                    <span className="w-12 text-sm text-right">45 stores</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-20 text-sm">Low (&lt;40%)</span>
                    <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                      <div className="h-full bg-red-500" style={{ width: "20%" }} />
                    </div>
                    <span className="w-12 text-sm text-right">20 stores</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Churn Risk Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-20 text-sm">High Risk</span>
                    <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                      <div className="h-full bg-red-500" style={{ width: "25%" }} />
                    </div>
                    <span className="w-12 text-sm text-right">25 stores</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-20 text-sm">Medium</span>
                    <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                      <div className="h-full bg-yellow-500" style={{ width: "40%" }} />
                    </div>
                    <span className="w-12 text-sm text-right">40 stores</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-20 text-sm">Low Risk</span>
                    <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                      <div className="h-full bg-green-500" style={{ width: "35%" }} />
                    </div>
                    <span className="w-12 text-sm text-right">35 stores</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
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
                              store.priority >= 90 ? "bg-red-500 text-white" :
                              store.priority >= 80 ? "bg-orange-500 text-white" :
                              store.priority >= 70 ? "bg-yellow-500 text-black" :
                              "bg-muted text-muted-foreground"
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
                            <span className={store.risk >= 70 ? "text-red-600" : "text-green-600"}>{store.risk}</span>
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
                            store.status === "completed" ? "secondary" :
                            store.status === "calling" ? "default" :
                            "outline"
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
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-2xl font-bold">{mockActiveCalls.length}</span>
                </div>
                <p className="text-xs text-muted-foreground">Active Calls</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">18</div>
                <p className="text-xs text-muted-foreground">In Queue</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-500">89</div>
                <p className="text-xs text-muted-foreground">Completed Today</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">3:42</div>
                <p className="text-xs text-muted-foreground">Avg Duration</p>
              </CardContent>
            </Card>
          </div>

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
                        call.sentiment === "positive" ? "default" :
                        call.sentiment === "negative" ? "destructive" :
                        "secondary"
                      } className="gap-1">
                        {call.sentimentTrend === "improving" && <ArrowUpRight className="h-3 w-3" />}
                        {call.sentimentTrend === "declining" && <ArrowDownRight className="h-3 w-3" />}
                        {call.sentiment}
                      </Badge>
                    </div>
                  </div>

                  {/* AI Generated Script Preview */}
                  <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="h-4 w-4 text-purple-500" />
                      <span className="text-xs font-medium">AI Generated Script</span>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p><strong>Opening:</strong> {call.generatedScript.opening}</p>
                      <p><strong>Offer:</strong> {call.generatedScript.offer}</p>
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
                      <p className="text-lg font-bold">{call.prediction.followUpNeeded ? "Yes" : "No"}</p>
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
          {/* Experiment Results */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-purple-500" />
                A/B Test Results
              </CardTitle>
              <CardDescription>Current experiment performance comparison</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockExperimentResults.map((result, i) => (
                  <div key={i} className="p-4 rounded-lg border">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Badge variant={i === 1 ? "default" : "outline"}>{result.variant}</Badge>
                        <span className="text-sm text-muted-foreground">{result.persona}</span>
                      </div>
                      {i === 1 && <Badge className="bg-green-500">Best Performer</Badge>}
                    </div>
                    <div className="grid grid-cols-5 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold">{result.calls}</p>
                        <p className="text-xs text-muted-foreground">Calls</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{Math.round((result.answered / result.calls) * 100)}%</p>
                        <p className="text-xs text-muted-foreground">Answer Rate</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-500">{result.orders}</p>
                        <p className="text-xs text-muted-foreground">Orders</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-red-500">{result.complaints}</p>
                        <p className="text-xs text-muted-foreground">Complaints</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{Math.round(result.sentiment * 100)}%</p>
                        <p className="text-xs text-muted-foreground">Sentiment</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

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
                            item.rate >= 50 ? "bg-green-500" :
                            item.rate >= 30 ? "bg-yellow-500" :
                            "bg-red-500"
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
          </div>

          {/* AI Learnings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                What AI Learned This Week
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {mockAILearnings.map((learning, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
                    <TrendingUp className={`h-5 w-5 flex-shrink-0 mt-0.5 ${learning.impact === "high" ? "text-green-500" : "text-blue-500"}`} />
                    <div className="flex-1">
                      <p className="text-sm">{learning.insight}</p>
                    </div>
                    <Badge variant="outline" className={learning.metric === "Avoid" ? "text-red-500" : "text-green-500"}>
                      {learning.metric}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top Performers */}
            <Card>
              <CardHeader>
                <CardTitle>Best Performing Personas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2 rounded bg-primary/10">
                    <span className="font-medium">Friendly Sales</span>
                    <Badge>68% conversion</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-muted">
                    <span className="font-medium">Retention Calm</span>
                    <Badge variant="secondary">54% conversion</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-muted">
                    <span className="font-medium">Empathetic Support</span>
                    <Badge variant="secondary">48% conversion</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Best Scripts */}
            <Card>
              <CardHeader>
                <CardTitle>Best Performing Flows</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2 rounded bg-primary/10">
                    <span className="font-medium">Win-Back Flow</span>
                    <Badge>72% success</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-muted">
                    <span className="font-medium">VIP Upsell</span>
                    <Badge variant="secondary">61% success</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-muted">
                    <span className="font-medium">Check-in Flow</span>
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
            {/* AI Behavior */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  AI Behavior Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto Follow-up SMS</Label>
                    <p className="text-xs text-muted-foreground">Send text after every call</p>
                  </div>
                  <Switch checked={enableFollowUp} onCheckedChange={setEnableFollowUp} />
                </div>
              </CardContent>
            </Card>

            {/* Guardrails & Compliance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Guardrails & Compliance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Max Aggression Level</Label>
                  <Select value={maxAggression} onValueChange={setMaxAggression}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low (Soft approach)</SelectItem>
                      <SelectItem value="medium">Medium (Balanced)</SelectItem>
                      <SelectItem value="high">High (Assertive)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Sensitivity Mode</Label>
                    <p className="text-xs text-muted-foreground">Avoid strong sales pushes</p>
                  </div>
                  <Switch checked={sensitivityMode} onCheckedChange={setSensitivityMode} />
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    AI will NOT:
                  </p>
                  <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                    <li>• Overpromise or make false claims</li>
                    <li>• Discuss unauthorized discounts</li>
                    <li>• Use inappropriate language</li>
                    <li>• Pressure after 2 "no" responses</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Call Throttling */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-primary" />
                  Call Throttling
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
                      <SelectItem value="50">50 calls</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Retry Window (hours)</Label>
                  <Slider defaultValue={[24]} max={72} step={1} />
                  <p className="text-xs text-muted-foreground">Wait 24 hours before retry</p>
                </div>
              </CardContent>
            </Card>

            {/* Multi-Call Sequence */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Multi-Step Sequences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Multi-Call Sequence</Label>
                    <p className="text-xs text-muted-foreground">Day 1 → Day 3 → Day 7 flows</p>
                  </div>
                  <Switch checked={enableSequence} onCheckedChange={setEnableSequence} />
                </div>

                {enableSequence && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Day 1 Flow</Label>
                      <Select value={day1Flow} onValueChange={setDay1Flow}>
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Select flow" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="main">Main Outreach</SelectItem>
                          <SelectItem value="intro">Introduction Flow</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Day 3 Flow (if no answer)</Label>
                      <Select value={day3Flow} onValueChange={setDay3Flow}>
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Select flow" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="followup">Follow-up Flow</SelectItem>
                          <SelectItem value="urgent">Urgent Check-in</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Day 7 Flow (final attempt)</Label>
                      <Select value={day7Flow} onValueChange={setDay7Flow}>
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Select flow" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="final">Final Attempt</SelectItem>
                          <SelectItem value="winback">Win-Back Special</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Follow-up SMS Template */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Auto Follow-up SMS Template
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={followUpTemplate}
                  onChange={(e) => setFollowUpTemplate(e.target.value)}
                  placeholder="Enter follow-up SMS template..."
                  className="min-h-[100px]"
                />
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{"{store_name}"}</Badge>
                  <Badge variant="outline">{"{order_link}"}</Badge>
                  <Badge variant="outline">{"{last_product}"}</Badge>
                  <Badge variant="outline">{"{discount_code}"}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}