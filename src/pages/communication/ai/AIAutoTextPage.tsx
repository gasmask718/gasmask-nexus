import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageSquare, Send, Sparkles, Clock, Users, CheckCircle, 
  XCircle, RefreshCw, Zap, Target, BarChart3, Plus, Trash2, 
  Wand2, ArrowRight, Calendar, MessageCircle, Loader2
} from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  type: "blast" | "drip";
  status: "running" | "completed" | "scheduled" | "draft";
  sent: number;
  delivered: number;
  replies: number;
  ctr: number;
  scheduledAt?: string;
}

interface DripStep {
  id: string;
  day: number;
  message: string;
  condition: "none" | "no_reply" | "no_click";
}

const mockCampaigns: Campaign[] = [
  { id: "1", name: "New Product Launch", type: "blast", status: "completed", sent: 1250, delivered: 1198, replies: 89, ctr: 12.5 },
  { id: "2", name: "Win Back Campaign", type: "drip", status: "running", sent: 450, delivered: 432, replies: 34, ctr: 8.2 },
  { id: "3", name: "Holiday Promo", type: "blast", status: "scheduled", sent: 0, delivered: 0, replies: 0, ctr: 0, scheduledAt: "2024-01-20 09:00" },
];

// AI-generated message templates based on step position
const aiMessageTemplates = [
  "Hey {first_name}! Just wanted to reach out and see how things are going at {store_name}. We've got some great new products that might interest you!",
  "Hi {first_name}, hope all is well! Haven't heard from you in a bit - any questions about our latest offerings? I'm here to help!",
  "Quick check-in, {first_name}! Your customers at {store_name} would love our new arrivals. Ready to stock up?",
  "Hey there! Just a friendly reminder that we're always here for {store_name}. Need anything? Let's chat!",
  "Last chance alert, {first_name}! Don't miss out on exclusive deals for {store_name}. Reply YES to learn more!"
];

