import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import {
  Voicemail,
  Phone,
  PhoneOff,
  Play,
  Pause,
  CheckCircle,
  Clock,
  User,
  ArrowRight,
  Search,
  Filter,
  RefreshCw,
  FileText,
  AlertCircle,
  PhoneCall,
  MessageSquare,
} from "lucide-react";
import { useBusinessStore } from "@/stores/businessStore";
import { useCall } from "@/components/communication/CallProvider";

interface VoicemailRecord {
  id: string;
  business_id: string | null;
  caller_number: string;
  caller_name: string | null;
  recording_url: string | null;
  duration_seconds: number;
  transcription: string | null;
  transcription_status: string;
  reason: string | null;
  status: string;
  assigned_to: string | null;
  created_at: string;
  resolved_at: string | null;
}

export default function VoicemailInboxPage() {
  const { selectedBusiness } = useBusinessStore();
  const { initiateCall } = useCall();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedVoicemail, setSelectedVoicemail] = useState<VoicemailRecord | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement>(null);

  // Fetch voicemails
  const { data: voicemails, isLoading, refetch } = useQuery({
    queryKey: ["voicemails", selectedBusiness?.id, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("voicemails")
        .select("*")
        .order("created_at", { ascending: false });

      if (selectedBusiness?.id) {
        query = query.eq("business_id", selectedBusiness.id);
      }

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data as VoicemailRecord[];
    },
    enabled: !!selectedBusiness?.id,
  });

  // Mark as resolved mutation
  const resolveVoicemail = useMutation({
    mutationFn: async (voicemailId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("voicemails")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
        })
        .eq("id", voicemailId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voicemails"] });
      toast.success("Voicemail marked as resolved");
    },
    onError: () => {
      toast.error("Failed to update voicemail");
    },
  });

  // Create follow-up task mutation
  const createFollowUp = useMutation({
    mutationFn: async (voicemail: VoicemailRecord) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("call_followups")
        .insert({
          business_id: voicemail.business_id,
          source_type: "voicemail",
          source_id: voicemail.id,
          voicemail_id: voicemail.id,
          caller_number: voicemail.caller_number,
          caller_name: voicemail.caller_name,
          followup_type: "callback",
          title: `Return call: ${voicemail.caller_name || voicemail.caller_number}`,
          description: voicemail.transcription || `Voicemail from ${voicemail.caller_number}`,
          priority: "high",
          status: "pending",
          assigned_to: user?.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Follow-up task created");
    },
    onError: () => {
      toast.error("Failed to create follow-up");
    },
  });

  const handlePlayPause = (voicemail: VoicemailRecord) => {
    if (!voicemail.recording_url) {
      toast.error("No recording available");
      return;
    }

    if (selectedVoicemail?.id === voicemail.id && isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      setSelectedVoicemail(voicemail);
      if (audioRef.current) {
        audioRef.current.src = voicemail.recording_url;
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const filteredVoicemails = voicemails?.filter(vm => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      vm.caller_number?.toLowerCase().includes(search) ||
      vm.caller_name?.toLowerCase().includes(search) ||
      vm.transcription?.toLowerCase().includes(search)
    );
  });

  const stats = {
    total: voicemails?.length || 0,
    new: voicemails?.filter(v => v.status === "new").length || 0,
    pending: voicemails?.filter(v => v.status === "pending").length || 0,
    resolved: voicemails?.filter(v => v.status === "resolved").length || 0,
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getReasonBadge = (reason: string | null) => {
    switch (reason) {
      case "no_answer":
        return <Badge variant="secondary"><PhoneOff className="h-3 w-3 mr-1" /> No Answer</Badge>;
      case "after_hours":
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> After Hours</Badge>;
      case "busy":
        return <Badge variant="destructive"><Phone className="h-3 w-3 mr-1" /> Line Busy</Badge>;
      default:
        return <Badge variant="secondary">{reason || "Unknown"}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Voicemail Inbox</h1>
          <p className="text-muted-foreground">Listen, transcribe, and manage voicemails</p>
        </div>
      </div>
      <audio
        ref={audioRef}
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Voicemail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.new}</p>
                <p className="text-sm text-muted-foreground">New</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.resolved}</p>
                <p className="text-sm text-muted-foreground">Resolved</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by phone, name, or transcript..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Voicemail List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Voicemail className="h-5 w-5" />
            Voicemails
          </CardTitle>
          <CardDescription>
            {filteredVoicemails?.length || 0} voicemail{(filteredVoicemails?.length || 0) !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading voicemails...</div>
          ) : !filteredVoicemails?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Voicemail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No voicemails found</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {filteredVoicemails.map((vm) => (
                  <div
                    key={vm.id}
                    className={`p-4 rounded-lg border transition-colors ${
                      vm.status === "new"
                        ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800"
                        : vm.status === "pending"
                        ? "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800"
                        : "bg-muted/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        {/* Play Button */}
                        <Button
                          variant="outline"
                          size="icon"
                          className="shrink-0"
                          onClick={() => handlePlayPause(vm)}
                          disabled={!vm.recording_url}
                        >
                          {selectedVoicemail?.id === vm.id && isPlaying ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>

                        {/* Info */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {vm.caller_name || vm.caller_number}
                            </span>
                            {vm.caller_name && (
                              <span className="text-sm text-muted-foreground">
                                {vm.caller_number}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(vm.created_at), { addSuffix: true })}
                            <span>•</span>
                            <span>{formatDuration(vm.duration_seconds)}</span>
                            <span>•</span>
                            {getReasonBadge(vm.reason)}
                          </div>
                          {vm.transcription && (
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                              <FileText className="h-3 w-3 inline mr-1" />
                              {vm.transcription}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            vm.status === "new"
                              ? "destructive"
                              : vm.status === "pending"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {vm.status}
                        </Badge>

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              View
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Voicemail Details</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-sm text-muted-foreground">Caller</label>
                                  <p className="font-medium">{vm.caller_name || vm.caller_number}</p>
                                </div>
                                <div>
                                  <label className="text-sm text-muted-foreground">Phone</label>
                                  <p className="font-medium">{vm.caller_number}</p>
                                </div>
                                <div>
                                  <label className="text-sm text-muted-foreground">Received</label>
                                  <p className="font-medium">
                                    {format(new Date(vm.created_at), "PPpp")}
                                  </p>
                                </div>
                                <div>
                                  <label className="text-sm text-muted-foreground">Duration</label>
                                  <p className="font-medium">{formatDuration(vm.duration_seconds)}</p>
                                </div>
                              </div>

                              {vm.recording_url && (
                                <div>
                                  <label className="text-sm text-muted-foreground mb-2 block">
                                    Recording
                                  </label>
                                  <audio controls className="w-full" src={vm.recording_url} />
                                </div>
                              )}

                              <div>
                                <label className="text-sm text-muted-foreground mb-2 block">
                                  Transcription
                                </label>
                                <div className="p-4 bg-muted rounded-lg">
                                  {vm.transcription || (
                                    <span className="text-muted-foreground italic">
                                      {vm.transcription_status === "pending"
                                        ? "Transcription in progress..."
                                        : "No transcription available"}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex gap-2 pt-4">
                                <Button
                                  onClick={() => {
                                    initiateCall({
                                      destinationPhone: vm.caller_number,
                                      entityType: 'other',
                                      entityName: vm.caller_name || 'Voicemail Caller',
                                    });
                                  }}
                                >
                                  <PhoneCall className="h-4 w-4 mr-2" />
                                  Call Back
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => createFollowUp.mutate(vm)}
                                  disabled={createFollowUp.isPending}
                                >
                                  <MessageSquare className="h-4 w-4 mr-2" />
                                  Create Task
                                </Button>
                                {vm.status !== "resolved" && (
                                  <Button
                                    variant="secondary"
                                    onClick={() => resolveVoicemail.mutate(vm.id)}
                                    disabled={resolveVoicemail.isPending}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Mark Resolved
                                  </Button>
                                )}
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>

                        {vm.status !== "resolved" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => resolveVoicemail.mutate(vm.id)}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
