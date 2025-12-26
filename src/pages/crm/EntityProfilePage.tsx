/**
 * Entity Profile Page - Dynamic profile with blueprint-driven tabs
 */
import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { useCRMBlueprint, useProfileTabs } from '@/hooks/useCRMBlueprint';
import { useCRMSimulation } from '@/hooks/useCRMSimulation';
import { ExtendedEntityType } from '@/config/crmBlueprints';
import { MediaVault } from '@/components/crm/MediaVault';
import CRMLayout from './CRMLayout';
import {
  ArrowLeft, Edit, Trash2, MoreHorizontal, Phone, Mail, MapPin,
  Calendar, Clock, User, Building2, Star, MessageCircle, FileText,
  Image, ListTodo, Activity, ExternalLink, Copy, Share2, ChevronRight,
  Plus, Send, CheckCircle, XCircle
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  User, Building2, Star, Calendar, Phone, Mail, MapPin,
  MessageCircle, FileText, Image, ListTodo, Activity, Clock,
};

export default function EntityProfilePage() {
  const { businessSlug, entityType, recordId } = useParams<{ 
    businessSlug: string; 
    entityType: string; 
    recordId: string;
  }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const { simulationMode } = useSimulationMode();

  // Get blueprint and entity schema
  const { blueprint, businessName, getEntitySchema, getPipeline } = useCRMBlueprint(businessSlug);
  const entitySchema = getEntitySchema(entityType as ExtendedEntityType);
  const profileTabs = useProfileTabs(businessSlug, entityType as ExtendedEntityType);
  const pipelineStages = getPipeline(entityType as ExtendedEntityType);
  const { isSimulationMode, getEntityData } = useCRMSimulation(businessSlug || null);

  // Get entity data
  const entity = useMemo(() => {
    if (!isSimulationMode || !entityType) return null;
    const entities = getEntityData(entityType as ExtendedEntityType);
    return entities.find((e: any) => e.id === recordId) || entities[0] || null;
  }, [isSimulationMode, entityType, recordId, getEntityData]);

  const renderIcon = (iconName: string, className = "h-5 w-5") => {
    const IconComponent = ICON_MAP[iconName];
    return IconComponent ? <IconComponent className={className} /> : <Building2 className={className} />;
  };

  const getDisplayName = (e: any) => {
    if (!e) return 'Unknown';
    return e.name || e.company_name || e.stage_name || e.legal_name || e.client_name || `Record ${e.id}`;
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  if (!entitySchema) {
    return (
      <CRMLayout title="Entity Not Found">
        <Card className="p-12 text-center">
          <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">Entity Not Found</h3>
          <p className="text-muted-foreground mb-6">
            The requested entity could not be found.
          </p>
          <Button onClick={() => navigate(`/crm/${businessSlug}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to CRM
          </Button>
        </Card>
      </CRMLayout>
    );
  }

  if (!entity) {
    return (
      <CRMLayout title="Record Not Found">
        <Card className="p-12 text-center">
          <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">Record Not Found</h3>
          <p className="text-muted-foreground mb-6">
            The requested {entitySchema.label.toLowerCase()} could not be found.
          </p>
          <Button onClick={() => navigate(`/crm/${businessSlug}/${entityType}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to {entitySchema.labelPlural}
          </Button>
        </Card>
      </CRMLayout>
    );
  }

  const currentStage = pipelineStages.find(s => s.value === entity.status);

  return (
    <CRMLayout title={`${getDisplayName(entity)} - ${entitySchema.label}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/crm/${businessSlug}/${entityType}`)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center gap-4">
              <div 
                className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-lg"
                style={{ backgroundColor: entitySchema.color }}
              >
                {getDisplayName(entity).charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">{getDisplayName(entity)}</h1>
                  {isSimulationMode && <SimulationBadge />}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <Badge 
                    variant="outline"
                    style={{ 
                      borderColor: entitySchema.color,
                      color: entitySchema.color,
                    }}
                  >
                    {entitySchema.label}
                  </Badge>
                  {entity.status && currentStage && (
                    <Badge 
                      style={{ 
                        backgroundColor: `${currentStage.color}20`,
                        color: currentStage.color,
                        borderColor: currentStage.color,
                      }}
                    >
                      {currentStage.label}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in new tab
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Pipeline Progress */}
        {pipelineStages.length > 0 && entity.status && (
          <Card className="p-4">
            <div className="flex items-center gap-2 overflow-x-auto">
              {pipelineStages.map((stage, index) => {
                const isActive = stage.value === entity.status;
                const isPast = pipelineStages.findIndex(s => s.value === entity.status) > index;
                return (
                  <div key={stage.value} className="flex items-center">
                    <div
                      className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all ${
                        isActive 
                          ? 'ring-2 ring-offset-2 ring-primary' 
                          : isPast 
                            ? 'opacity-60' 
                            : 'opacity-40'
                      }`}
                      style={{ 
                        backgroundColor: isActive || isPast ? `${stage.color}20` : 'transparent',
                        color: stage.color,
                        borderColor: stage.color,
                      }}
                    >
                      {isPast ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <div 
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                      )}
                      <span className="text-sm font-medium">{stage.label}</span>
                    </div>
                    {index < pipelineStages.length - 1 && (
                      <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground" />
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Details */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                {profileTabs.filter(t => t.enabled).map((tab) => (
                  <TabsTrigger key={tab.key} value={tab.key}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      {Object.entries(entity).map(([key, value]) => {
                        if (key === 'id' || typeof value === 'object') return null;
                        const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                        return (
                          <div key={key} className="space-y-1">
                            <p className="text-sm text-muted-foreground">{label}</p>
                            <p className="font-medium">{String(value) || '-'}</p>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Media Vault Tab (for PlayBoxxx) */}
              {blueprint.features.showMediaVault && (
                <TabsContent value="media">
                  <MediaVault entityId={entity.id} entityType={entityType as ExtendedEntityType} items={[]} />
                </TabsContent>
              )}

              {/* WhatsApp/Messages Tab */}
              {blueprint.features.showWhatsApp && (
                <TabsContent value="whatsapp" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <MessageCircle className="h-5 w-5 text-green-500" />
                        WhatsApp Messages
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-64">
                        {isSimulationMode ? (
                          <div className="space-y-3">
                            {[
                              { from: 'them', message: 'Hi, I\'m interested in the collaboration!', time: '2h ago' },
                              { from: 'us', message: 'Great! Let me send you the details.', time: '1h ago' },
                              { from: 'them', message: 'Sounds good, looking forward to it!', time: '30m ago' },
                            ].map((msg, i) => (
                              <div 
                                key={i} 
                                className={`flex ${msg.from === 'us' ? 'justify-end' : 'justify-start'}`}
                              >
                                <div 
                                  className={`max-w-[70%] p-3 rounded-lg ${
                                    msg.from === 'us' 
                                      ? 'bg-primary text-primary-foreground' 
                                      : 'bg-muted'
                                  }`}
                                >
                                  <p className="text-sm">{msg.message}</p>
                                  <p className="text-xs opacity-70 mt-1">{msg.time}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full text-muted-foreground">
                            No messages yet
                          </div>
                        )}
                      </ScrollArea>
                      <div className="flex gap-2 mt-4">
                        <input 
                          type="text" 
                          placeholder="Type a message..." 
                          className="flex-1 rounded-lg border px-4 py-2 text-sm"
                        />
                        <Button>
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              {/* Notes Tab */}
              <TabsContent value="notes" className="space-y-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Notes</CardTitle>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Note
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {isSimulationMode ? (
                      <div className="space-y-4">
                        {[
                          { content: 'Initial contact made, very interested in partnership.', author: 'John Doe', time: '2 days ago' },
                          { content: 'Follow-up call scheduled for next week.', author: 'Jane Smith', time: '1 day ago' },
                        ].map((note, i) => (
                          <div key={i} className="p-4 rounded-lg border">
                            <p className="text-sm">{note.content}</p>
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              <span>{note.author}</span>
                              <span>•</span>
                              <span>{note.time}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        No notes yet
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tasks Tab */}
              <TabsContent value="tasks" className="space-y-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Tasks</CardTitle>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Task
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {isSimulationMode ? (
                      <div className="space-y-3">
                        {[
                          { label: 'Send contract for review', status: 'pending', due: 'Tomorrow' },
                          { label: 'Schedule onboarding call', status: 'completed', due: 'Today' },
                          { label: 'Verify documents', status: 'pending', due: 'Next week' },
                        ].map((task, i) => (
                          <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                            <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                              task.status === 'completed' ? 'bg-green-500 border-green-500' : 'border-muted-foreground'
                            }`}>
                              {task.status === 'completed' && <CheckCircle className="h-3 w-3 text-white" />}
                            </div>
                            <div className="flex-1">
                              <p className={`text-sm ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                                {task.label}
                              </p>
                              <p className="text-xs text-muted-foreground">Due: {task.due}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        No tasks yet
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Column - Quick Info & Actions */}
          <div className="space-y-6">
            {/* Contact Info */}
            <Card>
              <CardHeader>
                <CardTitle>Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {entity.phone && (
                  <div 
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                    onClick={() => copyToClipboard(entity.phone, 'Phone')}
                  >
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{entity.phone}</span>
                  </div>
                )}
                {entity.whatsapp_number && (
                  <div 
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                    onClick={() => copyToClipboard(entity.whatsapp_number, 'WhatsApp')}
                  >
                    <MessageCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">{entity.whatsapp_number}</span>
                  </div>
                )}
                {entity.email && (
                  <div 
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                    onClick={() => copyToClipboard(entity.email, 'Email')}
                  >
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{entity.email}</span>
                  </div>
                )}
                {(entity.city || entity.state) && (
                  <div className="flex items-center gap-3 p-2 rounded-lg">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{[entity.city, entity.state].filter(Boolean).join(', ')}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <Phone className="h-4 w-4 mr-2" />
                  Call
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
                {blueprint.features.showWhatsApp && (
                  <Button variant="outline" className="w-full justify-start text-green-600">
                    <MessageCircle className="h-4 w-4 mr-2" />
                    WhatsApp
                  </Button>
                )}
                <Button variant="outline" className="w-full justify-start">
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <ListTodo className="h-4 w-4 mr-2" />
                  Add Task
                </Button>
              </CardContent>
            </Card>

            {/* Activity Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  {isSimulationMode ? (
                    <div className="space-y-4">
                      {[
                        { action: 'Status changed to Active', time: '2h ago' },
                        { action: 'Note added', time: '1d ago' },
                        { action: 'Record created', time: '3d ago' },
                      ].map((activity, i) => (
                        <div key={i} className="flex gap-3">
                          <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                          <div>
                            <p className="text-sm">{activity.action}</p>
                            <p className="text-xs text-muted-foreground">{activity.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-4">
                      No activity yet
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </CRMLayout>
  );
}
