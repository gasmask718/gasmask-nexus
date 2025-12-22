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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { 
  Phone, Play, Pause, Square, CheckCircle, 
  RefreshCw, Headphones, Volume2, Clock, Zap, Target, BarChart3, 
  Brain, TrendingUp, TrendingDown, AlertTriangle, Sparkles, Settings,
  ArrowUpRight, ArrowDownRight, Calendar, MessageSquare, UserCheck,
  Activity, Mic, Radio, LineChart, FlaskConical, Lightbulb,
  ShieldCheck, Eye, Send, Users, Smartphone, PhoneCall, Mail, Building2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useBusinessStore } from "@/stores/businessStore";
import { BusinessCampaignFilters } from "@/components/communication/BusinessCampaignFilters";

// Mock unified predictions data
const mockPredictions = [
  { id: "1", storeName: "Mike's Corner Store", phone: "+1 555-0123", answerProb: 0.82, textReplyProb: 0.68, orderProb: 0.65, churnRisk: 0.15, recommendedChannel: "call", persona: "Friendly Sales", bestWindow: "10am-12pm", experimentGroup: "variant_a" },
  { id: "2", storeName: "Downtown Liquor", phone: "+1 555-0234", answerProb: 0.45, textReplyProb: 0.72, orderProb: 0.42, churnRisk: 0.78, recommendedChannel: "sms", persona: "Retention Calm", bestWindow: "2pm-4pm", experimentGroup: "control" },
  { id: "3", storeName: "Quick Mart #42", phone: "+1 555-0345", answerProb: 0.91, textReplyProb: 0.55, orderProb: 0.88, churnRisk: 0.05, recommendedChannel: "call", persona: "Hype Sales", bestWindow: "9am-11am", experimentGroup: "variant_b" },
  { id: "4", storeName: "Sam's Tobacco", phone: "+1 555-0456", answerProb: 0.67, textReplyProb: 0.81, orderProb: 0.51, churnRisk: 0.45, recommendedChannel: "mixed", persona: "Professional", bestWindow: "11am-1pm", experimentGroup: "control" },
  { id: "5", storeName: "City Smoke Shop", phone: "+1 555-0567", answerProb: 0.38, textReplyProb: 0.62, orderProb: 0.25, churnRisk: 0.89, recommendedChannel: "sms", persona: "Empathetic Support", bestWindow: "3pm-5pm", experimentGroup: "variant_a" },
  { id: "6", storeName: "Gas N Go Express", phone: "+1 555-0678", answerProb: 0.75, textReplyProb: 0.45, orderProb: 0.72, churnRisk: 0.22, recommendedChannel: "call", persona: "Friendly Sales", bestWindow: "10am-11am", experimentGroup: "variant_b" },
];

const mockExperimentResults = [
  { variant: "Control", channel: "mixed", calls: 150, sms: 200, answered: 89, replies: 142, orders: 54, sentiment: 0.72 },
  { variant: "Variant A", channel: "sms-heavy", calls: 50, sms: 250, answered: 32, replies: 185, orders: 48, sentiment: 0.81 },
  { variant: "Variant B", channel: "call-heavy", calls: 200, sms: 100, answered: 145, replies: 72, orders: 61, sentiment: 0.78 },
];

const mockAILearnings = [
  { insight: "SMS performs 34% better than calls for stores with churn risk > 60%", impact: "high", metric: "+34% response" },
  { insight: "Calling between 10-11am yields highest order conversion", impact: "high", metric: "+28% orders" },
  { insight: "Personalized opening lines increase engagement by 42%", impact: "medium", metric: "+42% engagement" },
  { insight: "Multi-step sequences (Day 1 SMS → Day 3 Call) outperform single-channel", impact: "high", metric: "+51% conversion" },
  { insight: "Stores that replied to SMS are 3x more likely to answer follow-up calls", impact: "high", metric: "3x likelihood" },
];

