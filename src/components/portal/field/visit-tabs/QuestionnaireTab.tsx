import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface Questionnaire {
  storeCount: number;
  secureLevel: 'low' | 'medium' | 'high';
  sellsFlowers: boolean;
  wholesalers: string[];
  clothingSize: string;
  interestedInCleaning: boolean;
}

interface QuestionnaireTabProps {
  questionnaire: Questionnaire;
  onQuestionnaireChange: (questionnaire: Questionnaire) => void;
}

const commonWholesalers = [
  'Prime Source Depot',
  'National Tobacco',
  'Miami Wholesale',
  'East Coast Distributors',
  'Local Supplier',
];

export function QuestionnaireTab({ questionnaire, onQuestionnaireChange }: QuestionnaireTabProps) {
  const [newWholesaler, setNewWholesaler] = useState('');

  const update = (updates: Partial<Questionnaire>) => {
    onQuestionnaireChange({ ...questionnaire, ...updates });
  };

  const addWholesaler = (name: string) => {
    if (name && !questionnaire.wholesalers.includes(name)) {
      update({ wholesalers: [...questionnaire.wholesalers, name] });
    }
    setNewWholesaler('');
  };

  const removeWholesaler = (name: string) => {
    update({ wholesalers: questionnaire.wholesalers.filter(w => w !== name) });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Store Questionnaire
        </CardTitle>
        <CardDescription>
          Gather additional information about the store
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Store Count */}
        <div className="space-y-2">
          <Label>How many stores do they have?</Label>
          <Input
            type="number"
            min={1}
            value={questionnaire.storeCount}
            onChange={(e) => update({ storeCount: parseInt(e.target.value) || 1 })}
            className="w-32"
          />
        </div>

        {/* Security Level */}
        <div className="space-y-2">
          <Label>Security Level</Label>
          <Select
            value={questionnaire.secureLevel}
            onValueChange={(value) => update({ secureLevel: value as 'low' | 'medium' | 'high' })}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sells Flowers */}
        <div className="flex items-center justify-between p-4 rounded-lg border">
          <div>
            <Label>Do they sell flowers?</Label>
            <p className="text-sm text-muted-foreground">Indicates if the store sells flower products</p>
          </div>
          <Switch
            checked={questionnaire.sellsFlowers}
            onCheckedChange={(checked) => update({ sellsFlowers: checked })}
          />
        </div>

        {/* Wholesalers */}
        <div className="space-y-3">
          <Label>What wholesalers do they purchase from?</Label>
          
          {/* Selected Wholesalers */}
          <div className="flex flex-wrap gap-2">
            {questionnaire.wholesalers.map((w) => (
              <Badge key={w} variant="secondary" className="gap-1 pr-1">
                {w}
                <button
                  onClick={() => removeWholesaler(w)}
                  className="ml-1 hover:bg-muted rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {questionnaire.wholesalers.length === 0 && (
              <span className="text-sm text-muted-foreground">No wholesalers selected</span>
            )}
          </div>

          {/* Common Wholesalers */}
          <div className="flex flex-wrap gap-2">
            {commonWholesalers
              .filter(w => !questionnaire.wholesalers.includes(w))
              .map((w) => (
                <Button
                  key={w}
                  variant="outline"
                  size="sm"
                  onClick={() => addWholesaler(w)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {w}
                </Button>
              ))}
          </div>

          {/* Add Custom */}
          <div className="flex gap-2">
            <Input
              placeholder="Add custom wholesaler..."
              value={newWholesaler}
              onChange={(e) => setNewWholesaler(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addWholesaler(newWholesaler);
                }
              }}
            />
            <Button 
              variant="outline" 
              onClick={() => addWholesaler(newWholesaler)}
              disabled={!newWholesaler}
            >
              Add
            </Button>
          </div>
        </div>

        {/* Clothing Size */}
        <div className="space-y-2">
          <Label>Clothing Size (for swag)</Label>
          <Select
            value={questionnaire.clothingSize}
            onValueChange={(value) => update({ clothingSize: value })}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="XS">XS</SelectItem>
              <SelectItem value="S">S</SelectItem>
              <SelectItem value="M">M</SelectItem>
              <SelectItem value="L">L</SelectItem>
              <SelectItem value="XL">XL</SelectItem>
              <SelectItem value="2XL">2XL</SelectItem>
              <SelectItem value="3XL">3XL</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Interested in Cleaning */}
        <div className="flex items-center justify-between p-4 rounded-lg border">
          <div>
            <Label>Interested in cleaning service?</Label>
            <p className="text-sm text-muted-foreground">Would they like iClean services?</p>
          </div>
          <Switch
            checked={questionnaire.interestedInCleaning}
            onCheckedChange={(checked) => update({ interestedInCleaning: checked })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
