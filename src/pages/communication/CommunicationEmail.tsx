import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Mail, Search } from 'lucide-react';
import { departmentThemes } from '@/config/departmentThemes';
import CommunicationLayout from './CommunicationLayout';

const CommunicationEmail = () => {
  const { currentBusiness } = useBusiness();
  const theme = departmentThemes.communication;
  const [searchTerm, setSearchTerm] = useState('');

  const { data: emails, isLoading } = useQuery({
    queryKey: ['communication-emails', currentBusiness?.id, searchTerm],
    queryFn: async () => {
      if (!currentBusiness?.id) return [];

      const { data } = await supabase
        .from('call_center_emails')
        .select('*')
        .eq('business_name', currentBusiness.name)
        .order('created_at', { ascending: false });

      if (!data) return [];

      if (searchTerm) {
        return data.filter(email => 
          email.from_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          email.to_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          email.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          email.body?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      return data;
    },
    enabled: !!currentBusiness?.id,
  });

  return (
    <CommunicationLayout
      title="Email Management"
      subtitle="View and manage email communications"
    >
      <div className="space-y-6">
        {/* Search */}
        <Card>
          <CardHeader>
            <CardTitle>Search Emails</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by sender, recipient, or subject..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Emails List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading emails...</p>
            ) : emails && emails.length > 0 ? (
              <div className="space-y-3">
                {emails.map((email) => (
                  <div key={email.id} className="p-4 rounded-lg border">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Mail className="h-4 w-4" style={{ color: theme.color }} />
                          <span className="font-medium">{email.subject || '(No Subject)'}</span>
                          <Badge variant={email.direction === 'inbound' ? 'default' : 'secondary'}>
                            {email.direction}
                          </Badge>
                          {email.ai_handled && (
                            <Badge variant="outline">AI Handled</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          From: {email.from_address} → To: {email.to_address}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(email.created_at!).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {email.body || 'No content'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No emails found</p>
            )}
          </CardContent>
        </Card>
      </div>
    </CommunicationLayout>
  );
};

export default CommunicationEmail;
