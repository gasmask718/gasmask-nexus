import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Shield,
  Search,
  Filter,
  Plus,
  Play,
  Pause,
  CheckCircle,
  AlertTriangle,
  Settings,
  ChevronRight,
} from 'lucide-react';
import { GrabbaLayout } from '@/components/grabba/GrabbaLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { usePlaybooks, useTogglePlaybook } from '@/hooks/useFloor9';
import { getPlaybookDomains } from '@/services/floor9';

const Floor9Playbooks = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [domainFilter, setDomainFilter] = useState<string>('all');
  
  const { data: playbooks, isLoading } = usePlaybooks();
  const togglePlaybook = useTogglePlaybook();

  const domains = getPlaybookDomains();

  const filteredPlaybooks = playbooks?.filter(pb => {
    const matchesSearch = pb.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         pb.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDomain = domainFilter === 'all' || pb.domain === domainFilter;
    return matchesSearch && matchesDomain;
  });

  const getDomainColor = (domain: string) => {
    const colors: Record<string, string> = {
      finance: 'bg-green-500/20 text-green-500',
      deliveries: 'bg-blue-500/20 text-blue-500',
      crm: 'bg-purple-500/20 text-purple-500',
      wholesale: 'bg-orange-500/20 text-orange-500',
      production: 'bg-yellow-500/20 text-yellow-500',
      communication: 'bg-pink-500/20 text-pink-500',
      inventory: 'bg-cyan-500/20 text-cyan-500',
      ambassadors: 'bg-indigo-500/20 text-indigo-500',
      general: 'bg-muted text-muted-foreground',
    };
    return colors[domain] || 'bg-muted';
  };

  return (
    <GrabbaLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8 text-primary" />
              AI Playbooks
            </h1>
            <p className="text-muted-foreground mt-1">
              Approved logic frameworks AI is allowed to use
            </p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Playbook
          </Button>
        </div>

        {/* Governance Notice */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">Playbooks are Law</p>
              <p className="text-sm text-muted-foreground">
                AI cannot act outside approved playbooks. Each playbook defines triggers, data sources, 
                decision rules, and confidence thresholds. Human approval required for activation.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search playbooks..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={domainFilter} onValueChange={setDomainFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Domain" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Domains</SelectItem>
                  {domains.map(domain => (
                    <SelectItem key={domain} value={domain} className="capitalize">{domain}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Playbooks List */}
        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
            ) : filteredPlaybooks && filteredPlaybooks.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Playbook</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Approval</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlaybooks.map((playbook) => (
                    <TableRow key={playbook.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{playbook.title}</p>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {playbook.description}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getDomainColor(playbook.domain)}>
                          {playbook.domain}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono">{Math.round(playbook.confidence_threshold * 100)}%</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">v{playbook.version}</Badge>
                      </TableCell>
                      <TableCell>
                        {playbook.approved_by ? (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Approved
                          </Badge>
                        ) : playbook.requires_approval ? (
                          <Badge variant="secondary">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        ) : (
                          <Badge variant="outline">Auto</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={playbook.is_active}
                          onCheckedChange={(checked) =>
                            togglePlaybook.mutate({ playbookId: playbook.id, isActive: checked })
                          }
                          disabled={togglePlaybook.isPending || (playbook.requires_approval && !playbook.approved_by)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost">
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-medium">No Playbooks Found</h3>
                <p className="text-muted-foreground text-sm">Create your first playbook to enable AI operations</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </GrabbaLayout>
  );
};

export default Floor9Playbooks;
