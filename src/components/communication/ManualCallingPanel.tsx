import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { 
  Phone, PhoneCall, PhoneOff, Clock, CheckCircle2, 
  XCircle, VoicemailIcon, User, Bot, Plus, Sparkles, RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Store {
  id: string;
  store_name: string;
  owner_name?: string;
  phone?: string;
  address?: string;
}

interface CallLog {
  id: string;
  store_id: string;
  outcome: string;
  transcription?: string;
  created_at: string;
}

interface ManualCallingPanelProps {
  stores: Store[];
  recentCalls: CallLog[];
  onCall: (storeId: string, phone: string) => void;
  onLogOutcome: (callId: string, outcome: string, notes: string) => void;
  onScheduleFollowUp: (storeId: string, date: string) => void;
  isLoading?: boolean;
}

const OUTCOMES = [
  { value: "reached", label: "Reached", icon: CheckCircle2, color: "text-green-600" },
  { value: "no_answer", label: "No Answer", icon: PhoneOff, color: "text-amber-600" },
  { value: "voicemail", label: "Voicemail", icon: VoicemailIcon, color: "text-blue-600" },
  { value: "busy", label: "Busy", icon: Clock, color: "text-orange-600" },
  { value: "wrong_number", label: "Wrong Number", icon: XCircle, color: "text-red-600" },
  { value: "callback_requested", label: "Callback", icon: Phone, color: "text-purple-600" },
];

export function ManualCallingPanel({
  stores,
  recentCalls,
  onCall,
  onLogOutcome,
  onScheduleFollowUp,
  isLoading,
}: ManualCallingPanelProps) {
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [callNotes, setCallNotes] = useState("");
  const [selectedOutcome, setSelectedOutcome] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCallDialog, setShowCallDialog] = useState(false);

  const filteredStores = stores.filter(s => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      s.store_name?.toLowerCase().includes(term) ||
      s.owner_name?.toLowerCase().includes(term) ||
      s.phone?.includes(term)
    );
  });

  const handleStartCall = (store: Store) => {
    setSelectedStore(store);
    setShowCallDialog(true);
    if (store.phone) {
      onCall(store.id, store.phone);
    }
  };

  const handleLogCall = () => {
    if (selectedStore && selectedOutcome) {
      // In real implementation, would use actual call ID
      onLogOutcome("temp-id", selectedOutcome, callNotes);
      
      if (followUpDate) {
        onScheduleFollowUp(selectedStore.id, followUpDate);
      }
      
      // Reset
      setSelectedOutcome("");
      setCallNotes("");
      setFollowUpDate("");
      setShowCallDialog(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Store List */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              Call Queue
            </CardTitle>
            <Input
              placeholder="Search stores..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
            />
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {filteredStores.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No stores found
                </div>
              ) : (
                filteredStores.map((store) => (
                  <div
                    key={store.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{store.store_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {store.owner_name || "No owner"} • {store.phone || "No phone"}
                        </p>
                        {store.address && (
                          <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                            {store.address}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={() => handleStartCall(store)}
                      disabled={!store.phone}
                      className="gap-2"
                    >
                      <PhoneCall className="h-4 w-4" />
                      Call
                    </Button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Recent Calls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Recent Calls</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            {recentCalls.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No recent calls
              </div>
            ) : (
              <div className="space-y-3">
                {recentCalls.map((call) => {
                  const outcome = OUTCOMES.find(o => o.value === call.outcome);
                  const OutcomeIcon = outcome?.icon || Phone;
                  const store = stores.find(s => s.id === call.store_id);
                  
                  return (
                    <div key={call.id} className="p-3 rounded-lg border">
                      <div className="flex items-center gap-2 mb-1">
                        <OutcomeIcon className={cn("h-4 w-4", outcome?.color)} />
                        <span className="font-medium text-sm">
                          {store?.store_name || "Unknown"}
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {outcome?.label || call.outcome}
                      </Badge>
                      {call.transcription && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                          {call.transcription}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Call Dialog */}
      <Dialog open={showCallDialog} onOpenChange={setShowCallDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-green-600" />
              Calling {selectedStore?.store_name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                <Phone className="h-8 w-8 text-green-600 animate-pulse" />
              </div>
              <p className="font-medium">{selectedStore?.phone}</p>
              <p className="text-sm text-muted-foreground">{selectedStore?.owner_name}</p>
            </div>

            <div className="space-y-2">
              <Label>Call Outcome</Label>
              <div className="grid grid-cols-3 gap-2">
                {OUTCOMES.map((outcome) => {
                  const Icon = outcome.icon;
                  return (
                    <Button
                      key={outcome.value}
                      variant={selectedOutcome === outcome.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedOutcome(outcome.value)}
                      className="flex-col h-auto py-2"
                    >
                      <Icon className={cn("h-4 w-4 mb-1", selectedOutcome !== outcome.value && outcome.color)} />
                      <span className="text-xs">{outcome.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                placeholder="What was discussed..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="followup">Schedule Follow-up</Label>
              <Input
                id="followup"
                type="datetime-local"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleLogCall} disabled={!selectedOutcome}>
              Log Call
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
