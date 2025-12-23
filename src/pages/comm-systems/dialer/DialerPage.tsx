import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Phone, PhoneCall, PhoneOff, PhoneMissed,
  UserCircle, Clock, Mic, MicOff, Volume2, VolumeX, 
  ArrowRightLeft, Calendar, Tag, FileText, Bot, User,
  Search, Play, Pause, RotateCcw
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/contexts/BusinessContext";
import CommSystemsLayout from "../CommSystemsLayout";
import { toast } from "sonner";
import { format } from "date-fns";

export default function DialerPage() {
  const { currentBusiness } = useBusiness();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedLine, setSelectedLine] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [callMode, setCallMode] = useState<"ai" | "human" | "hybrid">("hybrid");
  const [isCallActive, setIsCallActive] = useState(false);
  const [callNotes, setCallNotes] = useState("");
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [followUpDate, setFollowUpDate] = useState("");
  const [aiAssistEnabled, setAiAssistEnabled] = useState(true);
  const [scriptContent, setScriptContent] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const timerRef = useRef<NodeJS.Timeout>();

  // Fetch phone numbers
  const { data: phoneNumbers } = useQuery({
    queryKey: ['comm-phone-numbers', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_center_phone_numbers')
        .select('*')
        .eq('is_active', true)
        .order('phone_number');
      if (error) throw error;
      return data;
    }
  });

  // Fetch AI agents
  const { data: aiAgents } = useQuery({
    queryKey: ['comm-ai-agents', currentBusiness?.id],
    queryFn: async () => {
      const query = supabase
        .from('call_center_ai_agents')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (currentBusiness?.id) {
        query.eq('business_name', currentBusiness.name);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  // Fetch contacts for selector
  const { data: contacts } = useQuery({
    queryKey: ['comm-contacts', currentBusiness?.id, contactSearch],
    queryFn: async () => {
      const query = supabase
        .from('crm_contacts')
        .select('*')
        .order('name')
        .limit(50);
      
      if (contactSearch) {
        query.ilike('name', `%${contactSearch}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  // Call timer
  useEffect(() => {
    if (isCallActive) {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setCallDuration(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isCallActive]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleNumberClick = (digit: string) => {
    setPhoneNumber(prev => prev + digit);
  };

  const handleCall = () => {
    if (!phoneNumber) {
      toast.error("Please enter a phone number");
      return;
    }
    if (!selectedLine) {
      toast.error("Please select a business line");
      return;
    }
    setIsCallActive(true);
    toast.success("Call initiated");
  };

  const handleHangup = async () => {
    // Log the call
    if (currentBusiness) {
      await supabase.from('call_center_logs').insert({
        caller_id: phoneNumber,
        business_name: currentBusiness.name,
        direction: 'outbound',
        duration: callDuration,
        answered_by: callMode === 'ai' ? 'ai' : 'human',
        summary: callNotes,
        outcome: selectedOutcome || 'completed',
        tags: selectedTags,
      });
    }
    
    setIsCallActive(false);
    setCallNotes("");
    setSelectedOutcome("");
    setSelectedTags([]);
    toast.info("Call ended");
  };

  const handleTransfer = () => {
    toast.info("Transfer initiated");
  };

  const dialPad = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['*', '0', '#']
  ];

  const outcomes = [
    'Completed', 'Voicemail', 'No Answer', 'Busy', 'Callback Scheduled', 
    'Not Interested', 'Wrong Number', 'Follow-up Required'
  ];

  const tagOptions = ['Hot Lead', 'Follow-up', 'Complaint', 'Order', 'Support', 'Sales', 'VIP'];

  return (
    <CommSystemsLayout title="Dialer" subtitle="Place and receive calls with AI assistance">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Dial Pad & Controls */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Dial Pad
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Phone Number Input */}
              <Input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="text-xl text-center font-mono"
                disabled={isCallActive}
              />

              {/* Dial Pad */}
              <div className="grid grid-cols-3 gap-2">
                {dialPad.map((row) => (
                  row.map((digit) => (
                    <Button
                      key={digit}
                      variant="outline"
                      size="lg"
                      onClick={() => handleNumberClick(digit)}
                      className="h-14 text-2xl font-semibold"
                      disabled={isCallActive}
                    >
                      {digit}
                    </Button>
                  ))
                ))}
              </div>

              {/* Clear / Backspace */}
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setPhoneNumber(prev => prev.slice(0, -1))}
                  disabled={isCallActive}
                >
                  ← Delete
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setPhoneNumber('')}
                  disabled={isCallActive}
                >
                  Clear
                </Button>
              </div>

              {/* Call Settings */}
              <div className="space-y-3 pt-4 border-t">
                <div>
                  <Label>Business Line</Label>
                  <Select value={selectedLine} onValueChange={setSelectedLine} disabled={isCallActive}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select phone line" />
                    </SelectTrigger>
                    <SelectContent>
                      {phoneNumbers?.map((number) => (
                        <SelectItem key={number.id} value={number.id}>
                          {number.phone_number} - {number.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Call Mode</Label>
                  <Select value={callMode} onValueChange={(v: any) => setCallMode(v)} disabled={isCallActive}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ai">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4" /> AI Only
                        </div>
                      </SelectItem>
                      <SelectItem value="human">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" /> Human Only
                        </div>
                      </SelectItem>
                      <SelectItem value="hybrid">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4" /><User className="h-4 w-4" /> Hybrid
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {callMode !== 'human' && (
                  <div>
                    <Label>AI Agent</Label>
                    <Select value={selectedAgent} onValueChange={setSelectedAgent} disabled={isCallActive}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select AI agent" />
                      </SelectTrigger>
                      <SelectContent>
                        {aiAgents?.map((agent) => (
                          <SelectItem key={agent.id} value={agent.id}>
                            {agent.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {callMode !== 'ai' && (
                  <div className="flex items-center justify-between">
                    <Label>AI Assist</Label>
                    <Switch 
                      checked={aiAssistEnabled} 
                      onCheckedChange={setAiAssistEnabled}
                      disabled={isCallActive}
                    />
                  </div>
                )}
              </div>

              {/* Call / Hangup Button */}
              {!isCallActive ? (
                <Button 
                  onClick={handleCall}
                  className="w-full h-14 text-lg"
                  size="lg"
                >
                  <PhoneCall className="h-5 w-5 mr-2" />
                  Start Call
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => setIsMuted(!isMuted)}
                      variant={isMuted ? "destructive" : "outline"}
                      className="flex-1"
                    >
                      {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
                    <Button 
                      onClick={() => setIsOnHold(!isOnHold)}
                      variant={isOnHold ? "secondary" : "outline"}
                      className="flex-1"
                    >
                      {isOnHold ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    </Button>
                    <Button onClick={handleTransfer} variant="outline" className="flex-1">
                      <ArrowRightLeft className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button 
                    onClick={handleHangup}
                    variant="destructive"
                    className="w-full h-12"
                    size="lg"
                  >
                    <PhoneOff className="h-5 w-5 mr-2" />
                    End Call
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contact Selector */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Quick Contact Select</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search contacts..." 
                  className="pl-9"
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                />
              </div>
              <ScrollArea className="h-32">
                <div className="space-y-1">
                  {contacts?.slice(0, 10).map((contact) => (
                    <Button
                      key={contact.id}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => {
                        setSelectedContact(contact);
                        setPhoneNumber(contact.phone || '');
                      }}
                    >
                      <UserCircle className="h-4 w-4 mr-2" />
                      {contact.name}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Center: Call Info & Script */}
        <div className="lg:col-span-1 space-y-4">
          {/* Active Call Info */}
          <Card className={isCallActive ? "border-green-500/50 bg-green-500/5" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <UserCircle className="h-5 w-5" />
                  Call Information
                </CardTitle>
                {isCallActive && (
                  <Badge variant="default" className="animate-pulse bg-green-500">
                    <Clock className="h-3 w-3 mr-1" />
                    {formatDuration(callDuration)}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isCallActive || selectedContact ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                      <UserCircle className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold text-lg">
                        {selectedContact?.name || phoneNumber || 'Unknown'}
                      </p>
                      <p className="text-sm text-muted-foreground">{phoneNumber}</p>
                      {selectedContact?.company && (
                        <p className="text-sm text-muted-foreground">{selectedContact.company}</p>
                      )}
                    </div>
                  </div>
                  
                  {isCallActive && (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="p-2 bg-muted rounded">
                        <p className="text-muted-foreground">Mode</p>
                        <p className="font-medium capitalize">{callMode}</p>
                      </div>
                      <div className="p-2 bg-muted rounded">
                        <p className="text-muted-foreground">Status</p>
                        <p className="font-medium">{isOnHold ? 'On Hold' : 'Active'}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Phone className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No active call</p>
                  <p className="text-sm">Enter a number or select a contact</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Script Panel */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Call Script
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="script">
                <TabsList className="w-full">
                  <TabsTrigger value="script" className="flex-1">Script</TabsTrigger>
                  <TabsTrigger value="objections" className="flex-1">Objections</TabsTrigger>
                  <TabsTrigger value="faq" className="flex-1">FAQ</TabsTrigger>
                </TabsList>
                <TabsContent value="script" className="mt-3">
                  <Textarea 
                    placeholder="Paste or type your call script here..."
                    className="min-h-[200px]"
                    value={scriptContent}
                    onChange={(e) => setScriptContent(e.target.value)}
                  />
                </TabsContent>
                <TabsContent value="objections" className="mt-3">
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-3">
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="font-medium text-sm">"I'm not interested"</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Response: "I understand. May I ask what specifically doesn't interest you? Perhaps I can address any concerns..."
                        </p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="font-medium text-sm">"I don't have time"</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Response: "I appreciate that you're busy. When would be a better time for a quick 5-minute call?"
                        </p>
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="faq" className="mt-3">
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-3">
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="font-medium text-sm">What are your business hours?</p>
                        <p className="text-sm text-muted-foreground mt-1">Monday - Friday, 9am - 6pm EST</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="font-medium text-sm">How can I get a quote?</p>
                        <p className="text-sm text-muted-foreground mt-1">I can help you with that right now...</p>
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Right: Notes & Outcome */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Call Notes</CardTitle>
              <CardDescription>Document the conversation</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Add notes about this call..."
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                className="min-h-[150px]"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Call Outcome</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Outcome</Label>
                <Select value={selectedOutcome} onValueChange={setSelectedOutcome}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select outcome" />
                  </SelectTrigger>
                  <SelectContent>
                    {outcomes.map((outcome) => (
                      <SelectItem key={outcome} value={outcome.toLowerCase()}>
                        {outcome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {tagOptions.map((tag) => (
                    <Badge
                      key={tag}
                      variant={selectedTags.includes(tag) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        setSelectedTags(prev => 
                          prev.includes(tag) 
                            ? prev.filter(t => t !== tag)
                            : [...prev, tag]
                        );
                      }}
                    >
                      <Tag className="h-3 w-3 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label>Schedule Follow-up</Label>
                <Input 
                  type="datetime-local"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                />
              </div>

              <Button className="w-full" disabled={!isCallActive}>
                <Calendar className="h-4 w-4 mr-2" />
                Save & Schedule Follow-up
              </Button>
            </CardContent>
          </Card>

          {/* AI Suggestions (when enabled) */}
          {aiAssistEnabled && isCallActive && (
            <Card className="border-primary/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-primary">
                  <Bot className="h-5 w-5" />
                  AI Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="p-2 bg-primary/10 rounded">
                    <p className="text-primary font-medium">Suggested Response:</p>
                    <p className="text-muted-foreground mt-1">
                      "Thank you for your interest. Based on your needs, I'd recommend our premium package..."
                    </p>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <p className="font-medium">Detected Intent:</p>
                    <p className="text-muted-foreground">Product inquiry - pricing questions</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </CommSystemsLayout>
  );
}
