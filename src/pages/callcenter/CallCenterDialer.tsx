import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Phone, PhoneCall, PhoneOff, UserCircle, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/contexts/BusinessContext";
import CallCenterLayout from "./CallCenterLayout";

export default function CallCenterDialer() {
  const { currentBusiness } = useBusiness();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedLine, setSelectedLine] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");
  const [callMode, setCallMode] = useState<"ai" | "human" | "hybrid">("hybrid");
  const [isCallActive, setIsCallActive] = useState(false);
  const [callNotes, setCallNotes] = useState("");

  const { data: phoneNumbers } = useQuery({
    queryKey: ['call-center-phone-numbers', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_center_phone_numbers')
        .select('*')
        .eq('is_active', true)
        .order('phone_number');
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentBusiness
  });

  const { data: aiAgents } = useQuery({
    queryKey: ['call-center-ai-agents', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_center_ai_agents')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentBusiness
  });

  const handleNumberClick = (digit: string) => {
    setPhoneNumber(prev => prev + digit);
  };

  const handleCall = () => {
    if (phoneNumber && selectedLine) {
      setIsCallActive(true);
      // Future: Integrate with Twilio
    }
  };

  const handleHangup = () => {
    setIsCallActive(false);
    setCallNotes("");
  };

  const dialPad = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['*', '0', '#']
  ];

  return (
    <CallCenterLayout title="Cloud Dialer">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Cloud Dialer</h1>
          <p className="text-muted-foreground">AI-powered calling interface</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Left: Dialer */}
          <Card>
            <CardHeader>
              <CardTitle>Dial Pad</CardTitle>
              <CardDescription>Enter number and configure call settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Phone Number</Label>
                <Input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="text-xl text-center font-mono"
                />
              </div>

              {/* Dial Pad */}
              <div className="grid grid-cols-3 gap-2">
                {dialPad.map((row, i) => (
                  row.map((digit) => (
                    <Button
                      key={digit}
                      variant="outline"
                      size="lg"
                      onClick={() => handleNumberClick(digit)}
                      className="h-16 text-2xl"
                      disabled={isCallActive}
                    >
                      {digit}
                    </Button>
                  ))
                ))}
              </div>

              <div className="space-y-3">
                <div>
                  <Label>Business Line</Label>
                  <Select value={selectedLine} onValueChange={setSelectedLine}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select phone number" />
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
                  <Select value={callMode} onValueChange={(v: any) => setCallMode(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ai">AI Only</SelectItem>
                      <SelectItem value="human">Human Only</SelectItem>
                      <SelectItem value="hybrid">Hybrid (AI Assist)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {callMode !== "human" && (
                  <div>
                    <Label>AI Agent</Label>
                    <Select value={selectedAgent} onValueChange={setSelectedAgent}>
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
              </div>

              <div className="flex gap-2">
                {!isCallActive ? (
                  <Button 
                    onClick={handleCall}
                    disabled={!phoneNumber || !selectedLine}
                    className="flex-1"
                    size="lg"
                  >
                    <PhoneCall className="h-4 w-4 mr-2" />
                    Call
                  </Button>
                ) : (
                  <>
                    <Button 
                      onClick={handleHangup}
                      variant="destructive"
                      className="flex-1"
                      size="lg"
                    >
                      <PhoneOff className="h-4 w-4 mr-2" />
                      Hang Up
                    </Button>
                    <Button variant="outline" size="lg">
                      Hold
                    </Button>
                    <Button variant="outline" size="lg">
                      Transfer
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Right: Call Info */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
                <CardDescription>Caller details from CRM</CardDescription>
              </CardHeader>
              <CardContent>
                {isCallActive ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <UserCircle className="h-12 w-12 text-muted-foreground" />
                      <div>
                        <p className="font-semibold">{phoneNumber}</p>
                        <p className="text-sm text-muted-foreground">Unknown Contact</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4" />
                      <span>Call duration: 00:00</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No active call
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Call Notes</CardTitle>
                <CardDescription>Notes for this conversation</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Add notes about this call..."
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  rows={8}
                  disabled={!isCallActive}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </CallCenterLayout>
  );
}
