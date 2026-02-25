/**
 * Territory Coverage Panel — Ambassador Profile Tab
 * Add/edit/remove structured territory rows with conflict warnings
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AlertTriangle, MapPin, Plus, Trash2, Loader2, Shield } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAmbassadorTerritory, RegionType } from '@/hooks/useAmbassadorTerritory';

interface Props {
  ambassadorId: string;
  isEditable?: boolean;
}

export function TerritoryCoveragePanel({ ambassadorId, isEditable = false }: Props) {
  const { territories, isLoading, checkConflict, addTerritory, removeTerritory, updateTerritory, isAdding, isRemoving } = useAmbassadorTerritory(ambassadorId);
  const [showAdd, setShowAdd] = useState(false);
  const [regionType, setRegionType] = useState<RegionType>('city');
  const [regionValue, setRegionValue] = useState('');
  const [radius, setRadius] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [conflictWarning, setConflictWarning] = useState(false);

  const handleAdd = async () => {
    if (!regionValue.trim()) return;
    if (isPrimary) {
      const hasConflict = await checkConflict(regionType, regionValue.trim());
      if (hasConflict) {
        setConflictWarning(true);
        return;
      }
    }
    await addTerritory({
      region_type: regionType,
      region_value: regionValue.trim(),
      coverage_radius_miles: radius ? parseInt(radius) : undefined,
      is_primary: isPrimary,
    });
    resetForm();
  };

  const confirmAdd = async () => {
    await addTerritory({
      region_type: regionType,
      region_value: regionValue.trim(),
      coverage_radius_miles: radius ? parseInt(radius) : undefined,
      is_primary: isPrimary,
    });
    resetForm();
  };

  const resetForm = () => {
    setShowAdd(false);
    setRegionType('city');
    setRegionValue('');
    setRadius('');
    setIsPrimary(false);
    setConflictWarning(false);
  };

  const regionTypeLabels: Record<RegionType, string> = {
    state: 'State',
    county: 'County',
    city: 'City',
    custom_zone: 'Custom Zone',
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Territory Coverage
              </CardTitle>
              <CardDescription>Structured region assignments for this ambassador</CardDescription>
            </div>
            {isEditable && (
              <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
                <Plus className="h-4 w-4 mr-1" /> Add Region
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add Region Form */}
          {showAdd && (
            <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
              {conflictWarning && (
                <Alert className="border-amber-500/50 bg-amber-500/5">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <AlertDescription className="text-sm">
                    Another ambassador already covers this region as primary. Continue anyway?
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="outline" onClick={resetForm}>Cancel</Button>
                      <Button size="sm" onClick={confirmAdd} disabled={isAdding}>
                        {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Region Type</Label>
                  <Select value={regionType} onValueChange={(v) => setRegionType(v as RegionType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="state">State</SelectItem>
                      <SelectItem value="county">County</SelectItem>
                      <SelectItem value="city">City</SelectItem>
                      <SelectItem value="custom_zone">Custom Zone</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Region Value</Label>
                  <Input 
                    placeholder={regionType === 'state' ? 'e.g. Florida' : 'e.g. Miami'}
                    value={regionValue}
                    onChange={(e) => setRegionValue(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Radius (miles, optional)</Label>
                  <Input 
                    type="number"
                    placeholder="e.g. 25"
                    value={radius}
                    onChange={(e) => setRadius(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <Switch checked={isPrimary} onCheckedChange={setIsPrimary} />
                  <Label>Primary Region</Label>
                </div>
              </div>
              {!conflictWarning && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={resetForm}>Cancel</Button>
                  <Button size="sm" onClick={handleAdd} disabled={isAdding || !regionValue.trim()}>
                    {isAdding ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Add Territory
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Territory List */}
          {territories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No territories assigned</p>
              {isEditable && <p className="text-sm">Click "Add Region" to assign territory coverage</p>}
            </div>
          ) : (
            <div className="space-y-2">
              {territories.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Badge variant={t.is_primary ? 'default' : 'outline'}>
                      {regionTypeLabels[t.region_type]}
                    </Badge>
                    <span className="font-medium">{t.region_value}</span>
                    {t.is_primary && <Badge variant="secondary" className="text-xs">Primary</Badge>}
                    {t.coverage_radius_miles && (
                      <span className="text-sm text-muted-foreground">{t.coverage_radius_miles} mi radius</span>
                    )}
                  </div>
                  {isEditable && (
                    <div className="flex items-center gap-2">
                      {!t.is_primary && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => updateTerritory({ id: t.id, is_primary: true })}
                        >
                          Set Primary
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeTerritory(t.id)}
                        disabled={isRemoving}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
