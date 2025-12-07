import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessStore } from '@/stores/businessStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Phone, Mail, Building2, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CustomerSimpleFilters } from '@/components/crm/CustomerSimpleFilters';
import { CustomerSnapshotCard } from '@/components/crm/CustomerSnapshotCard';
import { QuickAddContactForm } from '@/components/crm/QuickAddContactForm';
import { GlobalBusinessSelector } from '@/components/crm/GlobalBusinessSelector';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const CRMContacts = () => {
  const navigate = useNavigate();
  const { selectedBusiness, loading, fetchBusinesses, ensureBusinessSelected } = useBusinessStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);

  // Initialize business on mount
  useEffect(() => {
    fetchBusinesses();
  }, [fetchBusinesses]);

  // Ensure business is selected
  useEffect(() => {
    ensureBusinessSelected();
  }, [ensureBusinessSelected]);

  // ALL HOOKS MUST BE BEFORE ANY CONDITIONAL RETURNS
  const { data: contacts, isLoading, refetch } = useQuery({
    queryKey: ['crm-contacts-list', selectedBusiness?.id],
    queryFn: async () => {
      if (!selectedBusiness?.id) return [];
      
      const { data, error } = await supabase
        .from('crm_contacts')
        .select('*, borough:boroughs(id, name)')
        .eq('business_id', selectedBusiness.id)
        .order('last_contact_date', { ascending: false, nullsFirst: false});
      if (error) throw error;
      return data;
    },
    enabled: !!selectedBusiness?.id,
  });

  // Show loading state
  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading contacts...</p>
        </div>
      </div>
    );
  }

  const filteredContacts = contacts?.filter((contact) => {
    const matchesSearch =
      !searchTerm ||
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.phone?.includes(searchTerm);
    
    const matchesType = typeFilter === 'all' || contact.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || contact.relationship_status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      active: 'default',
      warm: 'secondary',
      cold: 'outline',
      lost: 'destructive',
    };
    const colors: Record<string, string> = {
      active: 'text-green-500',
      warm: 'text-yellow-500',
      cold: 'text-blue-500',
      lost: 'text-red-500',
    };
    return (
      <Badge variant={variants[status] || 'outline'} className={colors[status]}>
        {status}
      </Badge>
    );
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'store': return <Building2 className="h-4 w-4" />;
      case 'driver': return <Phone className="h-4 w-4" />;
      default: return <Mail className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">CRM Contacts</h1>
            <p className="text-muted-foreground mt-1">
              Manage all your business relationships
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <GlobalBusinessSelector />
          <Dialog open={showQuickAdd} onOpenChange={setShowQuickAdd}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Quick Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Quick Add Contact</DialogTitle>
              </DialogHeader>
              <QuickAddContactForm onSuccess={() => {
                setShowQuickAdd(false);
                refetch();
              }} />
            </DialogContent>
          </Dialog>
          <Button onClick={() => navigate('/crm/contacts/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Contact
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <CustomerSimpleFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          typeFilter={typeFilter}
          onTypeChange={setTypeFilter}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
        />
      </Card>

      {selectedContact && (
        <Dialog open={!!selectedContact} onOpenChange={() => setSelectedContact(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Contact Snapshot</DialogTitle>
            </DialogHeader>
            <CustomerSnapshotCard contact={selectedContact} />
          </DialogContent>
        </Dialog>
      )}

      {/* Contacts Table */}
      <Card className="p-6">
        <div className="space-y-3">
          {filteredContacts?.map((contact) => (
            <div
              key={contact.id}
              className="flex items-center justify-between p-4 rounded-lg border hover:bg-secondary/50 cursor-pointer transition-colors"
              onClick={() => navigate(`/crm/contacts/${contact.id}`)}
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="p-2 rounded-lg bg-primary/10">
                  {getTypeIcon(contact.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{contact.name}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {contact.organization && `${contact.organization} · `}
                    {contact.email || contact.phone || 'No contact info'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">
                    Last contact
                  </p>
                  <p className="text-sm font-medium">
                    {contact.last_contact_date
                      ? new Date(contact.last_contact_date).toLocaleDateString()
                      : 'Never'}
                  </p>
                </div>
                <Badge variant="outline" className="capitalize">
                  {contact.type}
                </Badge>
                {getStatusBadge(contact.relationship_status)}
              </div>
            </div>
          ))}
          {(!filteredContacts || filteredContacts.length === 0) && (
            <div className="text-center py-12">
              <UserPlus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                No contacts found. Create your first contact to get started.
              </p>
              <Button onClick={() => setShowQuickAdd(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Contact
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default CRMContacts;
