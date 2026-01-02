import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Send, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Tab Components
import { BillingTab } from './visit-tabs/BillingTab';
import { StickersTab } from './visit-tabs/StickersTab';
import { InventoryTab } from './visit-tabs/InventoryTab';
import { ContactsTab } from './visit-tabs/ContactsTab';
import { QuestionnaireTab } from './visit-tabs/QuestionnaireTab';
import { NotesTab } from './visit-tabs/NotesTab';
import { ChangeListTab } from './visit-tabs/ChangeListTab';
import { VisitHistoryTab } from './visit-tabs/VisitHistoryTab';

export interface StoreVisitData {
  storeId: string;
  storeName: string;
  storeAddress: string;
  // Billing
  billTo: 'bill' | 'pay_upfront';
  // Stickers per brand
  stickers: Record<string, {
    frontDoor: boolean;
    authorizedRetailer: boolean;
    brandCharacter: boolean;
    telephoneNumber: boolean;
    notes: string;
  }>;
  // Inventory counts
  inventory: Record<string, number>;
  // Contacts
  contacts: Array<{
    id?: string;
    name: string;
    role: string;
    phone: string;
    responsiveByCall: boolean;
    responsiveByText: boolean;
    lastResponded: string | null;
    notes: string;
  }>;
  // Questionnaire
  questionnaire: {
    storeCount: number;
    secureLevel: 'low' | 'medium' | 'high';
    sellsFlowers: boolean;
    wholesalers: string[];
    clothingSize: string;
    interestedInCleaning: boolean;
  };
  // Notes
  internalNotes: string;
  relationshipNotes: string;
  nextFollowUp: string;
  nextFollowUpDate: string | null;
}

interface StoreVisitEngineProps {
  portalType: 'driver' | 'biker';
}

