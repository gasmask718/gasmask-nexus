import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Trash2, Phone, MessageSquare, AlertCircle } from 'lucide-react';

interface Contact {
  id?: string;
  name: string;
  role: string;
  phone: string;
  responsiveByCall: boolean;
  responsiveByText: boolean;
  lastResponded: string | null;
  notes: string;
}

interface ContactsTabProps {
  contacts: Contact[];
  onContactsChange: (contacts: Contact[]) => void;
  portalType: 'driver' | 'biker';
}

export function ContactsTab({ contacts, onContactsChange, portalType }: ContactsTabProps) {
  const addContact = () => {
    onContactsChange([
      ...contacts,
      {
        name: '',
        role: 'owner',
        phone: '',
        responsiveByCall: false,
        responsiveByText: false,
        lastResponded: null,
        notes: '',
      },
    ]);
  };

  const updateContact = (index: number, updates: Partial<Contact>) => {
    const newContacts = [...contacts];
    newContacts[index] = { ...newContacts[index], ...updates };
    onContactsChange(newContacts);
  };

  const removeContact = (index: number) => {
    onContactsChange(contacts.filter((_, i) => i !== index));
  };

  const roles = ['owner', 'manager', 'employee', 'other'];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Store Contacts
            </CardTitle>
            <CardDescription>
              Manage contact information and responsiveness status
              {portalType === 'biker' && (
                <span className="block text-amber-600 mt-1">
                  Bikers: Please verify phone numbers for non-responsive contacts
                </span>
              )}
            </CardDescription>
          </div>
          <Button onClick={addContact} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" />
            Add Contact
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {contacts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No contacts yet. Add the first contact.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {contacts.map((contact, index) => {
              const isNonResponsive = !contact.responsiveByCall && !contact.responsiveByText;
              
              return (
                <div 
                  key={contact.id || index} 
                  className={`p-4 rounded-lg border space-y-4 ${
                    isNonResponsive ? 'border-destructive/50 bg-destructive/5' : ''
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={isNonResponsive ? 'destructive' : 'secondary'}>
                        Contact #{index + 1}
                      </Badge>
                      {isNonResponsive && (
                        <div className="flex items-center gap-1 text-xs text-destructive">
                          <AlertCircle className="h-3 w-3" />
                          Non-responsive
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeContact(index)}
                      className="h-8 w-8 text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Basic Info */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        value={contact.name}
                        onChange={(e) => updateContact(index, { name: e.target.value })}
                        placeholder="Contact name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select
                        value={contact.role}
                        onValueChange={(value) => updateContact(index, { role: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((role) => (
                            <SelectItem key={role} value={role}>
                              {role.charAt(0).toUpperCase() + role.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Phone Number</Label>
                      <Input
                        value={contact.phone}
                        onChange={(e) => updateContact(index, { phone: e.target.value })}
                        placeholder="(555) 123-4567"
                        type="tel"
                      />
                    </div>
                  </div>

                  {/* Responsiveness */}
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg border flex-1 min-w-[200px]">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor={`call-${index}`} className="flex-1 cursor-pointer">
                        Responsive by Call
                      </Label>
                      <Switch
                        id={`call-${index}`}
                        checked={contact.responsiveByCall}
                        onCheckedChange={(checked) => updateContact(index, { responsiveByCall: checked })}
                      />
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg border flex-1 min-w-[200px]">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor={`text-${index}`} className="flex-1 cursor-pointer">
                        Responsive by Text
                      </Label>
                      <Switch
                        id={`text-${index}`}
                        checked={contact.responsiveByText}
                        onCheckedChange={(checked) => updateContact(index, { responsiveByText: checked })}
                      />
                    </div>
                  </div>

                  {/* Last Responded */}
                  {contact.lastResponded && (
                    <p className="text-xs text-muted-foreground">
                      Last responded: {new Date(contact.lastResponded).toLocaleDateString()}
                    </p>
                  )}

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={contact.notes}
                      onChange={(e) => updateContact(index, { notes: e.target.value })}
                      placeholder="Any notes about this contact..."
                      rows={2}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