const mockLiveCalls = [
  { id: "1", storeName: "Quick Mart #42", phone: "+1 555-0123", duration: "2:34", persona: "Calm Professional", sentiment: "positive", transcript: "...yes, I understand. We have some new products..." },
  { id: "2", storeName: "Gas N Go", phone: "+1 555-0456", duration: "1:12", persona: "Friendly Sales", sentiment: "neutral", transcript: "That sounds great! When can I expect delivery?" },
];

const mockLiveTexts = [
  { id: "1", storeName: "City Smoke Shop", phone: "+1 555-0789", lastMessage: "What's the price on the new Grabba?", sentiment: "interested", status: "awaiting_reply", aiSuggestion: "Send pricing sheet + promo code" },
  { id: "2", storeName: "Downtown Liquor", phone: "+1 555-0321", lastMessage: "Not right now, maybe next week", sentiment: "neutral", status: "scheduled_followup", aiSuggestion: "Schedule Day 3 check-in" },
  { id: "3", storeName: "Sam's Tobacco", phone: "+1 555-0654", lastMessage: "Yes! Send me the order link", sentiment: "positive", status: "converting", aiSuggestion: "Send order form link immediately" },
];

// Mock phone numbers for the selected business
const mockPhoneNumbers = [
  { id: 'phone-1', number: '+1 (555) 123-4567', label: 'Main Line', type: 'both' },
  { id: 'phone-2', number: '+1 (555) 234-5678', label: 'Reactivation', type: 'call' },
  { id: 'phone-3', number: '+1 (555) 345-6789', label: 'Promo Texts', type: 'sms' },
];

