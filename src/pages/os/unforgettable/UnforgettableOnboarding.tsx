import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { UserPlus, Users, Target, DollarSign, TrendingUp, Phone, Mail, CheckCircle, Clock, ArrowRight, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';

interface OnboardingAgent {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'active' | 'inactive';
  assignedLeads: number;
  convertedLeads: number;
  pendingLeads: number;
  commissionEarned: number;
  conversionRate: number;
  lastActive: string;
  specialization: string[];
}

const SIMULATED_AGENTS: OnboardingAgent[] = [
  {
    id: 'agent-001',
    name: 'Maria Santos',
    email: 'maria.s@unforgettable.com',
    phone: '+1 (305) 555-0101',
    status: 'active',
    assignedLeads: 45,
    convertedLeads: 28,
    pendingLeads: 12,
    commissionEarned: 4200,
    conversionRate: 62,
    lastActive: '2024-01-15T10:30:00Z',
    specialization: ['Event Halls', 'Rental Companies']
  },
  {
    id: 'agent-002',
    name: 'James Wilson',
    email: 'james.w@unforgettable.com',
    phone: '+1 (212) 555-0202',
    status: 'active',
    assignedLeads: 38,
    convertedLeads: 22,
    pendingLeads: 8,
    commissionEarned: 3300,
    conversionRate: 58,
    lastActive: '2024-01-15T11:15:00Z',
    specialization: ['Vendors', 'Staff']
  },
  {
    id: 'agent-003',
    name: 'Lisa Chen',
    email: 'lisa.c@unforgettable.com',
    phone: '+1 (415) 555-0303',
    status: 'active',
    assignedLeads: 52,
    convertedLeads: 35,
    pendingLeads: 10,
    commissionEarned: 5250,
    conversionRate: 67,
    lastActive: '2024-01-15T09:45:00Z',
    specialization: ['Event Halls', 'Vendors', 'Influencers']
  },
  {
    id: 'agent-004',
    name: 'Robert Johnson',
    email: 'robert.j@unforgettable.com',
    phone: '+1 (713) 555-0404',
    status: 'inactive',
    assignedLeads: 20,
    convertedLeads: 8,
    pendingLeads: 5,
    commissionEarned: 1200,
    conversionRate: 40,
    lastActive: '2024-01-10T16:00:00Z',
    specialization: ['Rental Companies']
  },
  {
    id: 'agent-005',
    name: 'Amanda Taylor',
    email: 'amanda.t@unforgettable.com',
    phone: '+1 (404) 555-0505',
    status: 'active',
    assignedLeads: 41,
    convertedLeads: 29,
    pendingLeads: 6,
    commissionEarned: 4350,
    conversionRate: 71,
    lastActive: '2024-01-15T12:00:00Z',
    specialization: ['Staff', 'Event Halls']
  }
];

export default function UnforgettableOnboarding() {
  const navigate = useNavigate();
  const { simulationMode } = useSimulationMode();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const agents = simulationMode ? SIMULATED_AGENTS : [];

  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          agent.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || agent.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    totalAgents: agents.length,
    activeAgents: agents.filter(a => a.status === 'active').length,
    totalLeads: agents.reduce((sum, a) => sum + a.assignedLeads, 0),
    totalConverted: agents.reduce((sum, a) => sum + a.convertedLeads, 0),
    totalCommission: agents.reduce((sum, a) => sum + a.commissionEarned, 0),
    avgConversionRate: Math.round(agents.reduce((sum, a) => sum + a.conversionRate, 0) / agents.length) || 0
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <UserPlus className="h-8 w-8 text-primary" />
            Onboarding Agents
            {simulationMode && <SimulationBadge />}
          </h1>
          <p className="text-muted-foreground">Manage agents who onboard halls, vendors, and staff</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/os/unforgettable')}>
            ← Back
          </Button>
          <Button>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Agent
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Agents</p>
                <p className="text-2xl font-bold">{stats.totalAgents}</p>
              </div>
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-green-400">{stats.activeAgents}</p>
              </div>
              <CheckCircle className="h-6 w-6 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Assigned Leads</p>
                <p className="text-2xl font-bold">{stats.totalLeads}</p>
              </div>
              <Target className="h-6 w-6 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Converted</p>
                <p className="text-2xl font-bold text-blue-400">{stats.totalConverted}</p>
              </div>
              <TrendingUp className="h-6 w-6 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Avg Conv. Rate</p>
                <p className="text-2xl font-bold">{stats.avgConversionRate}%</p>
              </div>
              <TrendingUp className="h-6 w-6 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Commission</p>
                <p className="text-2xl font-bold text-yellow-400">${stats.totalCommission.toLocaleString()}</p>
              </div>
              <DollarSign className="h-6 w-6 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="inactive">Inactive</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Agents List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAgents.map((agent) => (
          <Card key={agent.id} className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{agent.name}</CardTitle>
                <Badge variant={agent.status === 'active' ? 'default' : 'secondary'}>
                  {agent.status}
                </Badge>
              </div>
              <CardDescription>{agent.email}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-1">
                {agent.specialization.map((spec) => (
                  <Badge key={spec} variant="outline" className="text-xs">
                    {spec}
                  </Badge>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold">{agent.assignedLeads}</p>
                  <p className="text-xs text-muted-foreground">Assigned</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-green-400">{agent.convertedLeads}</p>
                  <p className="text-xs text-muted-foreground">Converted</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-yellow-400">{agent.pendingLeads}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Conversion Rate</span>
                  <span className="font-medium">{agent.conversionRate}%</span>
                </div>
                <Progress value={agent.conversionRate} className="h-2" />
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Commission</span>
                <span className="font-medium text-green-400">${agent.commissionEarned.toLocaleString()}</span>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Phone className="h-4 w-4 mr-1" />
                  Call
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <Mail className="h-4 w-4 mr-1" />
                  Email
                </Button>
                <Button size="sm">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredAgents.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <UserPlus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">No Agents Found</h3>
            <p className="text-muted-foreground">
              {simulationMode ? 'No agents match your filters' : 'Enable Simulation Mode to see demo data'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