export default function AIAutoTextPage() {
  const { toast } = useToast();
  const [campaignName, setCampaignName] = useState("");
  const [messageType, setMessageType] = useState("");
  const [selectedPersona, setSelectedPersona] = useState("");
  const [selectedSegment, setSelectedSegment] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [isAIEnabled, setIsAIEnabled] = useState(true);
  const [throttle, setThrottle] = useState("50");
  const [generatingStepId, setGeneratingStepId] = useState<string | null>(null);
  const [aiActionLoading, setAiActionLoading] = useState<string | null>(null);
  
  const [dripSteps, setDripSteps] = useState<DripStep[]>([
    { id: "1", day: 1, message: "Hey {first_name}! We have some exciting new products you might love. Check them out!", condition: "none" },
    { id: "2", day: 3, message: "Hi again! Just wanted to make sure you saw our new arrivals. Any questions?", condition: "no_reply" },
    { id: "3", day: 7, message: "Last chance! Don't miss out on these amazing deals. Reply to learn more!", condition: "no_reply" },
  ]);

  const handleAIRewrite = async () => {
    if (!messageContent.trim()) {
      toast({
        title: "No Content",
        description: "Please enter some text to rewrite.",
        variant: "destructive",
      });
      return;
    }

    setAiActionLoading("rewrite");
    toast({
      title: "Rewriting Message",
      description: "AI is creating a fresh version of your message...",
    });

    await new Promise(resolve => setTimeout(resolve, 1500));

    const rewrittenMessages = [
      `Hey {first_name}! Great news from {brand} - we've got something special for {store_name}. Let's connect!`,
      `Hi there! {brand} has exciting updates for {store_name}. Your customers will love what's new!`,
      `{first_name}, quick heads up - {brand} just dropped some amazing products perfect for {store_name}!`,
    ];
    const randomIndex = Math.floor(Math.random() * rewrittenMessages.length);
    setMessageContent(rewrittenMessages[randomIndex]);

    setAiActionLoading(null);
    toast({
      title: "Message Rewritten",
      description: "Your message has been freshly rewritten by AI.",
    });
  };

  const handleMakeShorter = async () => {
    if (!messageContent.trim()) {
      toast({
        title: "No Content",
        description: "Please enter some text to shorten.",
        variant: "destructive",
      });
      return;
    }

    setAiActionLoading("shorter");
    toast({
      title: "Shortening Message",
      description: "AI is condensing your message...",
    });

    await new Promise(resolve => setTimeout(resolve, 1200));

    // Simulate shortening by taking key phrases
    const shorterVersions = [
      `{first_name}, new products just in! Check them out at {store_name}.`,
      `Hey {first_name}! {brand} has fresh stock for you. Interested?`,
      `Quick update, {first_name}: New arrivals ready for {store_name}!`,
    ];
    const randomIndex = Math.floor(Math.random() * shorterVersions.length);
    setMessageContent(shorterVersions[randomIndex]);

    setAiActionLoading(null);
    toast({
      title: "Message Shortened",
      description: "Your message has been condensed while keeping the key points.",
    });
  };

  const handleFixGrammar = async () => {
    if (!messageContent.trim()) {
      toast({
        title: "No Content",
        description: "Please enter some text to fix.",
        variant: "destructive",
      });
      return;
    }

    setAiActionLoading("grammar");
    toast({
      title: "Fixing Grammar",
      description: "AI is correcting your message...",
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Simulate grammar fix - capitalize properly, fix common issues
    let fixed = messageContent;
    // Capitalize first letter
    fixed = fixed.charAt(0).toUpperCase() + fixed.slice(1);
    // Ensure proper ending punctuation
    if (!/[.!?]$/.test(fixed.trim())) {
      fixed = fixed.trim() + ".";
    }
    // Fix common typos
    fixed = fixed.replace(/\bi\b/g, "I");
    fixed = fixed.replace(/\bdont\b/gi, "don't");
    fixed = fixed.replace(/\bcant\b/gi, "can't");
    fixed = fixed.replace(/\bwont\b/gi, "won't");
    
    setMessageContent(fixed);

    setAiActionLoading(null);
    toast({
      title: "Grammar Fixed",
      description: "Your message has been corrected for grammar and spelling.",
    });
  };

  const handleAIGenerate = async (stepId: string, stepIndex: number) => {
    setGeneratingStepId(stepId);
    
    toast({
      title: "Generating AI Message",
      description: "Creating personalized content for this step...",
    });

    // Simulate AI generation delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Get appropriate template based on step position
    const templateIndex = Math.min(stepIndex, aiMessageTemplates.length - 1);
    const generatedMessage = aiMessageTemplates[templateIndex];

    // Update the step with the generated message
    setDripSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, message: generatedMessage } : step
    ));

    setGeneratingStepId(null);
    
    toast({
      title: "Message Generated",
      description: "AI has created a personalized message for this step.",
    });
  };

  const addDripStep = () => {
    const lastDay = dripSteps.length > 0 ? Math.max(...dripSteps.map(s => s.day)) : 0;
    setDripSteps([...dripSteps, {
      id: Date.now().toString(),
      day: lastDay + 2,
      message: "",
      condition: "no_reply"
    }]);
  };

  const removeDripStep = (id: string) => {
    setDripSteps(dripSteps.filter(s => s.id !== id));
  };

  const stats = {
    sent: 1250,
    delivered: 1198,
    replies: 89,
    failed: 52,
    pending: 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            AI Auto Text
          </h1>
          <p className="text-muted-foreground">Bulk SMS campaigns & intelligent drip sequences</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <MessageCircle className="h-3 w-3" />
            1,250 sent today
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="blast" className="space-y-6">
        <TabsList className="grid w-full max-w-lg grid-cols-4">
          <TabsTrigger value="blast">Bulk Blast</TabsTrigger>
          <TabsTrigger value="drip">Drip Campaign</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Bulk Blast Tab */}
        <TabsContent value="blast" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Campaign Creator */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Bulk SMS Builder
                </CardTitle>
                <CardDescription>Send personalized messages to thousands of stores</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Campaign Name</Label>
                  <Input
                    placeholder="e.g., New Year Promo Blast"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Message Type</Label>
                  <Select value={messageType} onValueChange={setMessageType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select message type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ai-generated">AI Generated</SelectItem>
                      <SelectItem value="template">From Template</SelectItem>
                      <SelectItem value="manual">Manual / Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Brand Voice Persona</Label>
                  <Select value={selectedPersona} onValueChange={setSelectedPersona}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="friendly">Friendly & Casual</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="urgent">Urgent / FOMO</SelectItem>
                      <SelectItem value="empathetic">Warm & Empathetic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Target Segment</Label>
                  <Select value={selectedSegment} onValueChange={setSelectedSegment}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select target stores" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Stores</SelectItem>
                      <SelectItem value="new">New Stores (Last 30 days)</SelectItem>
                      <SelectItem value="dead">Dead Stores (No orders 60+ days)</SelectItem>
                      <SelectItem value="high-value">High Value Stores</SelectItem>
                      <SelectItem value="low-engagement">Low Engagement</SelectItem>
                      <SelectItem value="custom">Custom List</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Message Content</Label>
                    <div className="flex items-center gap-2">
                      <Switch checked={isAIEnabled} onCheckedChange={setIsAIEnabled} />
                      <span className="text-xs text-muted-foreground">AI Assist</span>
                    </div>
                  </div>
                  <Textarea
                    placeholder="Type your message... Use {first_name}, {store_name}, {brand} for personalization"
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    rows={4}
                  />
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="gap-1"
                      onClick={handleAIRewrite}
                      disabled={aiActionLoading !== null || !messageContent.trim()}
                    >
                      {aiActionLoading === "rewrite" ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Wand2 className="h-3 w-3" />
                      )}
                      {aiActionLoading === "rewrite" ? "Rewriting..." : "AI Rewrite"}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="gap-1"
                      onClick={handleMakeShorter}
                      disabled={aiActionLoading !== null || !messageContent.trim()}
                    >
                      {aiActionLoading === "shorter" ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      {aiActionLoading === "shorter" ? "Shortening..." : "Make Shorter"}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="gap-1"
                      onClick={handleFixGrammar}
                      disabled={aiActionLoading !== null || !messageContent.trim()}
                    >
                      {aiActionLoading === "grammar" ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : null}
                      {aiActionLoading === "grammar" ? "Fixing..." : "Fix Grammar"}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Send Rate (messages/minute)</Label>
                  <Select value={throttle} onValueChange={setThrottle}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10/min (Slow)</SelectItem>
                      <SelectItem value="50">50/min (Normal)</SelectItem>
                      <SelectItem value="100">100/min (Fast)</SelectItem>
                      <SelectItem value="200">200/min (Turbo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-4 flex gap-2">
                  <Button className="flex-1 gap-2" disabled={!campaignName || !messageContent || !selectedSegment}>
                    <Send className="h-4 w-4" />
                    Send Now
                  </Button>
                  <Button variant="outline" className="gap-2">
                    <Calendar className="h-4 w-4" />
                    Schedule
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Preview & Stats */}
            <div className="space-y-6">
              {/* Message Preview */}
              <Card>
                <CardHeader>
                  <CardTitle>Message Preview</CardTitle>
                  <CardDescription>How your message will appear</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted rounded-lg p-4">
                    <div className="bg-primary text-primary-foreground rounded-lg p-3 max-w-[80%] ml-auto">
                      <p className="text-sm">
                        {messageContent || "Your message preview will appear here..."}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 text-right">
                      {messageContent.length}/160 characters
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Campaign Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Campaign Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <Send className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-2xl font-bold">{stats.sent}</p>
                        <p className="text-xs text-muted-foreground">Sent</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="text-2xl font-bold text-green-600">{stats.delivered}</p>
                        <p className="text-xs text-muted-foreground">Delivered</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10">
                      <MessageCircle className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="text-2xl font-bold text-blue-600">{stats.replies}</p>
                        <p className="text-xs text-muted-foreground">Replies</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10">
                      <XCircle className="h-5 w-5 text-red-500" />
                      <div>
                        <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
                        <p className="text-xs text-muted-foreground">Failed</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Drip Campaign Tab */}
        <TabsContent value="drip" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-primary" />
                Multi-Step Drip Campaign
              </CardTitle>
              <CardDescription>Create automated message sequences that nurture leads over time</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Campaign Name</Label>
                  <Input placeholder="e.g., Store Reactivation Sequence" />
                </div>
                <div className="space-y-2">
                  <Label>Target Segment</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select segment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dead">Dead Stores</SelectItem>
                      <SelectItem value="new">New Stores</SelectItem>
                      <SelectItem value="low-engagement">Low Engagement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-lg">Message Steps</Label>
                  <Button size="sm" variant="outline" onClick={addDripStep} className="gap-1">
                    <Plus className="h-4 w-4" />
                    Add Step
                  </Button>
                </div>

                <div className="space-y-4">
                  {dripSteps.map((step, index) => (
                    <Card key={step.id} className="border-dashed">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">Day {step.day}</Badge>
                            {index > 0 && (
                              <Select defaultValue={step.condition}>
                                <SelectTrigger className="w-40 h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Always send</SelectItem>
                                  <SelectItem value="no_reply">If no reply</SelectItem>
                                  <SelectItem value="no_click">If no click</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                          {dripSteps.length > 1 && (
                            <Button size="sm" variant="ghost" onClick={() => removeDripStep(step.id)}>
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          )}
                        </div>
                        <Textarea
                          value={step.message}
                          onChange={(e) => {
                            const updated = dripSteps.map(s => 
                              s.id === step.id ? { ...s, message: e.target.value } : s
                            );
                            setDripSteps(updated);
                          }}
                          placeholder="Enter message for this step..."
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="gap-1"
                            onClick={() => handleAIGenerate(step.id, index)}
                            disabled={generatingStepId === step.id}
                          >
                            {generatingStepId === step.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Wand2 className="h-3 w-3" />
                            )}
                            {generatingStepId === step.id ? "Generating..." : "AI Generate"}
                          </Button>
                        </div>
                        {index < dripSteps.length - 1 && (
                          <div className="flex justify-center pt-2">
                            <ArrowRight className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="pt-4 flex gap-2">
                  <Button className="flex-1 gap-2">
                    <Zap className="h-4 w-4" />
                    Launch Drip Campaign
                  </Button>
                  <Button variant="outline">Save as Draft</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Message Templates</CardTitle>
              <CardDescription>Pre-built templates for common use cases</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[
                  { name: "New Product Alert", category: "Promo", uses: 45 },
                  { name: "Reactivation - We Miss You", category: "Win Back", uses: 128 },
                  { name: "Order Confirmation", category: "Transactional", uses: 892 },
                  { name: "Payment Reminder", category: "Collections", uses: 234 },
                  { name: "Holiday Special", category: "Promo", uses: 67 },
                  { name: "Feedback Request", category: "Engagement", uses: 156 },
                ].map((template, i) => (
                  <Card key={i} className="cursor-pointer hover:border-primary transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{template.name}</p>
                          <Badge variant="secondary" className="mt-1">{template.category}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">{template.uses} uses</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Campaign History</CardTitle>
              <CardDescription>Track performance of past campaigns</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Delivered</TableHead>
                      <TableHead>Replies</TableHead>
                      <TableHead>CTR</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockCampaigns.map((campaign) => (
                      <TableRow key={campaign.id}>
                        <TableCell className="font-medium">{campaign.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{campaign.type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              campaign.status === "running" ? "default" :
                              campaign.status === "completed" ? "secondary" :
                              "outline"
                            }
                          >
                            {campaign.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{campaign.sent.toLocaleString()}</TableCell>
                        <TableCell>{campaign.delivered.toLocaleString()}</TableCell>
                        <TableCell>{campaign.replies}</TableCell>
                        <TableCell>
                          <span className={campaign.ctr >= 10 ? "text-green-600" : campaign.ctr >= 5 ? "text-yellow-600" : "text-muted-foreground"}>
                            {campaign.ctr}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost">View</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
