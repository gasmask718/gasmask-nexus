import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MessageSquare, Search, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import CallCenterLayout from "./CallCenterLayout";

export default function Messages() {
  const [searchTerm, setSearchTerm] = useState('');
  
  const { data: messages, isLoading } = useQuery({
    queryKey: ['call-center-messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_center_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    }
  });

  const filteredMessages = messages?.filter(msg => 
    msg.from_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.to_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.message_body?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <CallCenterLayout title="Text Messages">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Text Messages</h1>
          <p className="text-muted-foreground">View all SMS conversations</p>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by phone number or message content..."
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
                <p className="text-center text-muted-foreground">Loading messages...</p>
              </CardContent>
            </Card>
          ) : filteredMessages && filteredMessages.length > 0 ? (
            filteredMessages.map((message) => (
              <Card key={message.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {message.direction === 'inbound' ? (
                        <ArrowDownLeft className="h-5 w-5 text-green-500" />
                      ) : (
                        <ArrowUpRight className="h-5 w-5 text-blue-500" />
                      )}
                      <div>
                        <CardTitle className="text-lg">
                          {message.direction === 'inbound' ? message.from_number : message.to_number}
                        </CardTitle>
                        <CardDescription>
                          {message.business_name} • {new Date(message.created_at).toLocaleString()}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <Badge variant={message.direction === 'inbound' ? 'secondary' : 'default'}>
                        {message.direction}
                      </Badge>
                      {message.ai_reply && (
                        <Badge variant="outline">AI Reply</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{message.message_body}</p>
                  {message.media_urls && message.media_urls.length > 0 && (
                    <div className="mt-2 flex gap-2">
                      {message.media_urls.map((url, idx) => (
                        <Badge key={idx} variant="outline">
                          <MessageSquare className="h-3 w-3 mr-1" />
                          Media {idx + 1}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">
                  {searchTerm ? 'No messages match your search' : 'No messages yet'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </CallCenterLayout>
  );
}
