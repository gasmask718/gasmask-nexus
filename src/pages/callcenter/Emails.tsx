import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Mail, Search, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import CallCenterLayout from "./CallCenterLayout";

export default function Emails() {
  const [searchTerm, setSearchTerm] = useState('');
  
  const { data: emails, isLoading } = useQuery({
    queryKey: ['call-center-emails'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_center_emails')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    }
  });

  const filteredEmails = emails?.filter(email => 
    email.from_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    email.to_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    email.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    email.body?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <CallCenterLayout title="Email Center">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Email Center</h1>
          <p className="text-muted-foreground">Manage all email communications</p>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by email address, subject, or content..."
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
                <p className="text-center text-muted-foreground">Loading emails...</p>
              </CardContent>
            </Card>
          ) : filteredEmails && filteredEmails.length > 0 ? (
            filteredEmails.map((email) => (
              <Card key={email.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {email.direction === 'inbound' ? (
                        <ArrowDownLeft className="h-5 w-5 text-green-500" />
                      ) : (
                        <ArrowUpRight className="h-5 w-5 text-blue-500" />
                      )}
                      <div className="flex-1">
                        <CardTitle className="text-lg">{email.subject || '(No Subject)'}</CardTitle>
                        <CardDescription>
                          {email.direction === 'inbound' ? 'From' : 'To'}: {email.direction === 'inbound' ? email.from_address : email.to_address}
                        </CardDescription>
                        <CardDescription className="mt-1">
                          {email.business_name} • {new Date(email.created_at).toLocaleString()}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <Badge variant={email.direction === 'inbound' ? 'secondary' : 'default'}>
                        {email.direction}
                      </Badge>
                      {email.ai_handled && (
                        <Badge variant="outline">AI Handled</Badge>
                      )}
                      {email.priority && (
                        <Badge variant={email.priority === 'high' ? 'destructive' : 'outline'}>
                          {email.priority}
                        </Badge>
                      )}
                      {email.category && (
                        <Badge variant="outline">{email.category}</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm line-clamp-3 text-muted-foreground">
                    {email.body || '(No content)'}
                  </p>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">
                  {searchTerm ? 'No emails match your search' : 'No emails yet'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </CallCenterLayout>
  );
}
