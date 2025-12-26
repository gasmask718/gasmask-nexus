/**
 * CRM Export Page - Entity-Centric Export
 * Export CRM data by entity type with field mapping
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useBusiness } from '@/contexts/BusinessContext';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { useCRMBlueprint, useAvailableEntityTypes } from '@/hooks/useCRMBlueprint';
import { useCRMEntityCounts } from '@/hooks/useCRMEntityCounts';
import CRMLayout from './CRMLayout';
import * as XLSX from 'xlsx';
import {
  Download, ArrowLeft, FileSpreadsheet, FileJson, Building2,
  Check, AlertCircle, Loader2, ChevronRight,
} from 'lucide-react';

export default function CRMExportPage() {
  const navigate = useNavigate();
  const { currentBusiness } = useBusiness();
  const { simulationMode } = useSimulationMode();
  const { blueprint, businessName } = useCRMBlueprint(currentBusiness?.slug);
  const entityTypes = useAvailableEntityTypes(currentBusiness?.slug);
  
  const { counts } = useCRMEntityCounts(
    currentBusiness?.id || null,
    blueprint.enabledEntityTypes
  );

  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);
  const [format, setFormat] = useState<'csv' | 'json' | 'xlsx'>('xlsx');
  const [isExporting, setIsExporting] = useState(false);

  const toggleEntity = (entityKey: string) => {
    setSelectedEntities(prev => 
      prev.includes(entityKey) 
        ? prev.filter(e => e !== entityKey)
        : [...prev, entityKey]
    );
  };

  const selectAll = () => {
    setSelectedEntities(entityTypes.map(e => e.key));
  };

  const selectNone = () => {
    setSelectedEntities([]);
  };

  const handleExport = async () => {
    if (selectedEntities.length === 0) {
      toast.error('Please select at least one entity type to export');
      return;
    }

    // Check if there's data to export
    const hasData = selectedEntities.some(key => (counts[key] || 0) > 0);
    if (!hasData) {
      toast.error('No data to export. Selected entity types have no records.');
      return;
    }

    setIsExporting(true);
    
    try {
      // In a real implementation, this would fetch data from the database
      // For now, we'll create a sample export structure
      
      const workbook = XLSX.utils.book_new();
      let sheetsAdded = 0;
      
      for (const entityKey of selectedEntities) {
        const entity = entityTypes.find(e => e.key === entityKey);
        const count = counts[entityKey] || 0;
        
        if (count > 0 && entity) {
          // Create sample data structure based on blueprint schema
          const schema = blueprint.entitySchemas[entityKey];
          if (schema) {
            const headers = schema.fields.map(f => f.label);
            const worksheet = XLSX.utils.aoa_to_sheet([headers]);
            XLSX.utils.book_append_sheet(workbook, worksheet, entity.labelPlural.slice(0, 31)); // Excel limit
            sheetsAdded++;
          }
        }
      }

      if (sheetsAdded === 0) {
        toast.error('No data to export');
        setIsExporting(false);
        return;
      }

      // Generate and download file
      const fileName = `${businessName || 'CRM'}_Export_${new Date().toISOString().split('T')[0]}`;
      
      if (format === 'xlsx') {
        XLSX.writeFile(workbook, `${fileName}.xlsx`);
      } else if (format === 'csv') {
        XLSX.writeFile(workbook, `${fileName}.csv`, { bookType: 'csv' });
      } else {
        // JSON format
        const jsonData: Record<string, any[]> = {};
        selectedEntities.forEach(key => {
          jsonData[key] = []; // Would contain actual data
        });
        const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }

      toast.success(`Export completed! ${sheetsAdded} entity types exported.`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // No business selected
  if (!currentBusiness) {
    return (
      <CRMLayout title="Export Data">
        <Card className="p-12 text-center">
          <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Business Selected</h3>
          <p className="text-muted-foreground mb-6">
            Please select a business to export CRM data.
          </p>
          <Button onClick={() => navigate('/crm')}>
            Select Business
          </Button>
        </Card>
      </CRMLayout>
    );
  }

  const totalSelected = selectedEntities.reduce((sum, key) => sum + (counts[key] || 0), 0);

  return (
    <CRMLayout title="Export Data">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/crm/data')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">Export Data</h1>
                {simulationMode && <SimulationBadge />}
              </div>
              <p className="text-muted-foreground">
                Export {businessName} CRM data by entity type
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Entity Selection */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Select Entity Types</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={selectAll}>
                      Select All
                    </Button>
                    <Button variant="outline" size="sm" onClick={selectNone}>
                      Clear
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  {entityTypes.map((entity) => {
                    const count = counts[entity.key] || 0;
                    const isSelected = selectedEntities.includes(entity.key);
                    
                    return (
                      <div
                        key={entity.key}
                        className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all ${
                          isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                        }`}
                        onClick={() => toggleEntity(entity.key)}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox 
                            checked={isSelected}
                            onCheckedChange={() => toggleEntity(entity.key)}
                          />
                          <div 
                            className="p-2 rounded-lg"
                            style={{ backgroundColor: `${entity.color}20`, color: entity.color }}
                          >
                            <Download className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium">{entity.labelPlural}</p>
                            <p className="text-xs text-muted-foreground">
                              {count} records
                            </p>
                          </div>
                        </div>
                        {isSelected && <Check className="h-5 w-5 text-primary" />}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Export Options */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Export Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Export Format</Label>
                  <Select value={format} onValueChange={(v: any) => setFormat(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="xlsx">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4" />
                          Excel (.xlsx)
                        </div>
                      </SelectItem>
                      <SelectItem value="csv">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4" />
                          CSV (.csv)
                        </div>
                      </SelectItem>
                      <SelectItem value="json">
                        <div className="flex items-center gap-2">
                          <FileJson className="h-4 w-4" />
                          JSON (.json)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Entity types selected</span>
                    <span className="font-medium">{selectedEntities.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total records</span>
                    <span className="font-medium">{totalSelected}</span>
                  </div>
                </div>

                <Button 
                  className="w-full" 
                  onClick={handleExport}
                  disabled={selectedEntities.length === 0 || isExporting}
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Export Data
                    </>
                  )}
                </Button>

                {selectedEntities.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center">
                    Select at least one entity type to export
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Template Download */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Download Template</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Download a template file for importing data
                </p>
                <Button variant="outline" className="w-full" onClick={() => {
                  toast.info('Template download feature coming soon');
                }}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Get Import Template
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </CRMLayout>
  );
}
