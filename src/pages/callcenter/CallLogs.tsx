import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, PhoneIncoming, PhoneOutgoing, Play, FileText, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

export default function CallLogs() {
  const [searchTerm, setSearchTerm] = useState('');
  
  const { data: callLogs, isLoading } = useQuery({
    queryKey: ['call-center-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_center_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    }
  });

  const filteredLogs = callLogs?.filter(log => 
    log.caller_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.summary?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Call Logs</h1>
        <p className="text-muted-foreground">View all incoming and outgoing calls</p>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by phone number, business, or summary..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">Loading call logs...</p>
            </CardContent>
          </Card>
        ) : filteredLogs && filteredLogs.length > 0 ? (
          filteredLogs.map((log) => (
            <Card key={log.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {log.direction === 'inbound' ? (
                      <PhoneIncoming className="h-5 w-5 text-green-500" />
                    ) : (
                      <PhoneOutgoing className="h-5 w-5 text-blue-500" />
                    )}
                    <div>
                      <CardTitle className="text-lg">{log.caller_id}</CardTitle>
                      <CardDescription>
                        {log.business_name} • {new Date(log.created_at).toLocaleString()}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <Badge variant={log.direction === 'inbound' ? 'secondary' : 'default'}>
                      {log.direction}
                    </Badge>
                    {log.duration > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {formatDuration(log.duration)}
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {log.summary && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Summary</p>
                      <p className="text-sm">{log.summary}</p>
                    </div>
                  )}
                  
                  <div className="flex flex-wrap gap-2">
                    {log.tags && log.tags.map((tag, idx) => (
                      <Badge key={idx} variant="outline">{tag}</Badge>
                    ))}
                    {log.emotion_detected && (
                      <Badge variant="outline">
                        Emotion: {log.emotion_detected}
                      </Badge>
                    )}
                    {log.answered_by && (
                      <Badge variant="outline">
                        Answered by: {log.answered_by}
                      </Badge>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {log.recording_url && (
                      <Button variant="outline" size="sm">
                        <Play className="h-3 w-3 mr-2" />
                        Play Recording
                      </Button>
                    )}
                    {log.transcript && (
                      <Button variant="outline" size="sm">
                        <FileText className="h-3 w-3 mr-2" />
                        View Transcript
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">
                {searchTerm ? 'No calls match your search' : 'No call logs yet'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}