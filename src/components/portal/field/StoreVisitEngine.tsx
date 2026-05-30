import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Send, AlertTriangle, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { getRLSErrorToast } from '@/lib/rls-error-handler';
import { submitFieldChange } from '@/services/fieldGovernance/submitFieldChange';
import type { FieldRole } from '@/services/fieldGovernance/types';
// NOTE: Stickers are now handled directly by BrandStickersCard which persists to DB
// The legacy stickerBrands config is deprecated for visit data

// Tab Components
import { BillingTab } from './visit-tabs/BillingTab';
import { StickersTab } from './visit-tabs/StickersTab';
import { InventoryTab } from './visit-tabs/InventoryTab';
import { ContactsTab } from './visit-tabs/ContactsTab';
import { QuestionnaireTab } from './visit-tabs/QuestionnaireTab';
import { NotesTab } from './visit-tabs/NotesTab';
import { ChangeListTab } from './visit-tabs/ChangeListTab';
import { VisitHistoryTab } from './visit-tabs/VisitHistoryTab';
import { TubeIntelTab } from './visit-tabs/TubeIntelTab';
import { DeliveryTasksTab } from './visit-tabs/DeliveryTasksTab';
import { FieldOrder } from './visit-tabs/CreateOrderSection';
import { InvoiceMode } from '@/components/invoice/InvoiceModeSelector';

// Updated contact interface with shirt size
interface Contact {
  id?: string;
  name: string;
  role: string;
  phone: string;
  responsiveByCall: boolean;
  responsiveByText: boolean;
  lastResponded: string | null;
  notes: string;
  shirtSize?: string;
}

// Global wholesaler interface (network-level, not store-owned)
interface GlobalWholesaler {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
}

interface WholesalerAssociation {
  wholesaler_id: string;
  wholesaler: GlobalWholesaler;
  isNew?: boolean;
}

// Connected store interface
interface ConnectedStoreData {
  id?: string;
  store_name: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  isNew?: boolean;
}

export interface StoreVisitData {
  storeId: string;
  storeName: string;
  storeAddress: string;
  // Billing
  billTo: 'bill_to_bill' | 'pay_upfront';
  // Field orders created during visit
  fieldOrders: FieldOrder[];
  // Legacy - stickers now handled directly by BrandStickersCard (persisted to DB immediately)
  // This field is deprecated but kept for backward compatibility
  stickers: Record<string, {
    frontDoor: boolean;
    authorizedRetailer: boolean;
    brandCharacter: boolean;
    telephoneNumber: boolean;
    notes: string;
  }>;
  // Inventory counts
  inventory: Record<string, number>;
  // Contacts (now includes shirt size)
  contacts: Contact[];
  // Global wholesaler associations (many-to-many, network-level)
  wholesalerAssociations: WholesalerAssociation[];
  // Connected stores (replaces storeCount)
  connectedStores: ConnectedStoreData[];
  // Questionnaire (simplified - no storeCount, no wholesalers array, no clothingSize)
  questionnaire: {
    secureLevel: 'low' | 'medium' | 'high';
    sellsFlowers: boolean;
    interestedInCleaning: boolean;
    additionalItemsWanted: string;
    topSellingItems: string;
    mostNeededItems: string;
  };
  // Notes
  internalNotes: string;
  relationshipNotes: string;
  nextFollowUp: string;
  nextFollowUpDate: string | null;
}

interface StoreVisitEngineProps {
  portalType: 'driver' | 'biker' | 'ambassador';
}

