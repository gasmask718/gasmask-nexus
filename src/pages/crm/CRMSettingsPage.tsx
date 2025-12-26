/**
 * CRM Settings Page - Admin UI for blueprint configuration
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useBusiness } from '@/contexts/BusinessContext';
import { useCRMBlueprint, useAvailableEntityTypes } from '@/hooks/useCRMBlueprint';
import CRMLayout from './CRMLayout';
import { ArrowLeft, Settings, Save, Users, Briefcase, LayoutGrid, ListTodo, Building2 } from 'lucide-react';
import { toast } from 'sonner';

export default function CRMSettingsPage() {
  const navigate = useNavigate();
  const { currentBusiness } = useBusiness();
  const { blueprint, businessName } = useCRMBlueprint(currentBusiness?.slug);
  const entityTypes = useAvailableEntityTypes(currentBusiness?.slug);

  const handleSave = () => {
    toast.success('Settings saved (simulation mode - no actual changes made)');
  };

  return (
    <CRMLayout title="CRM Settings">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/crm')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">CRM Settings</h1>
              <p className="text-muted-foreground text-sm">
                Configure CRM blueprint for {businessName || 'your business'}
              </p>
            </div>
          </div>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>

        <Tabs defaultValue="entities">
          <TabsList>
            <TabsTrigger value="entities"><Users className="h-4 w-4 mr-2" />Entity Types</TabsTrigger>
            <TabsTrigger value="pipelines"><Briefcase className="h-4 w-4 mr-2" />Pipelines</TabsTrigger>
            <TabsTrigger value="features"><LayoutGrid className="h-4 w-4 mr-2" />Features</TabsTrigger>
          </TabsList>

          <TabsContent value="entities" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Enabled Entity Types</CardTitle>
                <CardDescription>Toggle entity types for this business CRM</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {entityTypes.map((entity) => (
                    <div key={entity.key} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg" style={{ backgroundColor: `${entity.color}20`, color: entity.color }}>
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium">{entity.labelPlural}</p>
                          <p className="text-sm text-muted-foreground">{entity.key}</p>
                        </div>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pipelines" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pipeline Stages</CardTitle>
                <CardDescription>Configure deal/booking pipeline stages</CardDescription>
              </CardHeader>
              <CardContent>
                {Object.entries(blueprint.pipelines).map(([key, stages]) => (
                  <div key={key} className="mb-6">
                    <h4 className="font-medium mb-3 capitalize">{key.replace(/_/g, ' ')} Pipeline</h4>
                    <div className="flex gap-2 flex-wrap">
                      {stages.map((stage) => (
                        <Badge key={stage.value} style={{ backgroundColor: stage.color, color: 'white' }}>
                          {stage.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="features" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Feature Toggles</CardTitle>
                <CardDescription>Enable or disable CRM features</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(blueprint.features).map(([key, enabled]) => (
                    <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').replace('show ', '')}</span>
                      <Switch defaultChecked={enabled} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </CRMLayout>
  );
}
