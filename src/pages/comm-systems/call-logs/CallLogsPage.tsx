import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Phone, PhoneIncoming, PhoneOutgoing, Play, FileText, Search, 
  Filter, Download, MoreVertical, Calendar, Clock, User, Bot,
  AlertTriangle, CheckCircle, XCircle, MessageSquare, Zap
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/contexts/BusinessContext";
import CommSystemsLayout from "../CommSystemsLayout";
import { format } from "date-fns";

export default function CallLogsPage() {
  const { currentBusiness } = useBusiness();
  const [searchTerm, setSearchTerm] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [directionFilter, setDirectionFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState<any>(null);
  
  const { data: callLogs, isLoading } = useQuery({
    queryKey: ['comm-call-logs', currentBusiness?.id],
    queryFn: async () => {
      const query = supabase
        .from('call_center_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      
      if (currentBusiness?.id) {
        query.eq('business_name', currentBusiness.name);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  const filteredLogs = callLogs?.filter(log => {
    const matchesSearch = 
      log.caller_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.summary?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesOutcome = outcomeFilter === 'all' || log.outcome === outcomeFilter;
    const matchesDirection = directionFilter === 'all' || log.direction === directionFilter;
    const matchesAgent = agentFilter === 'all' || log.answered_by === agentFilter;
    
    return matchesSearch && matchesOutcome && matchesDirection && matchesAgent;
  });

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getOutcomeBadge = (outcome: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
      completed: { variant: 'default', icon: CheckCircle },
      'no answer': { variant: 'secondary', icon: XCircle },
      voicemail: { variant: 'outline', icon: MessageSquare },
      busy: { variant: 'secondary', icon: Phone },
      'callback scheduled': { variant: 'default', icon: Calendar },
    };
    const config = variants[outcome?.toLowerCase()] || { variant: 'outline', icon: Phone };
    const IconComponent = config.icon;
    return (
      <Badge variant={config.variant} className="capitalize">
        <IconComponent className="h-3 w-3 mr-1" />
        {outcome || 'Unknown'}
      </Badge>
    );
  };

  const stats = {
    total: callLogs?.length || 0,
    inbound: callLogs?.filter(l => l.direction === 'inbound').length || 0,
    outbound: callLogs?.filter(l => l.direction === 'outbound').length || 0,
    aiHandled: callLogs?.filter(l => l.answered_by === 'ai').length || 0,
    avgDuration: callLogs?.length 
      ? Math.round((callLogs.reduce((sum, l) => sum + (l.duration || 0), 0) / callLogs.length)) 
      : 0,
  };

  return (
    <CommSystemsLayout title="Call Logs" subtitle="Permanent call history with full audit trail">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Total Calls</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{stats.inbound}</div>
            <p className="text-xs text-muted-foreground">Inbound</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-600">{stats.outbound}</div>
            <p className="text-xs text-muted-foreground">Outbound</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-purple-600">{stats.aiHandled}</div>
            <p className="text-xs text-muted-foreground">AI Handled</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{formatDuration(stats.avgDuration)}</div>
            <p className="text-xs text-muted-foreground">Avg Duration</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by phone, business, or summary..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={directionFilter} onValueChange={setDirectionFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Direction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Directions</SelectItem>
                <SelectItem value="inbound">Inbound</SelectItem>
                <SelectItem value="outbound">Outbound</SelectItem>
              </SelectContent>
            </Select>
            <Select value={agentFilter} onValueChange={setAgentFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                <SelectItem value="ai">AI</SelectItem>
                <SelectItem value="human">Human</SelectItem>
              </SelectContent>
            </Select>
            <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Outcome" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Outcomes</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="no answer">No Answer</SelectItem>
                <SelectItem value="voicemail">Voicemail</SelectItem>
                <SelectItem value="busy">Busy</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Call Logs Table */}
      <div className="space-y-3">
        {isLoading ? (
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-muted-foreground">Loading call logs...</p>
            </CardContent>
          </Card>
        ) : filteredLogs && filteredLogs.length > 0 ? (
          filteredLogs.map((log) => (
            <Card key={log.id} className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setSelectedLog(log)}>
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  {/* Direction Icon */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    log.direction === 'inbound' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                  }`}>
                    {log.direction === 'inbound' ? (
                      <PhoneIncoming className="h-5 w-5" />
                    ) : (
                      <PhoneOutgoing className="h-5 w-5" />
                    )}
                  </div>

                  {/* Main Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold truncate">{log.caller_id}</span>
                      {log.answered_by === 'ai' && (
                        <Badge variant="secondary" className="text-xs">
                          <Bot className="h-3 w-3 mr-1" />AI
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{log.business_name}</span>
                      <span>•</span>
                      <span>{format(new Date(log.created_at), 'MMM d, yyyy h:mm a')}</span>
                    </div>
                  </div>

                  {/* Duration */}
                  <div className="text-center min-w-[60px]">
                    <div className="font-mono text-sm">{formatDuration(log.duration)}</div>
                    <p className="text-xs text-muted-foreground">duration</p>
                  </div>

                  {/* Outcome */}
                  <div className="min-w-[120px]">
                    {getOutcomeBadge(log.outcome)}
                  </div>

                  {/* Tags */}
                  <div className="hidden md:flex gap-1 min-w-[150px]">
                    {log.tags?.slice(0, 2).map((tag: string, idx: number) => (
                      <Badge key={idx} variant="outline" className="text-xs">{tag}</Badge>
                    ))}
                    {log.tags?.length > 2 && (
                      <Badge variant="outline" className="text-xs">+{log.tags.length - 2}</Badge>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {log.recording_url && (
                      <Button variant="ghost" size="icon">
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                    {log.transcript && (
                      <Button variant="ghost" size="icon">
                        <FileText className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Summary (if exists) */}
                {log.summary && (
                  <div className="mt-3 pl-14">
                    <p className="text-sm text-muted-foreground line-clamp-1">{log.summary}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <Phone className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>{searchTerm ? 'No calls match your search' : 'No call logs yet'}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Call Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedLog?.direction === 'inbound' ? (
                <PhoneIncoming className="h-5 w-5 text-green-600" />
              ) : (
                <PhoneOutgoing className="h-5 w-5 text-blue-600" />
              )}
              Call Details
            </DialogTitle>
            <DialogDescription>
              {selectedLog?.caller_id} • {selectedLog?.created_at && format(new Date(selectedLog.created_at), 'PPpp')}
            </DialogDescription>
          </DialogHeader>
          
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Business</p>
                  <p className="font-medium">{selectedLog.business_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="font-medium">{formatDuration(selectedLog.duration)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Direction</p>
                  <p className="font-medium capitalize">{selectedLog.direction}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Answered By</p>
                  <p className="font-medium capitalize">{selectedLog.answered_by || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Outcome</p>
                  {getOutcomeBadge(selectedLog.outcome)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sentiment</p>
                  <Badge variant="outline">{selectedLog.emotion_detected || 'Neutral'}</Badge>
                </div>
              </div>

              {selectedLog.summary && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Summary</p>
                  <p className="text-sm bg-muted p-3 rounded">{selectedLog.summary}</p>
                </div>
              )}

              {selectedLog.tags?.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedLog.tags.map((tag: string, idx: number) => (
                      <Badge key={idx} variant="outline">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t">
                {selectedLog.recording_url && (
                  <Button variant="outline">
                    <Play className="h-4 w-4 mr-2" />
                    Play Recording
                  </Button>
                )}
                {selectedLog.transcript && (
                  <Button variant="outline">
                    <FileText className="h-4 w-4 mr-2" />
                    View Transcript
                  </Button>
                )}
                <Button variant="outline">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Add Notes
                </Button>
                <Button variant="outline">
                  <Zap className="h-4 w-4 mr-2" />
                  Convert to Task
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </CommSystemsLayout>
  );
}