export function StoreVisitEngine({ portalType }: StoreVisitEngineProps) {
  const { storeId } = useParams<{ storeId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('tasks');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [store, setStore] = useState<{ id: string; store_name: string; address: string } | null>(null);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; brand_id: string; category: string }[]>([]);
  const [invoiceMode, setInvoiceMode] = useState<InvoiceMode>('live');
  
  const [visitData, setVisitData] = useState<StoreVisitData>({
    storeId: storeId || '',
    storeName: '',
    storeAddress: '',
    billTo: 'bill_to_bill',
    fieldOrders: [],
    stickers: {}, // Deprecated - stickers now saved directly via BrandStickersCard
    inventory: {},
    contacts: [],
    wholesalerAssociations: [], // Global wholesaler associations (network-level)
    connectedStores: [], // Connected stores replaces storeCount
    questionnaire: {
      secureLevel: 'medium',
      sellsFlowers: false,
      interestedInCleaning: false,
      additionalItemsWanted: '',
      topSellingItems: '',
      mostNeededItems: '',
    },
    internalNotes: '',
    relationshipNotes: '',
    nextFollowUp: '',
    nextFollowUpDate: null,
  });
  const [loadingConnectedStores, setLoadingConnectedStores] = useState(false);
  const [loadingWholesalers, setLoadingWholesalers] = useState(false);

  // Fetch store data, brands (for other sections), and products
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

        // Fetch brands (for inventory/other sections, NOT for stickers)
        const { data: brandsData } = await supabase
          .from('brands')
          .select('id, name')
          .order('name');

        if (brandsData) {
          setBrands(brandsData);
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

        // Fetch existing store contacts (now with shirt_size)
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
              shirtSize: c.shirt_size || '',
            })),
          }));
        }

        // Fetch existing wholesaler associations (global model)
        setLoadingWholesalers(true);
        const { data: associationsData } = await supabase
          .from('store_wholesaler_associations')
          .select(`
            wholesaler_id,
            wholesalers:wholesaler_id (
              id, name, address, city, state, phone
            )
          `)
          .eq('store_id', storeId);

        if (associationsData && associationsData.length > 0) {
          setVisitData(prev => ({
            ...prev,
            wholesalerAssociations: associationsData.map((a: any) => ({
              wholesaler_id: a.wholesaler_id,
              wholesaler: {
                id: a.wholesalers.id,
                name: a.wholesalers.name,
                address: a.wholesalers.address,
                city: a.wholesalers.city,
                state: a.wholesalers.state,
                phone: a.wholesalers.phone,
              },
            })),
          }));
        }
        setLoadingWholesalers(false);

        // Fetch existing questionnaire (simplified fields only - no storeCount)
        const { data: questionnaireData } = await supabase
          .from('store_questionnaire')
          .select('*')
          .eq('store_id', storeId)
          .single();

        if (questionnaireData) {
          setVisitData(prev => ({
            ...prev,
            questionnaire: {
              secureLevel: ((questionnaireData as any).security_level as 'low' | 'medium' | 'high') || 'medium',
              sellsFlowers: (questionnaireData as any).sells_flowers || false,
              interestedInCleaning: (questionnaireData as any).interested_cleaning_service || false,
              additionalItemsWanted: (questionnaireData as any).additional_items_wanted || '',
              topSellingItems: (questionnaireData as any).top_selling_items || '',
              mostNeededItems: (questionnaireData as any).most_needed_items || '',
            },
          }));
        }

        // Fetch connected stores (stores with same connected_group_id)
        setLoadingConnectedStores(true);
        const { data: currentStoreData } = await supabase
          .from('store_master')
          .select('connected_group_id')
          .eq('id', storeId)
          .single();

        if (currentStoreData?.connected_group_id) {
          const { data: connectedData } = await supabase
            .from('store_master')
            .select('id, store_name, address, city, state, phone')
            .eq('connected_group_id', currentStoreData.connected_group_id)
            .neq('id', storeId);

          if (connectedData && connectedData.length > 0) {
            setVisitData(prev => ({
              ...prev,
              connectedStores: connectedData.map(s => ({
                id: s.id,
                store_name: s.store_name,
                address: s.address,
                city: s.city,
                state: s.state,
                phone: s.phone || '',
              })),
            }));
          }
        }
        setLoadingConnectedStores(false);

      } catch (error) {
        console.error('Error fetching data:', error);
        setLoadingConnectedStores(false);
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

      // Build change items - entity_id is now TEXT so string IDs work
      // Type the items to match what Supabase expects
      interface ChangeItem {
        change_list_id: string;
        entity_type: string;
        entity_id: string;
        field_name: string;
        new_value: { count?: number; value?: unknown };
      }
      
      const changeItems: ChangeItem[] = [];

      // Inventory changes (product IDs are UUIDs, stored as text)
      Object.entries(visitData.inventory)
        .filter(([_, count]) => count > 0)
        .forEach(([productId, count]) => {
          changeItems.push({
            change_list_id: changeList.id,
            entity_type: 'inventory',
            entity_id: productId,
            field_name: 'quantity',
            new_value: { count },
          });
        });

      // NOTE: Sticker changes are now saved directly to DB via BrandStickersCard
      // They no longer go through the change list system - this is intentional
      // Stickers are immediately persisted for operational efficiency

      // Questionnaire changes (only the 4 simplified fields)
      Object.entries(visitData.questionnaire).forEach(([key, value]) => {
        changeItems.push({
          change_list_id: changeList.id,
          entity_type: 'store_questionnaire',
          entity_id: storeId,
          field_name: key,
          new_value: { value },
        });
      });

      // Insert change list items - use type assertion for JSON compatibility
      if (changeItems.length > 0) {
        const insertData = changeItems.map(item => ({
          change_list_id: item.change_list_id,
          entity_type: item.entity_type,
          entity_id: item.entity_id,
          field_name: item.field_name,
          new_value: item.new_value as Json,
        }));
        
        const { error: itemsError } = await supabase
          .from('change_list_items')
          .insert(insertData);

        if (itemsError) throw itemsError;
      }

      // ═══════════════════════════════════════════════════════
      // GOVERNED: Submit contacts through field governance
      // ═══════════════════════════════════════════════════════
      for (const contact of visitData.contacts) {
        if (contact.id) {
          await submitFieldChange({
            store_id: storeId,
            entity_type: 'store_contact',
            entity_id: contact.id,
            action_type: 'update',
            payload_after: {
              name: contact.name,
              role: contact.role,
              phone: contact.phone,
              responsive_by_call: contact.responsiveByCall,
              responsive_by_text: contact.responsiveByText,
              notes: contact.notes,
              shirt_size: contact.shirtSize || null,
            },
          }, user.id, portalType as FieldRole);
        } else if (contact.name.trim()) {
          await submitFieldChange({
            store_id: storeId,
            entity_type: 'store_contact',
            action_type: 'create',
            payload_after: {
              name: contact.name,
              role: contact.role,
              phone: contact.phone,
              responsive_by_call: contact.responsiveByCall,
              responsive_by_text: contact.responsiveByText,
              notes: contact.notes,
              shirt_size: contact.shirtSize || null,
            },
          }, user.id, portalType as FieldRole);
        }
      }

      // ═══════════════════════════════════════════════════════
      // GOVERNED: Submit wholesaler associations through field governance
      // ═══════════════════════════════════════════════════════
      for (const assoc of visitData.wholesalerAssociations) {
        if (assoc.wholesaler_id.startsWith('temp-')) {
          await submitFieldChange({
            store_id: storeId,
            entity_type: 'wholesaler_association',
            action_type: 'create',
            payload_after: {
              wholesaler_name: assoc.wholesaler.name,
              wholesaler_address: assoc.wholesaler.address,
              wholesaler_city: assoc.wholesaler.city,
              wholesaler_state: assoc.wholesaler.state,
              wholesaler_phone: assoc.wholesaler.phone,
            },
          }, user.id, portalType as FieldRole);
        } else if (assoc.isNew) {
          await submitFieldChange({
            store_id: storeId,
            entity_type: 'wholesaler_association',
            entity_id: assoc.wholesaler_id,
            action_type: 'create',
            payload_after: {
              wholesaler_id: assoc.wholesaler_id,
              wholesaler_name: assoc.wholesaler.name,
            },
          }, user.id, portalType as FieldRole);
        }
      }

      // ═══════════════════════════════════════════════════════
      // GOVERNED: Submit connected stores through field governance
      // ═══════════════════════════════════════════════════════
      for (const connectedStore of visitData.connectedStores) {
        if (connectedStore.isNew && connectedStore.store_name.trim()) {
          await submitFieldChange({
            store_id: storeId,
            entity_type: 'connected_store',
            action_type: 'create',
            payload_after: {
              store_name: connectedStore.store_name,
              address: connectedStore.address,
              city: connectedStore.city,
              state: connectedStore.state,
              phone: connectedStore.phone,
            },
          }, user.id, portalType as FieldRole);
        }
      }

      // ═══════════════════════════════════════════════════════
      // GOVERNED: Submit questionnaire through field governance
      // ═══════════════════════════════════════════════════════
      await submitFieldChange({
        store_id: storeId,
        entity_type: 'store_questionnaire',
        action_type: 'update',
        payload_after: {
          security_level: visitData.questionnaire.secureLevel,
          sells_flowers: visitData.questionnaire.sellsFlowers,
          interested_cleaning_service: visitData.questionnaire.interestedInCleaning,
          additional_items_wanted: visitData.questionnaire.additionalItemsWanted || null,
          top_selling_items: visitData.questionnaire.topSellingItems || null,
          most_needed_items: visitData.questionnaire.mostNeededItems || null,
        },
      }, user.id, portalType as FieldRole);

      // Create field orders as invoices with proper mode separation
      if (visitData.fieldOrders.length > 0) {
        const { data: userData } = await supabase.auth.getUser();
        const createdBy = userData?.user?.email || portalType;
        
        for (const order of visitData.fieldOrders) {
          // Generate invoice number
          const invoiceNumber = `FLD-${Date.now()}-${order.brand_id.slice(0, 4).toUpperCase()}`;
          
          // Create invoice with is_historical flag based on mode
          const { data: invoice, error: invoiceError } = await supabase
            .from('invoices')
            .insert({
              invoice_number: invoiceNumber,
              store_id: storeId,
              total_amount: order.subtotal,
              subtotal: order.subtotal,
              total: order.subtotal,
              amount_paid: 0,
              due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days
              payment_status: 'unpaid',
              brand: order.brand_name,
              notes: order.notes || `Field order created by ${portalType} during store visit`,
              created_by: createdBy,
              is_historical: invoiceMode === 'historical',
              entry_mode: invoiceMode === 'historical' ? 'backfill' : 'live',
            })
            .select('id')
            .single();

          if (invoiceError) {
            console.error('Error creating invoice:', invoiceError);
            continue;
          }

          // Create line items
          if (invoice) {
            const lineItems = order.line_items.map(item => ({
              invoice_id: invoice.id,
              product_id: item.product_id,
              product_name: item.product_name,
              brand: item.brand_name,
              brand_id: item.brand_id,
              quantity: item.quantity,
              unit_type: item.unit_type,
              unit_price: item.unit_price,
              total: item.total,
            }));

            await supabase
              .from('invoice_line_items')
              .insert(lineItems);

            // Send receipt text for LIVE invoices only (not historical)
            if (invoiceMode === 'live') {
              try {
                await supabase.functions.invoke('send-invoice-receipt', {
                  body: {
                    invoice_id: invoice.id,
                    store_id: storeId,
                    invoice_number: invoiceNumber,
                    total_amount: order.subtotal,
                    store_name: visitData.storeName,
                    is_historical: false,
                  },
                });
              } catch (receiptErr) {
                console.error('Error sending receipt:', receiptErr);
                // Don't fail submission if receipt fails
              }
            }
          }
        }
      }

      toast({
        title: 'Visit Submitted for Review',
        description: 'Your changes have been submitted and are pending admin approval. You will see the updates once approved.',
      });

      navigate(portalType === 'driver' ? '/portal/driver' : '/portal/biker');
    } catch (error) {
      console.error('Error submitting visit:', error);
      toast(getRLSErrorToast(error));
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
        <TabsList className="grid w-full grid-cols-5 lg:grid-cols-10 h-auto">
          <TabsTrigger value="tasks" className="text-xs">✅ Tasks</TabsTrigger>
          <TabsTrigger value="billing" className="text-xs">Billing</TabsTrigger>
          <TabsTrigger value="stickers" className="text-xs">Stickers</TabsTrigger>
          <TabsTrigger value="tube-intel" className="text-xs">Tube Intel</TabsTrigger>
          <TabsTrigger value="inventory" className="text-xs">Inventory</TabsTrigger>
          <TabsTrigger value="contacts" className="text-xs">Contacts</TabsTrigger>
          <TabsTrigger value="questionnaire" className="text-xs">Questionnaire</TabsTrigger>
          <TabsTrigger value="notes" className="text-xs">Notes</TabsTrigger>
          <TabsTrigger value="changes" className="text-xs">Change List</TabsTrigger>
          <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="tasks">
            <DeliveryTasksTab storeId={storeId!} storeName={store?.store_name} />
          </TabsContent>
          <TabsContent value="billing">
            <BillingTab 
              storeId={storeId!} 
              billTo={visitData.billTo}
              onBillToChange={(value) => updateVisitData({ billTo: value })}
              fieldOrders={visitData.fieldOrders}
              onFieldOrdersChange={(fieldOrders) => updateVisitData({ fieldOrders })}
              invoiceMode={invoiceMode}
              onInvoiceModeChange={setInvoiceMode}
            />
          </TabsContent>

          <TabsContent value="stickers">
            <StickersTab 
              storeId={storeId!}
              role={portalType === 'driver' ? 'driver' : portalType === 'biker' ? 'biker' : 'ambassador'}
            />
          </TabsContent>

          <TabsContent value="tube-intel">
            <TubeIntelTab storeId={storeId!} portalType={portalType} />
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
              currentStoreId={storeId!}
              connectedStores={visitData.connectedStores}
              onConnectedStoresChange={(connectedStores) => updateVisitData({ connectedStores })}
              isLoadingConnectedStores={loadingConnectedStores}
              wholesalerAssociations={visitData.wholesalerAssociations}
              onWholesalerAssociationsChange={(wholesalerAssociations) => updateVisitData({ wholesalerAssociations })}
              isLoadingWholesalers={loadingWholesalers}
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

      {/* Governance Notice */}
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400">
        <Shield className="h-4 w-4 shrink-0" />
        <span className="text-sm">
          All changes require admin approval before taking effect.
        </span>
      </div>

      {/* Submit Button */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Ready to submit?</p>
              <p className="text-sm text-muted-foreground">
                Your changes will be submitted for admin review and approval.
              </p>
            </div>
            <Button 
              onClick={handleSubmitToChangeControl}
              disabled={submitting}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {submitting ? 'Submitting...' : 'Submit for Approval'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
