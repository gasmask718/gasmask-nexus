import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Users, UserPlus, Phone, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VA {
  user_id: string;
  name: string;
  email: string;
  lead_count: number;
}

interface UnassignedLead {
  id: string;
  business_name: string;
  priority_tier: string | null;
  city: string | null;
  state: string | null;
  phone_number: string | null;
}

export default function VARosterPage() {
  const { toast } = useToast();
  const [vas, setVas] = useState<VA[]>([]);
  const [unassignedLeads, setUnassignedLeads] = useState<UnassignedLead[]>([]);
  const [selectedVa, setSelectedVa] = useState<string>('');
  const [selectedLead, setSelectedLead] = useState<string>('');
  const [assigning, setAssigning] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);

    // Get VAs from user_roles
    const { data: vaRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'va' as any);

    if (vaRoles?.length) {
      const vaIds = vaRoles.map(r => r.user_id);

      // Get profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', vaIds);

      // Get lead counts per VA
      const { data: leadCounts } = await supabase
        .from('brandaro_qualified_leads')
        .select('assigned_va')
        .in('assigned_va', vaIds);

      const countMap: Record<string, number> = {};
      leadCounts?.forEach(l => {
        if (l.assigned_va) {
          countMap[l.assigned_va] = (countMap[l.assigned_va] || 0) + 1;
        }
      });

      setVas(
        (profiles || []).map(p => ({
          user_id: p.id,
          name: p.name || p.email || 'Unknown VA',
          email: p.email || '',
          lead_count: countMap[p.id] || 0,
        }))
      );
    } else {
      setVas([]);
    }

    // Get unassigned leads
    const { data: leads } = await supabase
      .from('brandaro_qualified_leads')
      .select('id, business_name, priority_tier, city, state, phone_number')
      .is('assigned_va', null)
      .order('priority_score', { ascending: false })
      .limit(100);

    setUnassignedLeads(leads || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleAssign = async () => {
    if (!selectedVa || !selectedLead) return;
    setAssigning(true);
    const { error } = await supabase
      .from('brandaro_qualified_leads')
      .update({ assigned_va: selectedVa } as any)
      .eq('id', selectedLead);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Lead assigned', description: 'Lead has been assigned to the VA.' });
      setSelectedLead('');
      fetchData();
    }
    setAssigning(false);
  };

  const tierColor = (tier: string | null) => {
    if (tier === 'hot') return 'bg-red-500/20 text-red-400';
    if (tier === 'warm') return 'bg-amber-500/20 text-amber-400';
    return 'bg-blue-500/20 text-blue-400';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> VA Roster
          </h1>
          <p className="text-sm text-muted-foreground">Manage VAs and manually assign leads</p>
        </div>
        <Badge variant="outline" className="text-xs">
          {vas.length} Active VAs · {unassignedLeads.length} Unassigned Leads
        </Badge>
      </div>

      {/* VA Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vas.map(va => (
          <Card key={va.user_id} className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="truncate">{va.name}</span>
                <Badge variant="secondary" className="text-xs">{va.lead_count} leads</Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground truncate">{va.email}</p>
            </CardHeader>
            <CardContent className="pt-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="w-full gap-2" onClick={() => setSelectedVa(va.user_id)}>
                    <UserPlus className="h-3.5 w-3.5" /> Assign Lead
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Assign Lead to {va.name}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <Select value={selectedLead} onValueChange={setSelectedLead}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an unassigned lead..." />
                      </SelectTrigger>
                      <SelectContent>
                        {unassignedLeads.map(lead => (
                          <SelectItem key={lead.id} value={lead.id}>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] px-1 rounded ${tierColor(lead.priority_tier)}`}>
                                {lead.priority_tier?.toUpperCase() || 'NEW'}
                              </span>
                              {lead.business_name} — {lead.city}, {lead.state}
                            </div>
                          </SelectItem>
                        ))}
                        {unassignedLeads.length === 0 && (
                          <SelectItem value="none" disabled>No unassigned leads</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <Button
                      className="w-full"
                      disabled={!selectedLead || assigning}
                      onClick={handleAssign}
                    >
                      {assigning ? 'Assigning...' : 'Confirm Assignment'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        ))}
        {vas.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground col-span-3 text-center py-8">
            No VAs found. Users need the "va" role to appear here.
          </p>
        )}
      </div>

      {/* Unassigned Leads Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" /> Unassigned Leads ({unassignedLeads.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto max-h-96">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Business</th>
                  <th className="pb-2 font-medium">Location</th>
                  <th className="pb-2 font-medium">Priority</th>
                  <th className="pb-2 font-medium">Phone</th>
                </tr>
              </thead>
              <tbody>
                {unassignedLeads.slice(0, 25).map(lead => (
                  <tr key={lead.id} className="border-b border-border/30">
                    <td className="py-2">{lead.business_name}</td>
                    <td className="py-2 text-muted-foreground">{lead.city}, {lead.state}</td>
                    <td className="py-2">
                      <Badge className={`text-[10px] ${tierColor(lead.priority_tier)}`}>
                        {lead.priority_tier?.toUpperCase() || 'NEW'}
                      </Badge>
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {lead.phone_number ? <Phone className="h-3 w-3 inline" /> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
