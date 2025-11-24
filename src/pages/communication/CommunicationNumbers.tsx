import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Hash, Phone } from 'lucide-react';
import { departmentThemes } from '@/config/departmentThemes';
import { toast } from 'sonner';
import CommunicationLayout from './CommunicationLayout';

const CommunicationNumbers = () => {
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();
  const theme = departmentThemes.communication;

  const { data: phoneNumbers, isLoading } = useQuery({
    queryKey: ['communication-numbers', currentBusiness?.id],
    queryFn: async () => {
      if (!currentBusiness?.id) return [];

      const { data } = await supabase
        .from('call_center_phone_numbers')
        .select('*')
        .eq('business_name', currentBusiness.name)
        .order('label');

      return data || [];
    },
    enabled: !!currentBusiness?.id,
  });

  const toggleNumberMutation = useMutation({
    mutationFn: async ({ numberId, isActive }: { numberId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('call_center_phone_numbers')
        .update({ is_active: isActive })
        .eq('id', numberId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Phone number status updated');
      queryClient.invalidateQueries({ queryKey: ['communication-numbers'] });
    },
    onError: () => {
      toast.error('Failed to update phone number status');
    },
  });

  return (
    <CommunicationLayout
      title="Phone Numbers"
      subtitle="Manage phone numbers assigned to your business"
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              Business Phone Numbers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading phone numbers...</p>
            ) : phoneNumbers && phoneNumbers.length > 0 ? (
              <div className="space-y-4">
                {phoneNumbers.map((number) => (
                  <div key={number.id} className="p-4 rounded-lg border">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Phone className="h-5 w-5" style={{ color: theme.color }} />
                          <h3 className="font-semibold text-lg">{number.phone_number}</h3>
                          <Badge variant={number.is_active ? 'default' : 'secondary'}>
                            {number.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          <span className="font-medium">Label:</span> {number.label}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium">Type:</span> {number.type}
                        </p>
                      </div>
                      <Switch
                        checked={number.is_active || false}
                        onCheckedChange={(checked) => 
                          toggleNumberMutation.mutate({ numberId: number.id, isActive: checked })
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No phone numbers configured. Contact support to add phone numbers to your business.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </CommunicationLayout>
  );
};

export default CommunicationNumbers;
