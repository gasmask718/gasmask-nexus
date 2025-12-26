import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Phone, PhoneIncoming, PhoneOutgoing, Clock, CheckCircle, XCircle, Calendar, User, Building2, FileText, ArrowRight, Play, Search, Filter, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';

interface AICallLog {
  id: string;
  direction: 'inbound' | 'outbound';
  entityType: 'event_hall' | 'rental_company' | 'vendor' | 'staff' | 'customer';
  entityName: string;
  entityId: string;
  phone: string;
  duration: string;
  outcome: 'booked' | 'follow_up' | 'no_answer' | 'declined' | 'voicemail';
  transcript?: string;
  summary?: string;
  createdAt: string;
  agentName: string;
  campaignName?: string;
}

const SIMULATED_CALLS: AICallLog[] = [
  {
    id: 'call-001',
    direction: 'outbound',
    entityType: 'event_hall',
    entityName: 'Grand Ballroom NYC',
    entityId: 'hall-001',
    phone: '+1 (212) 555-0101',
    duration: '4:32',
    outcome: 'booked',
    transcript: 'AI Agent: Hello, this is Dynasty Events calling regarding partnership opportunities...\n\nVenue Manager: Yes, I\'d be interested in hearing more...\n\nAI Agent: Excellent! We specialize in premium event production...',
    summary: 'Successfully pitched partnership. Manager agreed to 15% commission on referrals. Contract to be sent.',
    createdAt: '2024-01-15T10:30:00Z',
    agentName: 'Alex (AI)',
    campaignName: 'NYC Venue Outreach'
  },
  {
    id: 'call-002',
    direction: 'outbound',
    entityType: 'rental_company',
    entityName: 'Elite Party Rentals',
    entityId: 'rental-001',
    phone: '+1 (305) 555-0202',
    duration: '2:15',
    outcome: 'follow_up',
    summary: 'Spoke with assistant. Decision maker unavailable. Scheduled callback for Thursday 2pm.',
    createdAt: '2024-01-15T11:15:00Z',
    agentName: 'Maya (AI)',
    campaignName: 'Miami Rental Partners'
  },
  {
    id: 'call-003',
    direction: 'inbound',
    entityType: 'customer',
    entityName: 'Jennifer Martinez',
    entityId: 'customer-001',
    phone: '+1 (404) 555-0303',
    duration: '6:45',
    outcome: 'booked',
    transcript: 'Customer: Hi, I found you on Instagram and I\'m planning a quinceañera...',
    summary: 'Quinceañera inquiry for August 15th. 150 guests. Budget $8,000. Assigned to event coordinator.',
    createdAt: '2024-01-15T12:00:00Z',
    agentName: 'Carlos (AI)'
  },
  {
    id: 'call-004',
    direction: 'outbound',
    entityType: 'vendor',
    entityName: 'Sparkle Decorations',
    entityId: 'vendor-001',
    phone: '+1 (713) 555-0404',
    duration: '0:45',
    outcome: 'no_answer',
    summary: 'No answer. Left voicemail with callback number.',
    createdAt: '2024-01-15T13:30:00Z',
    agentName: 'Alex (AI)',
    campaignName: 'Texas Vendor Network'
  },
  {
    id: 'call-005',
    direction: 'outbound',
    entityType: 'staff',
    entityName: 'Marcus Johnson',
    entityId: 'staff-001',
    phone: '+1 (312) 555-0505',
    duration: '3:20',
    outcome: 'booked',
    summary: 'DJ confirmed for February 22nd event. Rate: $500. Contract signed digitally.',
    createdAt: '2024-01-15T14:00:00Z',
    agentName: 'Maya (AI)'
  },
  {
    id: 'call-006',
    direction: 'outbound',
    entityType: 'event_hall',
    entityName: 'Sunset Gardens LA',
    entityId: 'hall-002',
    phone: '+1 (213) 555-0606',
    duration: '1:30',
    outcome: 'declined',
    summary: 'Venue not accepting new partnerships at this time. Revisit in Q3.',
    createdAt: '2024-01-15T14:45:00Z',
    agentName: 'Carlos (AI)',
    campaignName: 'LA Venue Expansion'
  },
  {
    id: 'call-007',
    direction: 'inbound',
    entityType: 'customer',
    entityName: 'Robert Chen',
    entityId: 'customer-002',
    phone: '+1 (206) 555-0707',
    duration: '5:10',
    outcome: 'follow_up',
    summary: 'Corporate event inquiry. Needs proposal for 200-person gala. Follow-up scheduled.',
    createdAt: '2024-01-15T15:30:00Z',
    agentName: 'Alex (AI)'
  },
  {
    id: 'call-008',
    direction: 'outbound',
    entityType: 'rental_company',
    entityName: 'Premium Tents & More',
    entityId: 'rental-002',
    phone: '+1 (602) 555-0808',
    duration: '0:30',
    outcome: 'voicemail',
    summary: 'Left detailed voicemail about partnership opportunity.',
    createdAt: '2024-01-15T16:00:00Z',
    agentName: 'Maya (AI)',
    campaignName: 'Southwest Rental Network'
  }
];

