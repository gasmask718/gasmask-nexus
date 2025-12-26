/**
 * Partner Contacts Tab - Contact management with add/edit
 */
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, Search, User, Phone, Mail, Edit, Trash2,
  Star, Eye
} from 'lucide-react';
import { SimulationBadge, EmptyStateWithGuidance } from '@/contexts/SimulationModeContext';

interface PartnerContactsTabProps {
  partner: any;
  isSimulated: boolean;
}

export default function PartnerContactsTab({ partner, isSimulated }: PartnerContactsTabProps) {
  const navigate = useNavigate();
  const { partnerId } = useParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  const [newContact, setNewContact] = useState({
    name: '',
    role: '',
    phone: '',
    email: '',
    isPrimary: false
  });

  // Simulated contacts
  const [contacts, setContacts] = useState([
    { id: '1', name: partner?.contact_name || 'Primary Contact', role: 'Owner', phone: partner?.phone || '555-555-0101', email: partner?.email || 'owner@partner.com', isPrimary: true },
    { id: '2', name: 'Operations Manager', role: 'Operations', phone: '555-555-0102', email: 'ops@partner.com', isPrimary: false },
    { id: '3', name: 'Booking Coordinator', role: 'Bookings', phone: '555-555-0103', email: 'bookings@partner.com', isPrimary: false },
  ]);

  const filteredContacts = useMemo(() => {
    return contacts.filter((contact: any) => {
      return !searchTerm || 
        contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.role?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.email?.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [contacts, searchTerm]);

  const handleAddContact = () => {
    if (!newContact.name.trim()) return;
    
    const contact = {
      id: `contact-${Date.now()}`,
      ...newContact
    };

    setContacts([...contacts, contact]);
    setNewContact({ name: '', role: '', phone: '', email: '', isPrimary: false });
    setIsAddDialogOpen(false);
  };

  const handleEditContact = (contact: any) => {
    setEditingContact(contact);
    setNewContact({
      name: contact.name,
      role: contact.role,
      phone: contact.phone,
      email: contact.email,
      isPrimary: contact.isPrimary
    });
    setIsAddDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!newContact.name.trim()) return;
    
    setContacts(contacts.map((c: any) => 
      c.id === editingContact.id 
        ? { ...c, ...newContact }
        : c
    ));
    setEditingContact(null);
    setNewContact({ name: '', role: '', phone: '', email: '', isPrimary: false });
    setIsAddDialogOpen(false);
  };

  const handleDeleteContact = (contactId: string) => {
    setContacts(contacts.filter((c: any) => c.id !== contactId));
  };

  const handleViewContact = (contactId: string) => {
    navigate(`/crm/toptier-experience/partners/profile/${partnerId}/contacts/${contactId}`);
  };

  const handleDialogClose = () => {
    setIsAddDialogOpen(false);
    setEditingContact(null);
    setNewContact({ name: '', role: '', phone: '', email: '', isPrimary: false });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          Contacts
          {isSimulated && <SimulationBadge />}
        </h2>
        <Dialog open={isAddDialogOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingContact(null); setNewContact({ name: '', role: '', phone: '', email: '', isPrimary: false }); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingContact ? 'Edit Contact' : 'Add New Contact'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  placeholder="Contact name"
                  value={newContact.name}
                  onChange={(e) => setNewContact({...newContact, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Role / Title</Label>
                <Select value={newContact.role} onValueChange={(v) => setNewContact({...newContact, role: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Owner">Owner</SelectItem>
                    <SelectItem value="Manager">Manager</SelectItem>
                    <SelectItem value="Operations">Operations</SelectItem>
                    <SelectItem value="Bookings">Bookings</SelectItem>
                    <SelectItem value="Finance">Finance</SelectItem>
                    <SelectItem value="Sales">Sales</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  placeholder="Phone number"
                  value={newContact.phone}
                  onChange={(e) => setNewContact({...newContact, phone: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="Email address"
                  value={newContact.email}
                  onChange={(e) => setNewContact({...newContact, email: e.target.value})}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleDialogClose}>Cancel</Button>
              <Button onClick={editingContact ? handleSaveEdit : handleAddContact}>
                {editingContact ? 'Save Changes' : 'Add Contact'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search contacts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Contacts Grid */}
      {filteredContacts.length === 0 ? (
        <EmptyStateWithGuidance
          icon={User}
          title="No Contacts"
          description="Add contacts to manage communication with this partner."
          actionLabel="Add Contact"
          onAction={() => setIsAddDialogOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContacts.map((contact: any) => (
            <Card 
              key={contact.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => handleViewContact(contact.id)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{contact.name}</h3>
                        {contact.isPrimary && (
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        )}
                      </div>
                      <Badge variant="secondary" className="text-xs">{contact.role}</Badge>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  {contact.phone && (
                    <a 
                      href={`tel:${contact.phone}`} 
                      className="flex items-center gap-2 text-muted-foreground hover:text-primary"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Phone className="h-4 w-4" />
                      {contact.phone}
                    </a>
                  )}
                  {contact.email && (
                    <a 
                      href={`mailto:${contact.email}`} 
                      className="flex items-center gap-2 text-muted-foreground hover:text-primary"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Mail className="h-4 w-4" />
                      {contact.email}
                    </a>
                  )}
                </div>

                <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleEditContact(contact); }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  {!contact.isPrimary && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); handleDeleteContact(contact.id); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
