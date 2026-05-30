import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardList, AlertCircle, Package } from 'lucide-react';
import { ConnectedStoresSection, type ConnectedStoreData } from './ConnectedStoresSection';
import { WholesalerSection, type WholesalerAssociation } from './WholesalerSection';

// Questionnaire without storeCount (now derived from connected stores)
// and without clothing (moved to contacts) and without preset wholesalers
interface Questionnaire {
  secureLevel: 'low' | 'medium' | 'high';
  sellsFlowers: boolean;
  interestedInCleaning: boolean;
  additionalItemsWanted: string;
  topSellingItems: string;
  mostNeededItems: string;
}

interface QuestionnaireTabProps {
  questionnaire: Questionnaire & { storeCount?: number; wholesalers?: string[]; clothingSize?: string };
  onQuestionnaireChange: (questionnaire: Questionnaire & { storeCount?: number; wholesalers?: string[]; clothingSize?: string }) => void;
  // Connected stores integration
  currentStoreId: string;
  connectedStores?: ConnectedStoreData[];
  onConnectedStoresChange?: (stores: ConnectedStoreData[]) => void;
  isLoadingConnectedStores?: boolean;
  // Global wholesaler associations
  wholesalerAssociations?: WholesalerAssociation[];
  onWholesalerAssociationsChange?: (associations: WholesalerAssociation[]) => void;
  isLoadingWholesalers?: boolean;
}

export function QuestionnaireTab({ 
  questionnaire, 
  onQuestionnaireChange,
  currentStoreId,
  connectedStores = [],
  onConnectedStoresChange,
  isLoadingConnectedStores = false,
  wholesalerAssociations = [],
  onWholesalerAssociationsChange,
  isLoadingWholesalers = false,
}: QuestionnaireTabProps) {

  const update = (updates: Partial<Questionnaire>) => {
    // Only update the simplified fields, exclude deprecated arrays and storeCount
    const { wholesalers, clothingSize, storeCount, ...rest } = questionnaire;
    onQuestionnaireChange({ ...rest, ...updates });
  };

  return (
    <div className="space-y-6">
      {/* Connected Stores Section - Replaces manual store count */}
      <ConnectedStoresSection
        currentStoreId={currentStoreId}
        connectedStores={connectedStores}
        onConnectedStoresChange={onConnectedStoresChange || (() => {})}
        isLoading={isLoadingConnectedStores}
      />

      {/* Global Wholesaler Associations - Network-level contacts */}
      <WholesalerSection
        storeId={currentStoreId}
        associations={wholesalerAssociations}
        onAssociationsChange={onWholesalerAssociationsChange || (() => {})}
        isLoading={isLoadingWholesalers}
      />

      {/* Core Questionnaire */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Store Questionnaire
          </CardTitle>
          <CardDescription>
            Gather essential information about the store
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

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

          {/* Sells Flowers - Store-level attribute */}
          <div className="flex items-center justify-between p-4 rounded-lg border bg-pink-500/5 border-pink-500/20">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-pink-500/10 flex items-center justify-center">
                <span className="text-pink-500 text-lg">🌸</span>
              </div>
              <div>
                <Label>Do they sell flowers?</Label>
                <p className="text-sm text-muted-foreground">Indicates if the store sells flower products</p>
              </div>
            </div>
            <Switch
              checked={questionnaire.sellsFlowers}
              onCheckedChange={(checked) => update({ sellsFlowers: checked })}
            />
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

          {/* Info about clothing */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Clothing sizes moved to Contacts</p>
              <p className="text-xs">Shirt sizes are now tracked per contact in the Contacts tab.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