const outcomeConfig = {
  booked: { label: 'Booked', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  follow_up: { label: 'Follow-up', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  no_answer: { label: 'No Answer', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  declined: { label: 'Declined', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  voicemail: { label: 'Voicemail', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' }
};

const entityTypeConfig = {
  event_hall: { label: 'Event Hall', icon: Building2 },
  rental_company: { label: 'Rental Co.', icon: Building2 },
  vendor: { label: 'Vendor', icon: Building2 },
  staff: { label: 'Staff', icon: User },
  customer: { label: 'Customer', icon: User }
};

export default function UnforgettableAICalling() {
  const navigate = useNavigate();
  const { simulationMode } = useSimulationMode();
  const [searchQuery, setSearchQuery] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [selectedCall, setSelectedCall] = useState<AICallLog | null>(null);

  const calls = simulationMode ? SIMULATED_CALLS : [];

  const filteredCalls = calls.filter(call => {
    const matchesSearch = call.entityName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          call.phone.includes(searchQuery);
    const matchesOutcome = outcomeFilter === 'all' || call.outcome === outcomeFilter;
    const matchesEntity = entityFilter === 'all' || call.entityType === entityFilter;
    return matchesSearch && matchesOutcome && matchesEntity;
  });

  const stats = {
    totalCalls: calls.length,
    booked: calls.filter(c => c.outcome === 'booked').length,
    followUps: calls.filter(c => c.outcome === 'follow_up').length,
    noAnswer: calls.filter(c => c.outcome === 'no_answer' || c.outcome === 'voicemail').length
  };

  const handleConvertToPartner = (call: AICallLog) => {
    if (call.entityType === 'event_hall') {
      navigate(`/crm/unforgettable_times_usa/event-halls?convert=${call.entityId}`);
    } else if (call.entityType === 'rental_company') {
      navigate(`/crm/unforgettable_times_usa/rentals?convert=${call.entityId}`);
    } else if (call.entityType === 'vendor') {
      navigate(`/crm/unforgettable_times_usa/party-suppliers?convert=${call.entityId}`);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Phone className="h-8 w-8 text-primary" />
            AI Calling Output
            {simulationMode && <SimulationBadge />}
          </h1>
          <p className="text-muted-foreground">Track AI call results from outbound and inbound campaigns</p>
        </div>
        <Button onClick={() => navigate('/os/unforgettable')}>
          ← Back to Dashboard
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Calls</p>
                <p className="text-2xl font-bold">{stats.totalCalls}</p>
              </div>
              <Phone className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Booked</p>
                <p className="text-2xl font-bold text-green-400">{stats.booked}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Follow-ups</p>
                <p className="text-2xl font-bold text-yellow-400">{stats.followUps}</p>
              </div>
              <Calendar className="h-8 w-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">No Answer/VM</p>
                <p className="text-2xl font-bold text-gray-400">{stats.noAnswer}</p>
              </div>
              <XCircle className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Outcome" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Outcomes</SelectItem>
                <SelectItem value="booked">Booked</SelectItem>
                <SelectItem value="follow_up">Follow-up</SelectItem>
                <SelectItem value="no_answer">No Answer</SelectItem>
                <SelectItem value="voicemail">Voicemail</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
              </SelectContent>
            </Select>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Entity Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="event_hall">Event Halls</SelectItem>
                <SelectItem value="rental_company">Rental Companies</SelectItem>
                <SelectItem value="vendor">Vendors</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="customer">Customers</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Call Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Call Logs</CardTitle>
          <CardDescription>AI-powered call results and outcomes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredCalls.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {simulationMode ? 'No calls match your filters' : 'Enable Simulation Mode to see demo data'}
              </div>
            ) : (
              filteredCalls.map((call) => {
                const EntityIcon = entityTypeConfig[call.entityType].icon;
                return (
                  <div
                    key={call.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedCall(call)}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${call.direction === 'inbound' ? 'bg-blue-500/20' : 'bg-green-500/20'}`}>
                        {call.direction === 'inbound' ? (
                          <PhoneIncoming className="h-5 w-5 text-blue-400" />
                        ) : (
                          <PhoneOutgoing className="h-5 w-5 text-green-400" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{call.entityName}</span>
                          <Badge variant="outline" className="text-xs">
                            <EntityIcon className="h-3 w-3 mr-1" />
                            {entityTypeConfig[call.entityType].label}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-3">
                          <span>{call.phone}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {call.duration}
                          </span>
                          <span>{call.agentName}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={outcomeConfig[call.outcome].color}>
                        {outcomeConfig[call.outcome].label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(call.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Call Detail Dialog */}
      <Dialog open={!!selectedCall} onOpenChange={() => setSelectedCall(null)}>
        <DialogContent className="max-w-2xl">
          {selectedCall && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedCall.direction === 'inbound' ? (
                    <PhoneIncoming className="h-5 w-5 text-blue-400" />
                  ) : (
                    <PhoneOutgoing className="h-5 w-5 text-green-400" />
                  )}
                  {selectedCall.entityName}
                </DialogTitle>
                <DialogDescription>
                  Call with {entityTypeConfig[selectedCall.entityType].label} • {selectedCall.phone}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Duration</p>
                    <p className="font-medium">{selectedCall.duration}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Outcome</p>
                    <Badge className={outcomeConfig[selectedCall.outcome].color}>
                      {outcomeConfig[selectedCall.outcome].label}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Agent</p>
                    <p className="font-medium">{selectedCall.agentName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Campaign</p>
                    <p className="font-medium">{selectedCall.campaignName || 'N/A'}</p>
                  </div>
                </div>

                {selectedCall.summary && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Summary</p>
                    <p className="text-sm bg-muted p-3 rounded-lg">{selectedCall.summary}</p>
                  </div>
                )}

                {selectedCall.transcript && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Transcript</p>
                    <pre className="text-xs bg-muted p-3 rounded-lg whitespace-pre-wrap max-h-48 overflow-auto">
                      {selectedCall.transcript}
                    </pre>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1">
                    <Calendar className="h-4 w-4 mr-2" />
                    Assign Follow-up
                  </Button>
                  {['event_hall', 'rental_company', 'vendor'].includes(selectedCall.entityType) && (
                    <Button className="flex-1" onClick={() => handleConvertToPartner(selectedCall)}>
                      <ArrowRight className="h-4 w-4 mr-2" />
                      Convert to Partner
                    </Button>
                  )}
                  {selectedCall.transcript && (
                    <Button variant="outline" size="icon">
                      <Play className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
