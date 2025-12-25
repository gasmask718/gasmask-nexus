import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, 
  BreadcrumbPage, BreadcrumbSeparator 
} from '@/components/ui/breadcrumb';
import { ArrowLeft, AlertTriangle, MapPin, Clock, ChevronRight, Store, Eye } from 'lucide-react';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { SimulationBanner } from '@/components/delivery/SimulationModeToggle';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Simulation data for issues
const SIMULATED_ISSUES = [
  {
    id: 'issue-1',
    storeId: 'st-1',
    storeName: 'Brooklyn Smoke Shop',
    issueType: 'Store Closed',
    severity: 'medium',
    status: 'resolved',
    reportedAt: new Date(Date.now() - 86400000).toISOString(),
    routeId: 'RT-SIM-101',
    description: 'Store was closed during delivery window. Left package with neighbor.',
  },
  {
    id: 'issue-2',
    storeId: 'st-5',
    storeName: 'Sunset Smoke',
    issueType: 'Access Problem',
    severity: 'low',
    status: 'resolved',
    reportedAt: new Date(Date.now() - 172800000).toISOString(),
    routeId: 'RT-SIM-101',
    description: 'Gate code changed. Had to wait for manager to arrive.',
  },
  {
    id: 'issue-3',
    storeId: 'st-13',
    storeName: 'Forest Hills Tobacco',
    issueType: 'Damaged Goods',
    severity: 'high',
    status: 'pending',
    reportedAt: new Date(Date.now() - 259200000).toISOString(),
    routeId: 'RT-SIM-099',
    description: 'Multiple boxes showed water damage upon delivery. Customer refused partial order.',
  },
  {
    id: 'issue-4',
    storeId: 'st-17',
    storeName: 'Hunts Point Vape',
    issueType: 'Wrong Address',
    severity: 'low',
    status: 'resolved',
    reportedAt: new Date(Date.now() - 345600000).toISOString(),
    routeId: 'RT-SIM-088',
    description: 'Address in system was outdated. Store moved across street.',
  },
  {
    id: 'issue-5',
    storeId: 'st-24',
    storeName: 'East Village Vape',
    issueType: 'Customer Complaint',
    severity: 'medium',
    status: 'in_progress',
    reportedAt: new Date(Date.now() - 432000000).toISOString(),
    routeId: 'RT-SIM-075',
    description: 'Customer claims missing items from delivery. Need to verify with warehouse.',
  },
  {
    id: 'issue-6',
    storeId: 'st-29',
    storeName: 'Bushwick Vape',
    issueType: 'Parking Issue',
    severity: 'low',
    status: 'resolved',
    reportedAt: new Date(Date.now() - 518400000).toISOString(),
    routeId: 'RT-SIM-062',
    description: 'No parking available. Had to double park and received ticket.',
  },
  {
    id: 'issue-7',
    storeId: 'st-2',
    storeName: 'Kings County Tobacco',
    issueType: 'Inventory Mismatch',
    severity: 'high',
    status: 'pending',
    reportedAt: new Date(Date.now() - 604800000).toISOString(),
    routeId: 'RT-SIM-101',
    description: 'Delivered quantity does not match invoice. Short by 2 cases.',
  },
  {
    id: 'issue-8',
    storeId: 'st-22',
    storeName: 'Harlem Tobacco',
    issueType: 'Late Delivery',
    severity: 'medium',
    status: 'resolved',
    reportedAt: new Date(Date.now() - 691200000).toISOString(),
    routeId: 'RT-SIM-075',
    description: 'Traffic delays caused 2 hour late delivery. Customer was upset.',
  },
  {
    id: 'issue-9',
    storeId: 'st-10',
    storeName: 'Astoria Smoke',
    issueType: 'Vehicle Issue',
    severity: 'high',
    status: 'resolved',
    reportedAt: new Date(Date.now() - 777600000).toISOString(),
    routeId: 'RT-SIM-099',
    description: 'Flat tire during route. Had to wait for roadside assistance.',
  },
];

