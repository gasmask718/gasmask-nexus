import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Phone, Search } from 'lucide-react';
import { departmentThemes } from '@/config/departmentThemes';
import CommunicationLayout from './CommunicationLayout';

const CommunicationCalls = () => {
  const { currentBusiness } = useBusiness();
  const theme = departmentThemes.communication;
  const [searchTerm, setSearchTerm] = useState('');
  const [directionFilter, setDirectionFilter] = useState<string>('all');

  const { data: calls, isLoading } = useQuery({
    queryKey: ['communication-calls', currentBusiness?.id, searchTerm, directionFilter],
    queryFn: async () => {
      if (!currentBusiness?.id) return [];

      let query = supabase
        .from('call_center_logs')
        .select('*')
        .eq('business_name', currentBusiness.name)
        .order('created_at', { ascending: false });

      if (directionFilter !== 'all') {
        query = query.eq('direction', directionFilter);
      }

      const { data } = await query;
      
      if (!data) return [];

      if (searchTerm) {
        return data.filter(call => 
          call.caller_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          call.summary?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      return data;
    },
    enabled: !!currentBusiness?.id,
  });

  return (
    <CommunicationLayout
      title="Call Management"
      subtitle="View and manage all phone communications"
    >
      <div className="space-y-6">
        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search calls..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={directionFilter} onValueChange={setDirectionFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Directions</SelectItem>
                <SelectItem value="inbound">Inbound</SelectItem>
                <SelectItem value="outbound">Outbound</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Calls List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Call Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading calls...</p>
            ) : calls && calls.length > 0 ? (
              <div className="space-y-3">
                {calls.map((call) => (
                  <div key={call.id} className="p-4 rounded-lg border hover:border-primary/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Phone className="h-4 w-4" style={{ color: theme.color }} />
                          <span className="font-medium">{call.caller_id}</span>
                          <Badge variant={call.direction === 'inbound' ? 'default' : 'secondary'}>
                            {call.direction}
                          </Badge>
                          {call.outcome && (
                            <Badge variant="outline">{call.outcome}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{call.summary || 'No summary available'}</p>
                        {call.emotion_detected && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Emotion: {call.emotion_detected}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(call.created_at!).toLocaleString()}
                        </p>
                      </div>
                      {call.duration && (
                        <span className="text-sm text-muted-foreground">
                          {Math.floor(call.duration / 60)}:{(call.duration % 60).toString().padStart(2, '0')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No calls found</p>
            )}
          </CardContent>
        </Card>
      </div>
    </CommunicationLayout>
  );
};

export default CommunicationCalls;
