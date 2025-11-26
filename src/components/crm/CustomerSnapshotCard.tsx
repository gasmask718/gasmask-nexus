import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Mail, Building2, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CustomerSnapshotCardProps {
  contact: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    type: string;
    organization?: string | null;
    relationship_status: string;
    last_contact_date?: string | null;
    tags?: string[] | null;
  };
}

export const CustomerSnapshotCard = ({ contact }: CustomerSnapshotCardProps) => {
  const navigate = useNavigate();
  
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-500/10 text-green-500 border-green-500/20',
      warm: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      cold: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      lost: 'bg-red-500/10 text-red-500 border-red-500/20',
    };
    return colors[status] || 'bg-gray-500/10 text-gray-500 border-gray-500/20';
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-lg">{contact.name}</h3>
          {contact.organization && (
            <p className="text-sm text-muted-foreground">{contact.organization}</p>
          )}
        </div>
        <Badge variant="outline" className={getStatusColor(contact.relationship_status)}>
          {contact.relationship_status}
        </Badge>
      </div>

      <div className="space-y-2 text-sm">
        {contact.phone && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-3.5 w-3.5" />
            <span>{contact.phone}</span>
          </div>
        )}
        {contact.email && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-3.5 w-3.5" />
            <span className="truncate">{contact.email}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Building2 className="h-3.5 w-3.5" />
          <span className="capitalize">{contact.type}</span>
        </div>
        {contact.last_contact_date && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>Last contact: {new Date(contact.last_contact_date).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      {contact.tags && contact.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-2 border-t">
          {contact.tags.map((tag, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t">
        <Button 
          size="sm" 
          variant="outline" 
          className="flex-1"
          onClick={() => navigate('/communications-center', {
            state: {
              activeModule: 'va-call',
              contactId: contact.id,
              contactName: contact.name,
              contactPhone: contact.phone
            }
          })}
        >
          <Phone className="w-3.5 h-3.5 mr-1" />
          Call
        </Button>
        <Button 
          size="sm" 
          variant="outline" 
          className="flex-1"
          onClick={() => navigate('/communications-center', {
            state: {
              activeModule: 'email',
              contactEmail: contact.email
            }
          })}
        >
          <Mail className="w-3.5 h-3.5 mr-1" />
          Email
        </Button>
      </div>
    </Card>
  );
};