const DriverIssuesReported: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { simulationMode } = useSimulationMode();
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);

  // Fetch real issues data
  const { data: realIssues = [] } = useQuery({
    queryKey: ['driver-reported-issues', user?.id],
    queryFn: async (): Promise<any[]> => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('biker_issues')
        .select('id, issue_type, severity, status, created_at, description, store_id')
        .eq('reported_by', user.id)
        .order('created_at', { ascending: false });
      if (error) return [];
      return data || [];
    },
    enabled: !!user?.id,
  });

  const hasRealData = realIssues.length > 0;
  const showSimulated = simulationMode && !hasRealData;
  const resolvedIssues: any[] = hasRealData ? realIssues : (showSimulated ? SIMULATED_ISSUES : []);

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'high':
        return <Badge variant="destructive">High</Badge>;
      case 'medium':
        return <Badge variant="default" className="bg-yellow-600">Medium</Badge>;
      case 'low':
        return <Badge variant="secondary">Low</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':
        return <Badge variant="default" className="bg-green-600">Resolved</Badge>;
      case 'in_progress':
        return <Badge variant="default" className="bg-blue-600">In Progress</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const selectedIssueData = resolvedIssues.find((i: any) => i.id === selectedIssue);

  return (
    <Layout>
      <SimulationBanner />
      <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-5xl">
        {/* Breadcrumbs */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink onClick={() => navigate('/delivery/driver')} className="cursor-pointer">
                Driver OS
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Issues Reported</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/delivery/driver')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
                Issues Reported
                {showSimulated && <SimulationBadge className="ml-2" />}
              </h1>
              <p className="text-muted-foreground">All issues you've reported during deliveries</p>
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{resolvedIssues.length}</div>
              <p className="text-sm text-muted-foreground">Total Issues</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">
                {resolvedIssues.filter((i: any) => i.severity === 'high').length}
              </div>
              <p className="text-sm text-muted-foreground">High Severity</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {resolvedIssues.filter((i: any) => i.status === 'pending' || i.status === 'in_progress').length}
              </div>
              <p className="text-sm text-muted-foreground">Open</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {resolvedIssues.filter((i: any) => i.status === 'resolved').length}
              </div>
              <p className="text-sm text-muted-foreground">Resolved</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Issues List */}
          <div className="space-y-2">
            <h2 className="text-lg font-semibold mb-3">All Issues</h2>
            {resolvedIssues.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No issues reported</p>
                  <p className="text-sm text-muted-foreground mt-1">Issues you report will appear here</p>
                </CardContent>
              </Card>
            ) : (
              resolvedIssues.map((issue: any) => {
                const storeName = issue.storeName || issue.store?.store_name || 'Unknown Store';
                const issueType = issue.issueType || issue.issue_type || 'Unknown';
                const reportedAt = issue.reportedAt || issue.created_at;
                const isSelected = selectedIssue === issue.id;

                return (
                  <Card 
                    key={issue.id} 
                    className={`hover:bg-muted/50 transition-colors cursor-pointer ${isSelected ? 'ring-2 ring-primary' : ''}`}
                    onClick={() => setSelectedIssue(issue.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                            issue.severity === 'high' ? 'bg-red-100 dark:bg-red-900/30' :
                            issue.severity === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                            'bg-blue-100 dark:bg-blue-900/30'
                          }`}>
                            <AlertTriangle className={`h-5 w-5 ${
                              issue.severity === 'high' ? 'text-red-600 dark:text-red-400' :
                              issue.severity === 'medium' ? 'text-yellow-600 dark:text-yellow-400' :
                              'text-blue-600 dark:text-blue-400'
                            }`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{issueType}</p>
                              {showSimulated && <SimulationBadge text="Demo" />}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Store className="h-3 w-3" />
                              <span>{storeName}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {reportedAt ? new Date(reportedAt).toLocaleDateString() : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getSeverityBadge(issue.severity)}
                          {getStatusBadge(issue.status)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {/* Issue Detail Panel */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Issue Details</h2>
            {selectedIssueData ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    {selectedIssueData.issueType || selectedIssueData.issue_type}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    {getSeverityBadge(selectedIssueData.severity)}
                    {getStatusBadge(selectedIssueData.status)}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Store</p>
                      <p 
                        className="text-primary cursor-pointer hover:underline flex items-center gap-1"
                        onClick={() => navigate(`/delivery/store/${selectedIssueData.storeId || selectedIssueData.store?.id}`)}
                      >
                        <Store className="h-4 w-4" />
                        {selectedIssueData.storeName || selectedIssueData.store?.store_name}
                      </p>
                    </div>

                    {selectedIssueData.routeId && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Route</p>
                        <p 
                          className="text-primary cursor-pointer hover:underline"
                          onClick={() => navigate(`/delivery/route/${selectedIssueData.routeId}`)}
                        >
                          {selectedIssueData.routeId}
                        </p>
                      </div>
                    )}

                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Reported</p>
                      <p>{new Date(selectedIssueData.reportedAt || selectedIssueData.created_at).toLocaleString()}</p>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Description</p>
                      <p className="text-sm">{selectedIssueData.description || selectedIssueData.notes || 'No description provided'}</p>
                    </div>
                  </div>

                  <div className="pt-4 flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => navigate(`/delivery/store/${selectedIssueData.storeId || selectedIssueData.store?.id}`)}
                    >
                      <Store className="h-4 w-4 mr-2" />
                      View Store
                    </Button>
                    {selectedIssueData.routeId && (
                      <Button 
                        variant="outline"
                        onClick={() => navigate(`/delivery/route/${selectedIssueData.routeId}`)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Route
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Eye className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">Select an issue to view details</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DriverIssuesReported;
