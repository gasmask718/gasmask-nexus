import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User, Users, Phone, MessageSquare, Star, Crown, Briefcase } from 'lucide-react';
import { toast } from 'sonner';

interface StoreContact {
  id: string;
  store_id: string;
  name: string;
  role: string;
  phone: string;
  is_primary: boolean;
  can_receive_sms: boolean;
  email: string | null;
}

interface StorePeopleSectionProps {
  storeId: string;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  WORKER: 'Worker',
  OWNER_SON: "Owner's Son",
  OWNER_BROTHER: "Owner's Brother",
  OWNER_COUSIN: "Owner's Cousin",
  OWNER_NEPHEW: "Owner's Nephew",
  OWNER_UNCLE: "Owner's Uncle",
  OTHER: 'Other',
  owner: 'Owner',
  manager: 'Manager',
  worker: 'Worker',
};

export function StorePeopleSection({ storeId }: StorePeopleSectionProps) {
  const { data: contacts, isLoading } = useQuery({
    queryKey: ['store-people', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_contacts')
        .select('*')
        .eq('store_id', storeId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as StoreContact[];
    },
  });

  const handleCall = (phone: string, name: string) => {
    if (!phone) {
      toast.error('No phone number available');
      return;
    }
    window.open(`tel:${phone}`);
  };

  const handleText = (phone: string, name: string) => {
    if (!phone) {
      toast.error('No phone number available');
      return;
    }
    window.open(`sms:${phone}`);
  };

  if (isLoading) {
    return (
      <Card className="glass-card border-border/50">
        <CardContent className="flex items-center justify-center py-8">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  // Categorize contacts
  const owners = contacts?.filter(c => 
    c.role?.toLowerCase().includes('owner')
  ) || [];
  
  const workers = contacts?.filter(c => 
    ['worker', 'manager'].includes(c.role?.toLowerCase())
  ) || [];
  
  const others = contacts?.filter(c => 
    !c.role?.toLowerCase().includes('owner') && 
    !['worker', 'manager'].includes(c.role?.toLowerCase())
  ) || [];

  const renderContactCard = (contact: StoreContact) => (
    <div
      key={contact.id}
      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30"
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{contact.name}</span>
            {contact.is_primary && (
              <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                <Star className="h-3 w-3 mr-1" />
                Primary
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary" className="text-xs">
              {ROLE_LABELS[contact.role] || contact.role}
            </Badge>
            {contact.phone && (
              <span className="flex items-center gap-1">
                {contact.phone}
                {contact.can_receive_sms && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0 text-green-600 border-green-500/30">
                    SMS
                  </Badge>
                )}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleCall(contact.phone, contact.name)}
          disabled={!contact.phone}
          title="Call"
        >
          <Phone className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleText(contact.phone, contact.name)}
          disabled={!contact.phone || !contact.can_receive_sms}
          title={contact.can_receive_sms ? "Text" : "SMS not enabled"}
        >
          <MessageSquare className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Owners Section */}
      <Card className="glass-card border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Crown className="h-5 w-5 text-amber-500" />
            Owners
            <Badge variant="secondary" className="ml-auto">{owners.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {owners.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No owners added yet</p>
          ) : (
            <div className="space-y-2">
              {owners.map(renderContactCard)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workers Section */}
      <Card className="glass-card border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Briefcase className="h-5 w-5 text-blue-500" />
            Workers & Managers
            <Badge variant="secondary" className="ml-auto">{workers.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {workers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No workers added yet</p>
          ) : (
            <div className="space-y-2">
              {workers.map(renderContactCard)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Other Contacts */}
      {others.length > 0 && (
        <Card className="glass-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-muted-foreground" />
              Other Contacts
              <Badge variant="secondary" className="ml-auto">{others.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {others.map(renderContactCard)}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