export default function OutboundEnginePage() {
  const { toast } = useToast();
  const { selectedBusiness } = useBusinessStore();
  const [activeTab, setActiveTab] = useState("overview");
  const [campaignName, setCampaignName] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("mixed");
  const [predictiveGoal, setPredictiveGoal] = useState("max_orders");
  const [experimentMode, setExperimentMode] = useState(false);
  const [selectedPrediction, setSelectedPrediction] = useState<typeof mockPredictions[0] | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState("all");
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState("all");
  const [callNumberId, setCallNumberId] = useState("");
  const [smsNumberId, setSmsNumberId] = useState("");
  const [isRefreshingPredictions, setIsRefreshingPredictions] = useState(false);
  const [highPriorityOnly, setHighPriorityOnly] = useState(false);

  // Filter predictions based on high priority toggle (churn risk > 0.5 or order prob > 0.6)
  const filteredPredictions = highPriorityOnly 
    ? mockPredictions.filter(p => p.churnRisk > 0.5 || p.orderProb > 0.6)
    : mockPredictions;

  const handleRefreshPredictions = async () => {
    setIsRefreshingPredictions(true);
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsRefreshingPredictions(false);
    toast({
      title: "Predictions Refreshed",
      description: `Updated ${mockPredictions.length} store predictions with latest AI analysis.`,
    });
  };

  const handleToggleHighPriority = () => {
    const newValue = !highPriorityOnly;
    setHighPriorityOnly(newValue);
    toast({
      title: newValue ? "Showing High Priority Only" : "Showing All Predictions",
      description: newValue 
        ? `Filtered to ${mockPredictions.filter(p => p.churnRisk > 0.5 || p.orderProb > 0.6).length} high-priority stores`
        : `Showing all ${mockPredictions.length} stores`,
    });
  };

  const stats = {
    totalCalls: 245,
    totalSMS: 412,
    callAnswerRate: 68,
    smsReplyRate: 52,
    conversions: 87,
    atRisk: 34,
    storesSaved: 18,
    bestChannel: "SMS",
    bestPersona: "Friendly Sales",
    bestTime: "10:30 AM",
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

  const getChannelIcon = (channel: string) => {
    if (channel === "call") return <PhoneCall className="h-4 w-4" />;
    if (channel === "sms") return <MessageSquare className="h-4 w-4" />;
    return <Smartphone className="h-4 w-4" />;
  };

  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");

  const handleLaunchCampaign = () => {
    toast({
      title: "Unified Campaign Launched",
      description: `AI Outbound Engine V3 campaign "${campaignName || 'New Campaign'}" is now running across calls & SMS.`,
    });
  };

  const handleScheduleCampaign = () => {
    if (!scheduledDate || !scheduledTime) {
      toast({
        title: "Missing Schedule",
        description: "Please select both a date and time for the campaign.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Campaign Scheduled",
      description: `Campaign "${campaignName || 'New Campaign'}" scheduled for ${scheduledDate} at ${scheduledTime}.`,
    });
    setIsScheduleDialogOpen(false);
    setScheduledDate("");
    setScheduledTime("");
  };

  const handleCallStore = (prediction: typeof mockPredictions[0]) => {
    toast({
      title: "Initiating Call",
      description: `Calling ${prediction.storeName} at ${prediction.phone} with ${prediction.persona} persona...`,
    });
    // In a real implementation, this would trigger the AI dialer
  };

  const handleTextStore = (prediction: typeof mockPredictions[0]) => {
    toast({
      title: "Opening SMS Composer",
      description: `Preparing message for ${prediction.storeName} at ${prediction.phone}...`,
    });
    // In a real implementation, this would open the SMS composer modal
  };

  return (
    <div className="w-full min-h-full flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-7 w-7 text-primary" />
            AI Outbound Engine
            <Badge variant="secondary" className="ml-2">V3 Unified</Badge>
          </h1>
          <p className="text-muted-foreground">
            Multi-business, multi-phone, multi-campaign outbound intelligence
            {selectedBusiness && <span className="font-medium text-foreground ml-1">• {selectedBusiness.name}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Building2 className="h-3 w-3" />
            {selectedBusiness?.name || 'All Businesses'}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <PhoneCall className="h-3 w-3" />
            {mockLiveCalls.length} Live Calls
          </Badge>
          <Badge variant="outline" className="gap-1">
            <MessageSquare className="h-3 w-3" />
            {mockLiveTexts.length} Active Texts
          </Badge>
          <Badge variant="outline" className="gap-1 text-purple-600">
            <FlaskConical className="h-3 w-3" />
            Experiment Active
          </Badge>
        </div>
      </div>

      {/* Business/Campaign/Phone Filters */}
      <BusinessCampaignFilters
        selectedCampaign={selectedCampaign}
        onCampaignChange={setSelectedCampaign}
        selectedPhoneNumber={selectedPhoneNumber}
        onPhoneNumberChange={setSelectedPhoneNumber}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-4xl grid-cols-7">
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
          <TabsTrigger value="live-calls" className="gap-1">
            <PhoneCall className="h-4 w-4" />
            Live Calls
          </TabsTrigger>
          <TabsTrigger value="live-texts" className="gap-1">
            <MessageSquare className="h-4 w-4" />
            Live Texts
          </TabsTrigger>
          <TabsTrigger value="experiments" className="gap-1">
            <FlaskConical className="h-4 w-4" />
            Experiments
          </TabsTrigger>
          <TabsTrigger value="optimization" className="gap-1">
            <LineChart className="h-4 w-4" />
            Optimization
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
                    <p className="text-2xl font-bold">{stats.totalCalls}</p>
                  </div>
                  <PhoneCall className="h-8 w-8 text-blue-500/20" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Today's SMS</p>
                    <p className="text-2xl font-bold">{stats.totalSMS}</p>
                  </div>
                  <MessageSquare className="h-8 w-8 text-green-500/20" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Conversions</p>
                    <p className="text-2xl font-bold text-primary">{stats.conversions}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-primary/20" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Stores Saved</p>
                    <p className="text-2xl font-bold text-green-600">{stats.storesSaved}</p>
                  </div>
                  <ShieldCheck className="h-8 w-8 text-green-500/20" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">At Risk</p>
                    <p className="text-2xl font-bold text-orange-600">{stats.atRisk}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-orange-500/20" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Channel Performance */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <PhoneCall className="h-4 w-4" />
                  Voice Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Answer Rate</span>
                    <span className="font-bold text-green-500">{stats.callAnswerRate}%</span>
                  </div>
                  <Progress value={stats.callAnswerRate} className="h-2" />
                  <div className="grid grid-cols-2 gap-2 text-center text-sm">
                    <div className="p-2 rounded bg-muted">
                      <p className="font-bold">42</p>
                      <p className="text-xs text-muted-foreground">Orders</p>
                    </div>
                    <div className="p-2 rounded bg-muted">
                      <p className="font-bold">3:24</p>
                      <p className="text-xs text-muted-foreground">Avg Duration</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  SMS Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Reply Rate</span>
                    <span className="font-bold text-green-500">{stats.smsReplyRate}%</span>
                  </div>
                  <Progress value={stats.smsReplyRate} className="h-2" />
                  <div className="grid grid-cols-2 gap-2 text-center text-sm">
                    <div className="p-2 rounded bg-muted">
                      <p className="font-bold">45</p>
                      <p className="text-xs text-muted-foreground">Orders</p>
                    </div>
                    <div className="p-2 rounded bg-muted">
                      <p className="font-bold">214</p>
                      <p className="text-xs text-muted-foreground">Replies</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Campaign Creator */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Launch Unified Campaign
              </CardTitle>
              <CardDescription>AI predicts optimal channel (call vs SMS) per store</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Campaign Name</Label>
                  <Input
                    placeholder="e.g., Q1 Win-Back"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Channel Strategy</Label>
                  <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ai-optimal">🧠 AI Optimal (Per Store)</SelectItem>
                      <SelectItem value="mixed">📱 Mixed (Call + SMS)</SelectItem>
                      <SelectItem value="call-first">📞 Call First, SMS Fallback</SelectItem>
                      <SelectItem value="sms-first">💬 SMS First, Call Fallback</SelectItem>
                      <SelectItem value="call-only">📞 Calls Only</SelectItem>
                      <SelectItem value="sms-only">💬 SMS Only</SelectItem>
                    </SelectContent>
                  </Select>
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
                      <SelectItem value="reawaken">🔄 Reawaken Dead Stores</SelectItem>
                      <SelectItem value="engagement">💬 Maximize Engagement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Card className="border-dashed border-purple-500/50">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FlaskConical className="h-4 w-4 text-purple-500" />
                      Experiment Mode
                    </CardTitle>
                    <Switch checked={experimentMode} onCheckedChange={setExperimentMode} />
                  </div>
                </CardHeader>
                {experimentMode && (
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      AI will test different channel strategies and learn optimal approach
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-2 rounded bg-blue-500/10 text-center">
                        <p className="text-xs font-medium">Control</p>
                        <p className="text-xs text-muted-foreground">Current strategy</p>
                      </div>
                      <div className="p-2 rounded bg-green-500/10 text-center">
                        <p className="text-xs font-medium">Variant A</p>
                        <p className="text-xs text-muted-foreground">SMS-heavy</p>
                      </div>
                      <div className="p-2 rounded bg-purple-500/10 text-center">
                        <p className="text-xs font-medium">Variant B</p>
                        <p className="text-xs text-muted-foreground">Call-heavy</p>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>

              <div className="flex gap-2">
                <Button className="flex-1 gap-2" onClick={handleLaunchCampaign}>
                  <Play className="h-4 w-4" />
                  Launch Campaign
                </Button>
                <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <Calendar className="h-4 w-4" />
                      Schedule
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Schedule Campaign</DialogTitle>
                      <DialogDescription>
                        Set the date and time to launch "{campaignName || 'New Campaign'}"
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Date</Label>
                        <Input 
                          type="date" 
                          value={scheduledDate} 
                          onChange={(e) => setScheduledDate(e.target.value)} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Time</Label>
                        <Input 
                          type="time" 
                          value={scheduledTime} 
                          onChange={(e) => setScheduledTime(e.target.value)} 
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsScheduleDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleScheduleCampaign}>
                        <Calendar className="h-4 w-4 mr-2" />
                        Confirm Schedule
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
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
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {mockAILearnings.slice(0, 4).map((learning, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
                    <Badge variant={learning.impact === "high" ? "default" : "secondary"} className="mt-0.5">
                      {learning.impact}
                    </Badge>
                    <div className="flex-1">
                      <p className="text-sm">{learning.insight}</p>
                    </div>
                    <Badge variant="outline" className="text-green-500">
                      {learning.metric}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        {/* PREDICTIONS TAB */}
        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="predictions" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-primary" />
                    Store Predictions (AI Channel Recommendation)
                  </CardTitle>
                  <CardDescription>AI recommends call vs SMS based on predicted outcomes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 mb-4">
                    <Button 
                      size="sm" 
                      className="gap-1" 
                      onClick={handleRefreshPredictions}
                      disabled={isRefreshingPredictions}
                    >
                      <RefreshCw className={`h-4 w-4 ${isRefreshingPredictions ? 'animate-spin' : ''}`} />
                      {isRefreshingPredictions ? 'Refreshing...' : 'Refresh Predictions'}
                    </Button>
                    <Button 
                      size="sm" 
                      variant={highPriorityOnly ? "default" : "outline"} 
                      className="gap-1"
                      onClick={handleToggleHighPriority}
                    >
                      <Eye className="h-4 w-4" />
                      High Priority Only
                      {highPriorityOnly && <Badge variant="secondary" className="ml-1 h-5 px-1.5">{filteredPredictions.length}</Badge>}
                    </Button>
                  </div>
                  <ScrollArea className="h-[450px]">
                    <div className="space-y-2">
                      {filteredPredictions.map((pred) => (
                        <div 
                          key={pred.id}
                          onClick={() => setSelectedPrediction(pred)}
                          className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                            selectedPrediction?.id === pred.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-full ${
                                pred.recommendedChannel === "call" ? "bg-blue-500/10" :
                                pred.recommendedChannel === "sms" ? "bg-green-500/10" : "bg-purple-500/10"
                              }`}>
                                {getChannelIcon(pred.recommendedChannel)}
                              </div>
                              <div>
                                <p className="font-medium">{pred.storeName}</p>
                                <p className="text-sm text-muted-foreground">
                                  {pred.persona} • {pred.bestWindow}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <div className="text-center">
                                <p className={`font-bold ${getProbColor(pred.answerProb)}`}>
                                  {Math.round(pred.answerProb * 100)}%
                                </p>
                                <p className="text-xs text-muted-foreground">Call</p>
                              </div>
                              <div className="text-center">
                                <p className={`font-bold ${getProbColor(pred.textReplyProb)}`}>
                                  {Math.round(pred.textReplyProb * 100)}%
                                </p>
                                <p className="text-xs text-muted-foreground">SMS</p>
                              </div>
                              <div className="text-center">
                                <p className={`font-bold ${getProbColor(pred.orderProb)}`}>
                                  {Math.round(pred.orderProb * 100)}%
                                </p>
                                <p className="text-xs text-muted-foreground">Order</p>
                              </div>
                              <Badge variant={pred.recommendedChannel === "call" ? "default" : pred.recommendedChannel === "sms" ? "secondary" : "outline"}>
                                {pred.recommendedChannel.toUpperCase()}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            <div>
              <Card className="sticky top-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Prediction Detail
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedPrediction ? (
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-bold text-lg">{selectedPrediction.storeName}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={selectedPrediction.recommendedChannel === "call" ? "default" : "secondary"}>
                            {selectedPrediction.recommendedChannel === "call" ? "📞 Call Recommended" : 
                             selectedPrediction.recommendedChannel === "sms" ? "💬 SMS Recommended" : "📱 Mixed"}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Call Answer Prob</span>
                            <span className={getProbColor(selectedPrediction.answerProb)}>
                              {Math.round(selectedPrediction.answerProb * 100)}%
                            </span>
                          </div>
                          <Progress value={selectedPrediction.answerProb * 100} className="h-2" />
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>SMS Reply Prob</span>
                            <span className={getProbColor(selectedPrediction.textReplyProb)}>
                              {Math.round(selectedPrediction.textReplyProb * 100)}%
                            </span>
                          </div>
                          <Progress value={selectedPrediction.textReplyProb * 100} className="h-2" />
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
                      </div>

                      <div className="pt-4 border-t space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Persona</span>
                          <Badge>{selectedPrediction.persona}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Best Window</span>
                          <span className="text-sm font-medium">{selectedPrediction.bestWindow}</span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button 
                          className="flex-1 gap-1" 
                          size="sm"
                          onClick={() => handleCallStore(selectedPrediction)}
                        >
                          <PhoneCall className="h-4 w-4" />
                          Call
                        </Button>
                        <Button 
                          variant="secondary" 
                          className="flex-1 gap-1" 
                          size="sm"
                          onClick={() => handleTextStore(selectedPrediction)}
                        >
                          <MessageSquare className="h-4 w-4" />
                          Text
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p className="text-muted-foreground">Select a store to see predictions</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        {/* TARGETING TAB */}
        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="targeting" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Unified Outbound Queue
              </CardTitle>
              <CardDescription>AI-ranked stores with recommended channel per contact</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Button size="sm" className="gap-1">
                  <RefreshCw className="h-4 w-4" />
                  Rebuild Queue
                </Button>
                <Button size="sm" variant="outline" className="gap-1">
                  <Play className="h-4 w-4" />
                  Start Processing
                </Button>
              </div>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Priority</TableHead>
                      <TableHead>Store</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Order %</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead>Persona</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockPredictions.map((pred, i) => (
                      <TableRow key={pred.id}>
                        <TableCell>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                            i === 0 ? "bg-red-500 text-white" :
                            i === 1 ? "bg-orange-500 text-white" :
                            i === 2 ? "bg-yellow-500 text-black" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            {95 - i * 8}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{pred.storeName}</TableCell>
                        <TableCell>
                          <Badge variant={pred.recommendedChannel === "call" ? "default" : "secondary"} className="gap-1">
                            {getChannelIcon(pred.recommendedChannel)}
                            {pred.recommendedChannel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className={getProbColor(pred.orderProb)}>{Math.round(pred.orderProb * 100)}%</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={pred.churnRisk > 0.5 ? "destructive" : pred.churnRisk > 0.3 ? "secondary" : "outline"}>
                            {pred.churnRisk > 0.5 ? "High" : pred.churnRisk > 0.3 ? "Medium" : "Low"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{pred.persona}</TableCell>
                        <TableCell>
                          <Badge variant="outline">Pending</Badge>
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
        <TabsContent value="live-calls" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-2xl font-bold">{mockLiveCalls.length}</span>
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
                <div className="text-2xl font-bold text-green-500">{stats.callAnswerRate}%</div>
                <p className="text-xs text-muted-foreground">Answer Rate</p>
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
            {mockLiveCalls.map((call) => (
              <Card key={call.id} className="border-2 border-green-500/30">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <PhoneCall className="h-4 w-4" />
                      {call.storeName}
                    </CardTitle>
                    <Badge variant="outline" className="gap-1 text-green-600">
                      <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      Live
                    </Badge>
                  </div>
                  <CardDescription>{call.phone} • {call.duration}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">{call.persona}</Badge>
                    <Badge variant={call.sentiment === "positive" ? "default" : "secondary"}>
                      {call.sentiment}
                    </Badge>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <div className="flex items-center gap-2 mb-2">
                      <Mic className="h-4 w-4 text-primary animate-pulse" />
                      <span className="text-xs font-medium">Live Transcript</span>
                    </div>
                    <p className="text-sm italic">"{call.transcript}"</p>
                  </div>
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
                      Join
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        {/* LIVE TEXTS TAB */}
        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="live-texts" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-2xl font-bold">{mockLiveTexts.length}</span>
                </div>
                <p className="text-xs text-muted-foreground">Active Conversations</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">45</div>
                <p className="text-xs text-muted-foreground">Awaiting Reply</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-500">{stats.smsReplyRate}%</div>
                <p className="text-xs text-muted-foreground">Reply Rate</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">12</div>
                <p className="text-xs text-muted-foreground">Converting</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4">
            {mockLiveTexts.map((text) => (
              <Card key={text.id} className={`border-l-4 ${
                text.sentiment === "positive" ? "border-l-green-500" :
                text.sentiment === "interested" ? "border-l-blue-500" :
                "border-l-gray-300"
              }`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium">{text.storeName}</span>
                        <span className="text-sm text-muted-foreground">{text.phone}</span>
                        <Badge variant={
                          text.status === "converting" ? "default" :
                          text.status === "awaiting_reply" ? "secondary" :
                          "outline"
                        }>
                          {text.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50 mb-3">
                        <p className="text-sm">"{text.lastMessage}"</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Brain className="h-4 w-4 text-primary" />
                        <span className="text-sm text-muted-foreground">AI Suggestion:</span>
                        <span className="text-sm font-medium">{text.aiSuggestion}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button size="sm" variant="outline" className="gap-1">
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                      <Button size="sm" className="gap-1">
                        <Send className="h-4 w-4" />
                        Reply
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        {/* EXPERIMENTS TAB */}
        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="experiments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-purple-500" />
                A/B Test Results (Cross-Channel)
              </CardTitle>
              <CardDescription>Comparing call vs SMS strategies</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockExperimentResults.map((result, i) => (
                  <div key={i} className="p-4 rounded-lg border">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Badge variant={i === 2 ? "default" : "outline"}>{result.variant}</Badge>
                        <span className="text-sm text-muted-foreground">{result.channel}</span>
                      </div>
                      {i === 2 && <Badge className="bg-green-500">Best Performer</Badge>}
                    </div>
                    <div className="grid grid-cols-6 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold">{result.calls}</p>
                        <p className="text-xs text-muted-foreground">Calls</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{result.sms}</p>
                        <p className="text-xs text-muted-foreground">SMS</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{Math.round((result.answered / result.calls) * 100)}%</p>
                        <p className="text-xs text-muted-foreground">Answer Rate</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{Math.round((result.replies / result.sms) * 100)}%</p>
                        <p className="text-xs text-muted-foreground">Reply Rate</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-500">{result.orders}</p>
                        <p className="text-xs text-muted-foreground">Orders</p>
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

          <Card>
            <CardHeader>
              <CardTitle>Channel Performance Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-3">
                    <PhoneCall className="h-5 w-5 text-blue-500" />
                    <span className="font-medium">Voice Calls</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Conversion Rate</span>
                      <span className="font-bold">24%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Cost per Order</span>
                      <span className="font-bold">$2.40</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Best For</span>
                      <span className="text-muted-foreground">High-value, complex</span>
                    </div>
                  </div>
                </div>
                <div className="p-4 rounded-lg border bg-green-500/5">
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquare className="h-5 w-5 text-green-500" />
                    <span className="font-medium">SMS</span>
                    <Badge className="bg-green-500">Winner</Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Conversion Rate</span>
                      <span className="font-bold text-green-600">28%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Cost per Order</span>
                      <span className="font-bold text-green-600">$0.80</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Best For</span>
                      <span className="text-muted-foreground">Reactivation, promos</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        {/* OPTIMIZATION TAB */}
        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="optimization" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                AI Learning Insights (Cross-Channel)
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
                    <Badge variant="outline" className="text-green-500">
                      {learning.metric}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
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
                    <span className="font-medium">Professional</span>
                    <Badge variant="secondary">48% conversion</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Optimal Channel by Segment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2 rounded bg-muted">
                    <span className="font-medium">High Churn Risk</span>
                    <Badge variant="secondary" className="gap-1">
                      <MessageSquare className="h-3 w-3" />
                      SMS
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-muted">
                    <span className="font-medium">High Value</span>
                    <Badge className="gap-1">
                      <PhoneCall className="h-3 w-3" />
                      Call
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-muted">
                    <span className="font-medium">Dead Stores</span>
                    <Badge variant="outline" className="gap-1">
                      <Smartphone className="h-3 w-3" />
                      Mixed
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}