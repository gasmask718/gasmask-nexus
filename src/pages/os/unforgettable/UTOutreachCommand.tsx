import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Phone, MessageSquare, Mail, Bot, Plus, Search, TrendingUp, Users, Target, Zap, Filter } from 'lucide-react';
import { useUTPartnerLeads, useUTOutreachLogs, useUTLeadMutations, useUTLeadStats, UTPartnerLead } from '@/hooks/useUTPartnerLeads';
import { UTLeadTable } from '@/components/unforgettable/UTLeadTable';
import { UTOutreachPanel } from '@/components/unforgettable/UTOutreachPanel';
import { UTStatsBar } from '@/components/unforgettable/UTStatsBar';

const CATEGORIES = [
  { value: 'event_hall', label: 'Event Hall' },
  { value: 'decorator', label: 'Decorator' },
  { value: 'bartender', label: 'Bartender' },
  { value: 'caterer', label: 'Caterer' },
  { value: 'dj', label: 'DJ / Musician' },
  { value: 'photographer', label: 'Photographer' },
  { value: 'rental_company', label: 'Rental Company' },
  { value: 'florist', label: 'Florist' },
  { value: 'entertainer', label: 'Entertainer' },
  { value: 'staff', label: 'Staff' },
  { value: 'other', label: 'Other' },
];

export default function UTOutreachCommand() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [citySearch, setCitySearch] = useState('');
  const [selectedLead, setSelectedLead] = useState<UTPartnerLead | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const { data: leads = [], isLoading } = useUTPartnerLeads({
    status: statusFilter || undefined,
    category: categoryFilter || undefined,
    city: citySearch || undefined,
  });
  const { data: stats } = useUTLeadStats();
  const { data: outreachLogs = [] } = useUTOutreachLogs(selectedLead?.id);
  const { createLead, updateLead, logOutreach, deleteLead } = useUTLeadMutations();

  const [newLead, setNewLead] = useState({
    business_name: '',
    contact_name: '',
    category: 'other',
    phone: '',
    email: '',
    city: '',
    state: '',
    source: 'manual',
    notes: '',
  });

  const handleAddLead = () => {
    if (!newLead.business_name.trim()) return;
    createLead.mutate(newLead, {
      onSuccess: () => {
        setShowAddDialog(false);
        setNewLead({ business_name: '', contact_name: '', category: 'other', phone: '', email: '', city: '', state: '', source: 'manual', notes: '' });
      },
    });
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            🎉 Outreach Command Center
          </h1>
          <p className="text-muted-foreground text-sm">Recruit partners • Cold call • SMS • AI outreach</p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Add Lead</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Partner Lead</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Business Name *</Label>
                  <Input value={newLead.business_name} onChange={e => setNewLead(p => ({ ...p, business_name: e.target.value }))} />
                </div>
                <div>
                  <Label>Contact Name</Label>
                  <Input value={newLead.contact_name} onChange={e => setNewLead(p => ({ ...p, contact_name: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Category</Label>
                  <Select value={newLead.category} onValueChange={v => setNewLead(p => ({ ...p, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Source</Label>
                  <Select value={newLead.source} onValueChange={v => setNewLead(p => ({ ...p, source: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="outscraper">Outscraper</SelectItem>
                      <SelectItem value="inbound">Inbound</SelectItem>
                      <SelectItem value="referral">Referral</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Phone</Label>
                  <Input value={newLead.phone} onChange={e => setNewLead(p => ({ ...p, phone: e.target.value }))} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={newLead.email} onChange={e => setNewLead(p => ({ ...p, email: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>City</Label>
                  <Input value={newLead.city} onChange={e => setNewLead(p => ({ ...p, city: e.target.value }))} />
                </div>
                <div>
                  <Label>State</Label>
                  <Input value={newLead.state} onChange={e => setNewLead(p => ({ ...p, state: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={newLead.notes} onChange={e => setNewLead(p => ({ ...p, notes: e.target.value }))} />
              </div>
              <Button onClick={handleAddLead} disabled={createLead.isPending}>
                {createLead.isPending ? 'Adding...' : 'Add Lead'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Bar */}
      <UTStatsBar stats={stats} />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by city..."
            className="pl-9 w-48"
            value={citySearch}
            onChange={e => setCitySearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="interested">Interested</SelectItem>
            <SelectItem value="callback">Callback</SelectItem>
            <SelectItem value="onboarded">Onboarded</SelectItem>
            <SelectItem value="dead">Dead</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={v => setCategoryFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="leads" className="space-y-4">
        <TabsList>
          <TabsTrigger value="leads" className="gap-1"><Users className="h-4 w-4" /> Lead Database ({leads.length})</TabsTrigger>
          <TabsTrigger value="outreach" className="gap-1"><Phone className="h-4 w-4" /> Outreach</TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1"><TrendingUp className="h-4 w-4" /> Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="leads">
          <UTLeadTable
            leads={leads}
            isLoading={isLoading}
            selectedLead={selectedLead}
            onSelectLead={setSelectedLead}
            onUpdateLead={(id, updates) => updateLead.mutate({ id, ...updates })}
            onDeleteLead={(id) => deleteLead.mutate(id)}
            onLogOutreach={(input) => logOutreach.mutate(input)}
            outreachLogs={outreachLogs}
          />
        </TabsContent>

        <TabsContent value="outreach">
          <UTOutreachPanel
            leads={leads}
            onLogOutreach={(input) => logOutreach.mutate(input)}
          />
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">By Category</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(stats?.byCategory || {}).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                    <div key={cat} className="flex justify-between items-center">
                      <span className="text-sm capitalize">{cat.replace('_', ' ')}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Top Cities</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(stats?.byCity || {}).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([city, count]) => (
                    <div key={city} className="flex justify-between items-center">
                      <span className="text-sm">{city}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                  {!Object.keys(stats?.byCity || {}).length && (
                    <p className="text-sm text-muted-foreground">No location data yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
