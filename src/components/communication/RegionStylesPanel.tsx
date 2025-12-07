import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, Plus } from 'lucide-react';
import { RegionCommunicationStyle, PersonalityProfile } from '@/hooks/useLanguagePersonality';

interface RegionStylesPanelProps {
  styles: RegionCommunicationStyle[];
  personalities: PersonalityProfile[];
  isLoading: boolean;
  onCreateStyle: (style: Omit<RegionCommunicationStyle, 'id' | 'created_at'>) => void;
}

const boroColors: Record<string, string> = {
  Manhattan: 'bg-blue-500/20 text-blue-400',
  Brooklyn: 'bg-purple-500/20 text-purple-400',
  Bronx: 'bg-orange-500/20 text-orange-400',
  Queens: 'bg-green-500/20 text-green-400',
  'Staten Island': 'bg-gray-500/20 text-gray-400',
};

const NYC_BOROS = ['Manhattan', 'Brooklyn', 'Bronx', 'Queens', 'Staten Island'];

export default function RegionStylesPanel({
  styles,
  personalities,
  isLoading,
  onCreateStyle,
}: RegionStylesPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newStyle, setNewStyle] = useState({
    boro: '',
    neighborhood: '',
    recommended_personality_id: null as string | null,
    default_formality: 'neutral',
    notes: '',
  });

  const handleCreate = () => {
    onCreateStyle(newStyle);
    setIsOpen(false);
    setNewStyle({
      boro: '',
      neighborhood: '',
      recommended_personality_id: null,
      default_formality: 'neutral',
      notes: '',
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Region Communication Styles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Region Communication Styles
        </CardTitle>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Add Region
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Region Style</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Borough</Label>
                <Select
                  value={newStyle.boro}
                  onValueChange={(v) => setNewStyle({ ...newStyle, boro: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select borough..." />
                  </SelectTrigger>
                  <SelectContent>
                    {NYC_BOROS.map((boro) => (
                      <SelectItem key={boro} value={boro}>
                        {boro}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Neighborhood (Optional)</Label>
                <Input
                  value={newStyle.neighborhood || ''}
                  onChange={(e) => setNewStyle({ ...newStyle, neighborhood: e.target.value })}
                  placeholder="e.g., Harlem, Bushwick, Mott Haven"
                />
              </div>
              <div>
                <Label>Default Formality</Label>
                <Select
                  value={newStyle.default_formality || 'neutral'}
                  onValueChange={(v) => setNewStyle({ ...newStyle, default_formality: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="formal">Formal</SelectItem>
                    <SelectItem value="neutral">Neutral</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Recommended Personality</Label>
                <Select
                  value={newStyle.recommended_personality_id || ''}
                  onValueChange={(v) => setNewStyle({ ...newStyle, recommended_personality_id: v || null })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select personality..." />
                  </SelectTrigger>
                  <SelectContent>
                    {personalities?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={newStyle.notes || ''}
                  onChange={(e) => setNewStyle({ ...newStyle, notes: e.target.value })}
                  placeholder="e.g., High Latino population, prefer casual tone..."
                />
              </div>
              <Button onClick={handleCreate} className="w-full" disabled={!newStyle.boro}>
                Add Region Style
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {styles?.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No region styles configured. Add one to customize communication by area.
            </p>
          ) : (
            styles?.map((style) => {
              const personality = personalities?.find((p) => p.id === style.recommended_personality_id);
              return (
                <div
                  key={style.id}
                  className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={boroColors[style.boro || ''] || 'bg-muted'}>
                        {style.boro}
                      </Badge>
                      {style.neighborhood && (
                        <span className="text-sm text-muted-foreground">• {style.neighborhood}</span>
                      )}
                    </div>
                    <Badge variant="outline">{style.default_formality}</Badge>
                  </div>
                  {personality && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      Personality: <span className="text-foreground">{personality.name}</span>
                    </div>
                  )}
                  {style.notes && (
                    <p className="text-xs text-muted-foreground mt-2">{style.notes}</p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
