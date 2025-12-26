/**
 * TopTier All Contacts - Company-wide contacts list
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  ArrowLeft, Search, Eye, Plus, User, Phone, Mail,
  Building2, Star, Users, MessageSquare
} from 'lucide-react';
import { US_STATES } from '@/config/crmBlueprints';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { useCRMSimulation } from '@/hooks/useCRMSimulation';
import { useResolvedData } from '@/hooks/useResolvedData';
import { format } from 'date-fns';

export default function TopTierAllContacts() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');

  const { simulationMode } = useSimulationMode();
  const { getEntityData } = useCRMSimulation('toptier-experience');
  
  const simulatedPartners = getEntityData('partner');
  const { data: partners, isSimulated } = useResolvedData([], simulatedPartners);

  // Generate contacts from all partners
  const allContacts = useMemo(() => {
    const contacts: any[] = [];
    
    partners.forEach((partner: any) => {
      // Add primary contact
      contacts.push({
        id: `contact-${partner.id}-primary`,
        name: partner.contact_name || 'Primary Contact',
        role: 'Owner',
        phone: partner.phone,
        email: partner.email,
        isPrimary: true,
        partner,
        lastInteraction: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      });

      // Add simulated additional contacts for some partners
      if (Math.random() > 0.5) {
        contacts.push({
          id: `contact-${partner.id}-ops`,
          name: `Operations Manager`,
          role: 'Operations',
          phone: partner.phone?.replace(/\d{4}$/, Math.floor(1000 + Math.random() * 9000).toString()),
          email: `ops@${partner.email?.split('@')[1] || 'company.com'}`,
          isPrimary: false,
          partner,
          lastInteraction: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000),
        });
      }
    });

    return contacts;
  }, [partners]);

  // Filter contacts
  const filteredContacts = useMemo(() => {
    return allContacts.filter((contact) => {
      const matchesSearch = searchTerm === '' ||
        contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.partner?.company_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'all' || contact.role === roleFilter;
      const matchesState = stateFilter === 'all' || contact.partner?.state === stateFilter;
      return matchesSearch && matchesRole && matchesState;
    });
  }, [allContacts, searchTerm, roleFilter, stateFilter]);

  // Stats
  const stats = useMemo(() => {
    const primaryCount = allContacts.filter(c => c.isPrimary).length;
    const uniquePartners = new Set(allContacts.map(c => c.partner?.id)).size;
    const recentlyContacted = allContacts.filter(c => {
      const daysSince = (Date.now() - c.lastInteraction.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 7;
    }).length;
    return { total: allContacts.length, primaryCount, uniquePartners, recentlyContacted };
  }, [allContacts]);

  const roles = ['Owner', 'Manager', 'Operations', 'Bookings', 'Finance', 'Sales'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate('/crm/toptier-experience/partners')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">All Contacts</h1>
              {isSimulated && <SimulationBadge />}
            </div>
            <p className="text-muted-foreground">Contact directory across all partners</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Contacts</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Users className="h-8 w-8 text-cyan-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Primary Contacts</p>
                <p className="text-2xl font-bold">{stats.primaryCount}</p>
              </div>
              <Star className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Partners Covered</p>
                <p className="text-2xl font-bold">{stats.uniquePartners}</p>
              </div>
              <Building2 className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Contacted (7d)</p>
                <p className="text-2xl font-bold">{stats.recentlyContacted}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or partner..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {roles.map(role => (
              <SelectItem key={role} value={role}>{role}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="State" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            {US_STATES.map(state => (
              <SelectItem key={state.value} value={state.value}>{state.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Contacts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Contacts ({filteredContacts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredContacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No contacts found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Partner</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Last Interaction</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContacts.map((contact) => (
                    <TableRow 
                      key={contact.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/crm/toptier-experience/partners/profile/${contact.partner?.id}/contacts/${contact.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-medium">{contact.name}</span>
                          {contact.isPrimary && (
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{contact.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <div 
                          className="flex items-center gap-2 cursor-pointer hover:text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/crm/toptier-experience/partners/profile/${contact.partner?.id}`);
                          }}
                        >
                          <Building2 className="h-4 w-4" />
                          {contact.partner?.company_name}
                        </div>
                      </TableCell>
                      <TableCell>
                        {contact.phone && (
                          <a 
                            href={`tel:${contact.phone}`} 
                            className="flex items-center gap-1 text-muted-foreground hover:text-primary"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Phone className="h-3 w-3" />
                            {contact.phone}
                          </a>
                        )}
                      </TableCell>
                      <TableCell>
                        {contact.email && (
                          <a 
                            href={`mailto:${contact.email}`} 
                            className="flex items-center gap-1 text-muted-foreground hover:text-primary"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Mail className="h-3 w-3" />
                            {contact.email}
                          </a>
                        )}
                      </TableCell>
                      <TableCell>
                        {format(contact.lastInteraction, 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/crm/toptier-experience/partners/profile/${contact.partner?.id}/contacts/${contact.id}`);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
