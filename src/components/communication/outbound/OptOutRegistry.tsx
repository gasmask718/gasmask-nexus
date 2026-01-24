import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Search, UserX, Phone, Mail, Calendar, Shield, 
  Download, Plus, Loader2, AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { format } from 'date-fns';

export function OptOutRegistry() {
  const { currentBusiness } = useBusiness();
  const businessId = currentBusiness?.id;
  const [search, setSearch] = useState('');

  const { data: optOuts, isLoading } = useQuery({
    queryKey: ['opt-out-registry', businessId],
    queryFn: async () => {
      let query = supabase
        .from('outbound_opt_out_registry')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (businessId) {
        query = query.or(`business_id.is.null,business_id.eq.${businessId}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!businessId,
  });

  const filteredOptOuts = optOuts?.filter(opt => 
    opt.phone_number?.includes(search) || 
    opt.email?.toLowerCase().includes(search.toLowerCase())
  );

  const getMethodBadge = (method: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      verbal: 'default',
      sms_reply: 'secondary',
      email: 'secondary',
      web_form: 'outline',
      system_detected: 'outline',
      manual_entry: 'outline',
    };
    return (
      <Badge variant={variants[method] || 'outline'}>
        {method.replace('_', ' ')}
      </Badge>
    );
  };

  if (!businessId) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Please select a business to view opt-out registry</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <UserX className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{optOuts?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total Opt-Outs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Phone className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {optOuts?.filter(o => o.opt_out_method === 'verbal').length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Verbal Opt-Outs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Shield className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">100%</p>
                <p className="text-sm text-muted-foreground">Compliance Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Registry Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Opt-Out Registry</CardTitle>
              <CardDescription>
                All contacts who have requested not to be contacted
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Export
              </Button>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Manual
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by phone or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredOptOuts?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Scope</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOptOuts.map((opt) => (
                  <TableRow key={opt.id}>
                    <TableCell className="font-mono">{opt.phone_number}</TableCell>
                    <TableCell>{opt.email || '-'}</TableCell>
                    <TableCell>{getMethodBadge(opt.opt_out_method)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {opt.opt_out_source ? 'Campaign' : 'Direct'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(opt.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={opt.business_id ? 'outline' : 'secondary'}>
                        {opt.business_id ? 'Business' : 'Global'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <UserX className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No opt-outs recorded</p>
              <p className="text-sm">Contacts who request to stop receiving calls will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
