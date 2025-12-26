/**
 * Entity List Page - Dynamic entity listing with blueprint-driven UI
 */
import { useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { useCRMBlueprint } from '@/hooks/useCRMBlueprint';
import { useCRMSimulation } from '@/hooks/useCRMSimulation';
import { ExtendedEntityType } from '@/config/crmBlueprints';
import CRMLayout from './CRMLayout';
import {
  ArrowLeft, Plus, Search, Filter, Download, Upload,
  LayoutGrid, List, RefreshCw, MoreHorizontal, Eye, Edit, Trash2,
  Users, Building2, Star, Calendar, Phone, Mail, MapPin, ChevronRight,
  Briefcase, UserCheck, MessageCircle, Image
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Users, Building2, Star, Calendar, Phone, Mail, MapPin,
  Briefcase, UserCheck, MessageCircle, Image,
};

export default function EntityListPage() {
  const { businessSlug, entityType } = useParams<{ businessSlug: string; entityType: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [statusFilter, setStatusFilter] = useState('all');
  const { simulationMode } = useSimulationMode();

  // Get blueprint and entity schema
  const { blueprint, businessName, getEntitySchema } = useCRMBlueprint(businessSlug);
  const entitySchema = getEntitySchema(entityType as ExtendedEntityType);
  const { isSimulationMode, getEntityData } = useCRMSimulation(businessSlug || null);

  // Get simulation data for this entity type
  const simulationEntities = useMemo(() => {
    if (!isSimulationMode || !entityType) return [];
    return getEntityData(entityType as ExtendedEntityType);
  }, [isSimulationMode, entityType, getEntityData]);

  // Filter entities
  const filteredEntities = useMemo(() => {
    let entities = simulationEntities;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      entities = entities.filter((e: any) => 
        Object.values(e).some(v => 
          typeof v === 'string' && v.toLowerCase().includes(term)
        )
      );
    }
    
    if (statusFilter !== 'all') {
      entities = entities.filter((e: any) => e.status === statusFilter);
    }
    
    return entities;
  }, [simulationEntities, searchTerm, statusFilter]);

  // Get pipeline stages if available
  const pipelineStages = useMemo(() => {
    if (!entityType || !blueprint.pipelines[entityType]) return null;
    return blueprint.pipelines[entityType];
  }, [entityType, blueprint]);

  // Get unique statuses from data
  const uniqueStatuses = useMemo(() => {
    const statuses = new Set<string>();
    simulationEntities.forEach((e: any) => {
      if (e.status) statuses.add(e.status);
    });
    return Array.from(statuses);
  }, [simulationEntities]);

  const renderIcon = (iconName: string, className = "h-5 w-5") => {
    const IconComponent = ICON_MAP[iconName];
    return IconComponent ? <IconComponent className={className} /> : <Building2 className={className} />;
  };

  const getDisplayName = (entity: any) => {
    return entity.name || entity.company_name || entity.stage_name || entity.legal_name || entity.client_name || `Record ${entity.id}`;
  };

  const getSecondaryInfo = (entity: any) => {
    return entity.email || entity.phone || entity.whatsapp_number || entity.city || entity.category || '';
  };

  if (!entitySchema) {
    return (
      <CRMLayout title="Entity Not Found">
        <Card className="p-12 text-center">
          <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">Entity Type Not Found</h3>
          <p className="text-muted-foreground mb-6">
            The entity type "{entityType}" is not enabled for this business.
          </p>
          <Button onClick={() => navigate(`/crm?business=${businessSlug}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to CRM
          </Button>
        </Card>
      </CRMLayout>
    );
  }

  return (
    <CRMLayout title={`${entitySchema.labelPlural} - ${businessName}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/crm?business=${businessSlug}`)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <div 
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: `${entitySchema.color}20`, color: entitySchema.color }}
                >
                  {renderIcon(entitySchema.icon)}
                </div>
                <h1 className="text-2xl font-bold">{entitySchema.labelPlural}</h1>
                {isSimulationMode && <SimulationBadge />}
              </div>
              <p className="text-muted-foreground text-sm ml-10">
                {filteredEntities.length} records
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button onClick={() => navigate(`/crm/${businessSlug}/${entityType}/new`)}>
              <Plus className="h-4 w-4 mr-2" />
              Add {entitySchema.label}
            </Button>
          </div>
        </div>

        {/* Pipeline View (if available) */}
        {pipelineStages && (
          <Card className="p-4">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {pipelineStages.map((stage) => {
                const count = filteredEntities.filter((e: any) => e.status === stage.value).length;
                return (
                  <div
                    key={stage.value}
                    className={`flex-shrink-0 p-3 rounded-lg border min-w-[120px] cursor-pointer transition-all hover:shadow-md ${statusFilter === stage.value ? 'ring-2 ring-primary' : ''}`}
                    style={{ borderColor: stage.color }}
                    onClick={() => setStatusFilter(statusFilter === stage.value ? 'all' : stage.value)}
                  >
                    <div 
                      className="h-2 w-2 rounded-full mb-2"
                      style={{ backgroundColor: stage.color }}
                    />
                    <p className="text-xs text-muted-foreground">{stage.label}</p>
                    <p className="text-xl font-bold">{count}</p>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Search and Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${entitySchema.labelPlural.toLowerCase()}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          {uniqueStatuses.length > 0 && (
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {uniqueStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex items-center gap-1 border rounded-lg p-1">
            <Button 
              variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button 
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Entity List */}
        {filteredEntities.length === 0 ? (
          <Card className="p-12 text-center">
            <div 
              className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{ backgroundColor: `${entitySchema.color}20`, color: entitySchema.color }}
            >
              {renderIcon(entitySchema.icon, 'h-8 w-8')}
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {searchTerm || statusFilter !== 'all' ? 'No Matching Records' : `No ${entitySchema.labelPlural} Yet`}
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {searchTerm || statusFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : `Add your first ${entitySchema.label.toLowerCase()} to get started`
              }
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <Button onClick={() => navigate(`/crm/${businessSlug}/${entityType}/new`)}>
                <Plus className="h-4 w-4 mr-2" />
                Add {entitySchema.label}
              </Button>
            )}
          </Card>
        ) : viewMode === 'list' ? (
          <Card>
            <ScrollArea className="h-[600px]">
              <div className="divide-y">
                {filteredEntities.map((entity: any, index: number) => (
                  <div
                    key={entity.id || index}
                    className="flex items-center gap-4 p-4 hover:bg-muted/50 cursor-pointer transition-colors group"
                    onClick={() => navigate(`/crm/${businessSlug}/${entityType}/${entity.id}`)}
                  >
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: entitySchema.color }}
                    >
                      {getDisplayName(entity).charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate group-hover:text-primary transition-colors">
                        {getDisplayName(entity)}
                      </h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {getSecondaryInfo(entity)}
                      </p>
                    </div>
                    {entity.status && (
                      <Badge 
                        variant="outline"
                        style={{ 
                          borderColor: pipelineStages?.find(s => s.value === entity.status)?.color || entitySchema.color,
                          color: pipelineStages?.find(s => s.value === entity.status)?.color || entitySchema.color,
                        }}
                      >
                        {entity.status.replace(/_/g, ' ')}
                      </Badge>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/crm/${businessSlug}/${entityType}/${entity.id}`)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                ))}
              </div>
            </ScrollArea>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredEntities.map((entity: any, index: number) => (
              <Card
                key={entity.id || index}
                className="p-4 cursor-pointer hover:shadow-lg transition-all group"
                onClick={() => navigate(`/crm/${businessSlug}/${entityType}/${entity.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div 
                    className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                    style={{ backgroundColor: entitySchema.color }}
                  >
                    {getDisplayName(entity).charAt(0)}
                  </div>
                  {entity.status && (
                    <Badge 
                      variant="outline"
                      className="text-xs"
                      style={{ 
                        borderColor: pipelineStages?.find(s => s.value === entity.status)?.color || entitySchema.color,
                        color: pipelineStages?.find(s => s.value === entity.status)?.color || entitySchema.color,
                      }}
                    >
                      {entity.status.replace(/_/g, ' ')}
                    </Badge>
                  )}
                </div>
                <h3 className="font-semibold mb-1 truncate group-hover:text-primary transition-colors">
                  {getDisplayName(entity)}
                </h3>
                <p className="text-sm text-muted-foreground truncate mb-3">
                  {getSecondaryInfo(entity)}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>View details</span>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </CRMLayout>
  );
}
