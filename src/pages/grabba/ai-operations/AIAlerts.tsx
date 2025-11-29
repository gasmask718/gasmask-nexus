import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle,
  Search,
  Filter,
  CheckCircle,
  Clock,
  XCircle,
  Eye,
  Trash2,
  RefreshCw,
  Shield,
  TrendingDown,
  Package,
  Truck,
  Users,
} from 'lucide-react';
import { useAIAlerts, useAIRecommendations } from '@/hooks/useAIEngine';
import { GrabbaLayout } from '@/components/grabba/GrabbaLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const AIAlerts = () => {
  const { data: alerts, isLoading: alertsLoading, refetch } = useAIAlerts();
  const { data: recommendations } = useAIRecommendations();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const categories = ['fraud', 'inventory', 'delivery', 'payment', 'performance', 'communication'];

  const filteredAlerts = alerts?.filter(alert => {
    const matchesSearch = alert.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         alert.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = severityFilter === 'all' || alert.severity === severityFilter;
    const matchesCategory = categoryFilter === 'all' || alert.category === categoryFilter;
    return matchesSearch && matchesSeverity && matchesCategory;
  });

  const criticalCount = alerts?.filter(a => a.severity === 'critical').length || 0;
  const warningCount = alerts?.filter(a => a.severity === 'warning').length || 0;
  const infoCount = alerts?.filter(a => a.severity === 'info').length || 0;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'fraud': return <Shield className="h-4 w-4" />;
      case 'inventory': return <Package className="h-4 w-4" />;
      case 'delivery': return <Truck className="h-4 w-4" />;
      case 'performance': return <TrendingDown className="h-4 w-4" />;
      case 'communication': return <Users className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const handleDismiss = (alertId: string) => {
    toast.success('Alert dismissed');
  };

  const handleInvestigate = (alertId: string) => {
    toast.info('Opening investigation details...');
  };

  return (
    <GrabbaLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <AlertTriangle className="h-8 w-8 text-primary" />
              AI Alerts & Quality Control
            </h1>
            <p className="text-muted-foreground mt-1">
              System-detected issues requiring attention
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Critical</p>
                  <p className="text-3xl font-bold text-red-500">{criticalCount}</p>
                </div>
                <XCircle className="h-10 w-10 text-red-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Warnings</p>
                  <p className="text-3xl font-bold text-yellow-500">{warningCount}</p>
                </div>
                <Clock className="h-10 w-10 text-yellow-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-500/30 bg-blue-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Info</p>
                  <p className="text-3xl font-bold text-blue-500">{infoCount}</p>
                </div>
                <AlertTriangle className="h-10 w-10 text-blue-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Resolved Today</p>
                  <p className="text-3xl font-bold text-green-500">12</p>
                </div>
                <CheckCircle className="h-10 w-10 text-green-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search alerts..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as typeof severityFilter)}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severity</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat} className="capitalize">{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Alerts List */}
        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">Active Alerts ({filteredAlerts?.length || 0})</TabsTrigger>
            <TabsTrigger value="investigations">Investigations</TabsTrigger>
            <TabsTrigger value="resolved">Resolved</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {alertsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-24 w-full" />)}
                  </div>
                ) : filteredAlerts && filteredAlerts.length > 0 ? (
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-4">
                      {filteredAlerts.map((alert) => (
                        <div
                          key={alert.id}
                          className={`p-4 rounded-lg border ${
                            alert.severity === 'critical'
                              ? 'bg-red-500/5 border-red-500/30'
                              : alert.severity === 'warning'
                              ? 'bg-yellow-500/5 border-yellow-500/30'
                              : 'bg-blue-500/5 border-blue-500/30'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-lg ${
                                alert.severity === 'critical' ? 'bg-red-500/20' :
                                alert.severity === 'warning' ? 'bg-yellow-500/20' : 'bg-blue-500/20'
                              }`}>
                                {getCategoryIcon(alert.category)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant={
                                    alert.severity === 'critical' ? 'destructive' :
                                    alert.severity === 'warning' ? 'secondary' : 'outline'
                                  }>
                                    {alert.severity}
                                  </Badge>
                                  <Badge variant="outline" className="capitalize">{alert.category}</Badge>
                                </div>
                                <h4 className="font-medium">{alert.title}</h4>
                                <p className="text-sm text-muted-foreground mt-1">{alert.description}</p>
                                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                  <span>Entity: {alert.entityType} #{alert.entityId?.slice(0, 8)}</span>
                                  <span>Confidence: {alert.confidence}%</span>
                                  <span>{new Date(alert.createdAt).toLocaleString()}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => handleInvestigate(alert.id)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleDismiss(alert.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-12">
                    <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
                    <h3 className="text-lg font-medium">All Clear!</h3>
                    <p className="text-muted-foreground">No active alerts at this time.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="investigations" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Active Investigations</CardTitle>
                <CardDescription>Auto-generated investigation reports</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Badge>In Progress</Badge>
                      <span className="text-sm text-muted-foreground">Started 2h ago</span>
                    </div>
                    <h4 className="font-medium">Payment Pattern Analysis - Store #1247</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Investigating irregular payment patterns over the last 30 days.
                    </p>
                    <div className="mt-3 p-2 bg-muted rounded">
                      <p className="text-sm">
                        <strong>Findings:</strong> 3 late payments, 1 disputed charge, average delay increased by 5 days
                      </p>
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="secondary">Pending Review</Badge>
                      <span className="text-sm text-muted-foreground">Started 5h ago</span>
                    </div>
                    <h4 className="font-medium">Driver Route Efficiency - Driver #89</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Analyzing delivery time anomalies and route deviations.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resolved" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Resolved Alerts</CardTitle>
                <CardDescription>Recently resolved issues</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="p-4 border rounded-lg bg-green-500/5 border-green-500/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                          <span className="font-medium">Low inventory alert resolved</span>
                        </div>
                        <span className="text-sm text-muted-foreground">{i}h ago</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 ml-7">
                        Restocked Hot Mama - 500 units added to inventory
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </GrabbaLayout>
  );
};

export default AIAlerts;
