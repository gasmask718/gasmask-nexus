import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { HeadphonesIcon, MessageSquare, Clock, CheckCircle, AlertCircle, User, Calendar, Search, Filter, Plus, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';

interface Ticket {
  id: string;
  subject: string;
  description: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
  category: 'booking' | 'payment' | 'complaint' | 'inquiry' | 'refund' | 'other';
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  interactions: { date: string; note: string; by: string }[];
}

const SIMULATED_TICKETS: Ticket[] = [
  {
    id: 'TKT-001',
    subject: 'Event date change request',
    description: 'Customer wants to reschedule their wedding reception from March 15 to April 20.',
    customerName: 'Sarah Johnson',
    customerEmail: 'sarah.j@email.com',
    customerPhone: '+1 (305) 555-0101',
    priority: 'high',
    status: 'open',
    category: 'booking',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
    interactions: []
  },
  {
    id: 'TKT-002',
    subject: 'Refund request for cancelled event',
    description: 'Customer is requesting a full refund for their corporate event that was cancelled.',
    customerName: 'Michael Chen',
    customerEmail: 'michael.c@company.com',
    customerPhone: '+1 (212) 555-0202',
    priority: 'urgent',
    status: 'in_progress',
    category: 'refund',
    assignedTo: 'Agent Maria',
    createdAt: '2024-01-14T15:30:00Z',
    updatedAt: '2024-01-15T09:00:00Z',
    interactions: [
      { date: '2024-01-14T16:00:00Z', note: 'Contacted customer to discuss refund policy', by: 'Agent Maria' },
      { date: '2024-01-15T09:00:00Z', note: 'Escalated to finance team for approval', by: 'Agent Maria' }
    ]
  },
  {
    id: 'TKT-003',
    subject: 'Inquiry about package pricing',
    description: 'Potential customer asking about all-inclusive quinceañera packages.',
    customerName: 'Rosa Martinez',
    customerEmail: 'rosa.m@gmail.com',
    customerPhone: '+1 (713) 555-0303',
    priority: 'medium',
    status: 'waiting',
    category: 'inquiry',
    assignedTo: 'Agent James',
    createdAt: '2024-01-13T11:00:00Z',
    updatedAt: '2024-01-14T14:00:00Z',
    interactions: [
      { date: '2024-01-13T12:00:00Z', note: 'Sent pricing brochure via email', by: 'Agent James' },
      { date: '2024-01-14T14:00:00Z', note: 'Waiting for customer response', by: 'Agent James' }
    ]
  },
  {
    id: 'TKT-004',
    subject: 'DJ did not show up to event',
    description: 'Severe complaint - booked DJ failed to appear at birthday party. Customer requesting full compensation.',
    customerName: 'David Williams',
    customerEmail: 'david.w@email.com',
    customerPhone: '+1 (404) 555-0404',
    priority: 'urgent',
    status: 'in_progress',
    category: 'complaint',
    assignedTo: 'Supervisor Lisa',
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2024-01-15T11:00:00Z',
    interactions: [
      { date: '2024-01-15T08:30:00Z', note: 'Called customer to apologize and gather details', by: 'Agent Maria' },
      { date: '2024-01-15T09:00:00Z', note: 'Escalated to supervisor due to severity', by: 'Agent Maria' },
      { date: '2024-01-15T11:00:00Z', note: 'Investigating DJ contractor. Offered 50% refund plus credit.', by: 'Supervisor Lisa' }
    ]
  },
  {
    id: 'TKT-005',
    subject: 'Payment processing issue',
    description: 'Customer says their card was charged twice for deposit.',
    customerName: 'Jennifer Lee',
    customerEmail: 'jennifer.l@email.com',
    customerPhone: '+1 (415) 555-0505',
    priority: 'high',
    status: 'resolved',
    category: 'payment',
    assignedTo: 'Agent James',
    createdAt: '2024-01-12T14:00:00Z',
    updatedAt: '2024-01-13T10:00:00Z',
    interactions: [
      { date: '2024-01-12T14:30:00Z', note: 'Verified duplicate charge in payment system', by: 'Agent James' },
      { date: '2024-01-13T10:00:00Z', note: 'Refund processed for duplicate charge. Customer confirmed receipt.', by: 'Agent James' }
    ]
  }
];

const priorityConfig = {
  low: { label: 'Low', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  medium: { label: 'Medium', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  high: { label: 'High', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  urgent: { label: 'Urgent', color: 'bg-red-500/20 text-red-400 border-red-500/30' }
};

const statusConfig = {
  open: { label: 'Open', color: 'bg-yellow-500/20 text-yellow-400' },
  in_progress: { label: 'In Progress', color: 'bg-blue-500/20 text-blue-400' },
  waiting: { label: 'Waiting', color: 'bg-purple-500/20 text-purple-400' },
  resolved: { label: 'Resolved', color: 'bg-green-500/20 text-green-400' },
  closed: { label: 'Closed', color: 'bg-gray-500/20 text-gray-400' }
};

export default function UnforgettableCustomerService() {
  const navigate = useNavigate();
  const { simulationMode } = useSimulationMode();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const tickets = simulationMode ? SIMULATED_TICKETS : [];

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          ticket.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          ticket.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const stats = {
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    waiting: tickets.filter(t => t.status === 'waiting').length,
    resolved: tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length,
    urgent: tickets.filter(t => t.priority === 'urgent').length
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <HeadphonesIcon className="h-8 w-8 text-primary" />
            Customer Service
            {simulationMode && <SimulationBadge />}
          </h1>
          <p className="text-muted-foreground">Manage support tickets and customer interactions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/os/unforgettable')}>
            ← Back
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Ticket
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="border-yellow-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open</p>
                <p className="text-2xl font-bold text-yellow-400">{stats.open}</p>
              </div>
              <AlertCircle className="h-6 w-6 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold text-blue-400">{stats.inProgress}</p>
              </div>
              <Clock className="h-6 w-6 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-purple-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Waiting</p>
                <p className="text-2xl font-bold text-purple-400">{stats.waiting}</p>
              </div>
              <Clock className="h-6 w-6 text-purple-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Resolved</p>
                <p className="text-2xl font-bold text-green-400">{stats.resolved}</p>
              </div>
              <CheckCircle className="h-6 w-6 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Urgent</p>
                <p className="text-2xl font-bold text-red-400">{stats.urgent}</p>
              </div>
              <AlertCircle className="h-6 w-6 text-red-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="waiting">Waiting</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      <Card>
        <CardHeader>
          <CardTitle>Support Tickets</CardTitle>
          <CardDescription>{filteredTickets.length} tickets</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredTickets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {simulationMode ? 'No tickets match your filters' : 'Enable Simulation Mode to see demo data'}
              </div>
            ) : (
              filteredTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedTicket(ticket)}
                >
                  <div className="flex items-center gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-muted-foreground">{ticket.id}</span>
                        <span className="font-medium">{ticket.subject}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {ticket.customerName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </span>
                        {ticket.assignedTo && (
                          <span>Assigned: {ticket.assignedTo}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={priorityConfig[ticket.priority].color}>
                      {priorityConfig[ticket.priority].label}
                    </Badge>
                    <Badge className={statusConfig[ticket.status].color}>
                      {statusConfig[ticket.status].label}
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedTicket && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="font-mono text-muted-foreground">{selectedTicket.id}</span>
                  {selectedTicket.subject}
                </DialogTitle>
                <DialogDescription>
                  Customer: {selectedTicket.customerName} • {selectedTicket.customerEmail}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Badge className={priorityConfig[selectedTicket.priority].color}>
                    {priorityConfig[selectedTicket.priority].label}
                  </Badge>
                  <Badge className={statusConfig[selectedTicket.status].color}>
                    {statusConfig[selectedTicket.status].label}
                  </Badge>
                  <Badge variant="outline">{selectedTicket.category}</Badge>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-1">Description</p>
                  <p className="text-sm bg-muted p-3 rounded-lg">{selectedTicket.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{selectedTicket.customerPhone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Assigned To</p>
                    <p className="font-medium">{selectedTicket.assignedTo || 'Unassigned'}</p>
                  </div>
                </div>

                {selectedTicket.interactions.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Interaction History</p>
                    <div className="space-y-2">
                      {selectedTicket.interactions.map((interaction, idx) => (
                        <div key={idx} className="text-sm bg-muted p-3 rounded-lg">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>{interaction.by}</span>
                            <span>{new Date(interaction.date).toLocaleString()}</span>
                          </div>
                          <p>{interaction.note}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-sm text-muted-foreground mb-2">Add Response</p>
                  <Textarea placeholder="Type your response..." rows={3} />
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1">Send Response</Button>
                  <Button variant="outline">Escalate</Button>
                  <Button variant="outline">Resolve</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