export function StoreVisitEngine({ portalType }: StoreVisitEngineProps) {
  const { storeId } = useParams<{ storeId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('billing');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [store, setStore] = useState<{ id: string; store_name: string; address: string } | null>(null);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; brand_id: string; category: string }[]>([]);
  
  const [visitData, setVisitData] = useState<StoreVisitData>({
    storeId: storeId || '',
    storeName: '',
    storeAddress: '',
    billTo: 'bill',
    stickers: {},
    inventory: {},
    contacts: [],
    questionnaire: {
      storeCount: 1,
      secureLevel: 'medium',
      sellsFlowers: false,
      wholesalers: [],
      clothingSize: '',
      interestedInCleaning: false,
    },
    internalNotes: '',
    relationshipNotes: '',
    nextFollowUp: '',
    nextFollowUpDate: null,
  });

  // Fetch store data, brands, and products
  useEffect(() => {
    async function fetchData() {
      if (!storeId) return;
      
      setLoading(true);
      try {
        // Fetch store
        const { data: storeData } = await supabase
          .from('store_master')
          .select('id, store_name, address, city, state')
          .eq('id', storeId)
          .single();

        if (storeData) {
          setStore(storeData);
          setVisitData(prev => ({
            ...prev,
            storeId: storeData.id,
            storeName: storeData.store_name,
            storeAddress: `${storeData.address}, ${storeData.city}, ${storeData.state}`,
          }));
        }

        // Fetch brands
        const { data: brandsData } = await supabase
          .from('brands')
          .select('id, name')
          .order('name');

        if (brandsData) {
          setBrands(brandsData);
          // Initialize stickers for each brand
          const initialStickers: Record<string, any> = {};
          brandsData.forEach(brand => {
            initialStickers[brand.id] = {
              frontDoor: false,
              authorizedRetailer: false,
              brandCharacter: false,
              telephoneNumber: false,
              notes: '',
            };
          });
          setVisitData(prev => ({ ...prev, stickers: initialStickers }));
        }

        // Fetch products
        const { data: productsData } = await supabase
          .from('products')
          .select('id, name, brand_id, category')
          .eq('is_active', true)
          .order('name');

        if (productsData) {
          setProducts(productsData);
          // Initialize inventory counts
          const initialInventory: Record<string, number> = {};
          productsData.forEach(product => {
            initialInventory[product.id] = 0;
          });
          setVisitData(prev => ({ ...prev, inventory: initialInventory }));
        }

        // Fetch existing store contacts
        const { data: contactsData } = await supabase
          .from('store_contacts')
          .select('*')
          .eq('store_id', storeId);

        if (contactsData && contactsData.length > 0) {
          setVisitData(prev => ({
            ...prev,
            contacts: contactsData.map(c => ({
              id: c.id,
              name: c.name || '',
              role: c.role || '',
              phone: c.phone || '',
              responsiveByCall: c.responsive_by_call || false,
              responsiveByText: c.responsive_by_text || false,
              lastResponded: c.last_responded_at,
              notes: c.notes || '',
            })),
          }));
        }

        // Fetch existing questionnaire
        const { data: questionnaireData } = await supabase
          .from('store_questionnaire')
          .select('*')
          .eq('store_id', storeId)
          .single();

        if (questionnaireData) {
          setVisitData(prev => ({
            ...prev,
            questionnaire: {
              storeCount: questionnaireData.total_store_count || 1,
              secureLevel: (questionnaireData.security_level as 'low' | 'medium' | 'high') || 'medium',
              sellsFlowers: questionnaireData.sells_flowers || false,
              wholesalers: questionnaireData.wholesalers_used || [],
              clothingSize: questionnaireData.clothing_size || '',
              interestedInCleaning: questionnaireData.interested_cleaning_service || false,
            },
          }));
        }

      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: 'Error loading store data',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [storeId, toast]);

  const updateVisitData = (updates: Partial<StoreVisitData>) => {
    setVisitData(prev => ({ ...prev, ...updates }));
  };

  const handleSubmitToChangeControl = async () => {
    if (!storeId) return;
    
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create visit record
      const { data: visit, error: visitError } = await supabase
        .from('store_visits')
        .insert({
          store_id: storeId,
          visited_by: user.id,
          role_type: portalType,
          visit_type: 'check',
          status: 'completed',
          notes: visitData.internalNotes,
        })
        .select()
        .single();

      if (visitError) throw visitError;

      // Create change list
      const { data: changeList, error: changeListError } = await supabase
        .from('change_lists')
        .insert({
          visit_id: visit.id,
          store_id: storeId,
          submitted_by: user.id,
          submitted_by_role: portalType,
          status: 'submitted',
        })
        .select()
        .single();

      if (changeListError) throw changeListError;

      // Create change list items for inventory
      const inventoryChanges = Object.entries(visitData.inventory)
        .filter(([_, count]) => count > 0)
        .map(([productId, count]) => ({
          change_list_id: changeList.id,
          entity_type: 'inventory',
          entity_id: productId,
          field_name: 'quantity',
          new_value: { count },
        }));

      // Create change list items for stickers
      const stickerChanges = Object.entries(visitData.stickers).flatMap(([brandId, stickers]) =>
        Object.entries(stickers).map(([key, value]) => ({
          change_list_id: changeList.id,
          entity_type: 'stickers',
          entity_id: brandId,
          field_name: key,
          new_value: { value },
        }))
      );

      // Create change list items for questionnaire
      const questionnaireChanges = Object.entries(visitData.questionnaire).map(([key, value]) => ({
        change_list_id: changeList.id,
        entity_type: 'questionnaire',
        entity_id: storeId,
        field_name: key,
        new_value: { value },
      }));

      const allChanges = [...inventoryChanges, ...stickerChanges, ...questionnaireChanges];

      if (allChanges.length > 0) {
        const { error: itemsError } = await supabase
          .from('change_list_items')
          .insert(allChanges);

        if (itemsError) throw itemsError;
      }

      toast({
        title: 'Visit Submitted',
        description: 'Your changes have been sent to the Change Control Center for review.',
      });

      navigate(portalType === 'driver' ? '/portal/driver' : '/portal/biker');
    } catch (error) {
      console.error('Error submitting visit:', error);
      toast({
        title: 'Submission Failed',
        description: 'Could not submit your changes. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!store) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Store not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
            Go Back
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{store.store_name}</h1>
            <p className="text-sm text-muted-foreground">{visitData.storeAddress}</p>
          </div>
        </div>
        <Badge variant="outline" className="uppercase">
          {portalType} Visit
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 h-auto">
          <TabsTrigger value="billing" className="text-xs">Billing</TabsTrigger>
          <TabsTrigger value="stickers" className="text-xs">Stickers</TabsTrigger>
          <TabsTrigger value="inventory" className="text-xs">Inventory</TabsTrigger>
          <TabsTrigger value="contacts" className="text-xs">Contacts</TabsTrigger>
          <TabsTrigger value="questionnaire" className="text-xs">Questionnaire</TabsTrigger>
          <TabsTrigger value="notes" className="text-xs">Notes</TabsTrigger>
          <TabsTrigger value="changes" className="text-xs">Change List</TabsTrigger>
          <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="billing">
            <BillingTab 
              storeId={storeId!} 
              billTo={visitData.billTo}
              onBillToChange={(value) => updateVisitData({ billTo: value })}
            />
          </TabsContent>

          <TabsContent value="stickers">
            <StickersTab 
              brands={brands}
              stickers={visitData.stickers}
              onStickersChange={(stickers) => updateVisitData({ stickers })}
            />
          </TabsContent>

          <TabsContent value="inventory">
            <InventoryTab 
              storeId={storeId!}
              products={products}
              brands={brands}
              inventory={visitData.inventory}
              onInventoryChange={(inventory) => updateVisitData({ inventory })}
            />
          </TabsContent>

          <TabsContent value="contacts">
            <ContactsTab 
              contacts={visitData.contacts}
              onContactsChange={(contacts) => updateVisitData({ contacts })}
              portalType={portalType}
            />
          </TabsContent>

          <TabsContent value="questionnaire">
            <QuestionnaireTab 
              questionnaire={visitData.questionnaire}
              onQuestionnaireChange={(questionnaire) => updateVisitData({ questionnaire })}
            />
          </TabsContent>

          <TabsContent value="notes">
            <NotesTab 
              internalNotes={visitData.internalNotes}
              relationshipNotes={visitData.relationshipNotes}
              nextFollowUp={visitData.nextFollowUp}
              nextFollowUpDate={visitData.nextFollowUpDate}
              onNotesChange={(updates) => updateVisitData(updates)}
            />
          </TabsContent>

          <TabsContent value="changes">
            <ChangeListTab 
              visitData={visitData}
              brands={brands}
              products={products}
            />
          </TabsContent>

          <TabsContent value="history">
            <VisitHistoryTab storeId={storeId!} />
          </TabsContent>
        </div>
      </Tabs>

      {/* Submit Button */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Ready to submit?</p>
              <p className="text-sm text-muted-foreground">
                Your changes will be sent to the Change Control Center for review.
              </p>
            </div>
            <Button 
              onClick={handleSubmitToChangeControl}
              disabled={submitting}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {submitting ? 'Submitting...' : 'Submit to Change Control'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
