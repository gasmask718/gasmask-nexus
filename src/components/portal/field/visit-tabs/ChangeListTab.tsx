import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, ArrowRight } from 'lucide-react';
import { StoreVisitData } from '../StoreVisitEngine';
import { STICKER_BRANDS } from '@/config/stickerBrands';

interface ChangeListTabProps {
  visitData: StoreVisitData;
  brands: { id: string; name: string }[];
  products: { id: string; name: string; brand_id: string; category: string }[];
}

interface ChangeItem {
  category: string;
  field: string;
  oldValue: string;
  newValue: string;
}

export function ChangeListTab({ visitData, brands, products }: ChangeListTabProps) {
  const changes: ChangeItem[] = [];

  // Inventory changes
  Object.entries(visitData.inventory).forEach(([productId, count]) => {
    if (count > 0) {
      const product = products.find(p => p.id === productId);
      const brand = brands.find(b => b.id === product?.brand_id);
      changes.push({
        category: 'Inventory',
        field: `${brand?.name || 'Unknown'} - ${product?.name || productId}`,
        oldValue: '—',
        newValue: count.toString(),
      });
    }
  });

  // Sticker changes - USE HARD-LOCKED STICKER BRANDS
  Object.entries(visitData.stickers).forEach(([brandId, stickers]) => {
    // Find brand name from hardcoded sticker brands ONLY
    const stickerBrand = STICKER_BRANDS.find(b => b.id === brandId);
    if (!stickerBrand) return; // Skip any brands not in the approved list
    
    Object.entries(stickers).forEach(([key, value]) => {
      if (key !== 'notes' && value === true) {
        changes.push({
          category: 'Stickers',
          field: `${stickerBrand.name} - ${formatKey(key)}`,
          oldValue: '—',
          newValue: 'Yes',
        });
      }
      if (key === 'notes' && value) {
        changes.push({
          category: 'Stickers',
          field: `${stickerBrand.name} - Notes`,
          oldValue: '—',
          newValue: value as string,
        });
      }
    });
  });

  // Connected Stores changes (replaces storeCount)
  if (visitData.connectedStores && visitData.connectedStores.length > 0) {
    const totalLocations = visitData.connectedStores.length + 1; // +1 for current store
    changes.push({
      category: 'Connected Stores',
      field: 'Total Locations',
      oldValue: '1',
      newValue: totalLocations.toString(),
    });
    visitData.connectedStores.forEach((store, index) => {
      changes.push({
        category: 'Connected Stores',
        field: `Location ${index + 2}`,
        oldValue: '—',
        newValue: `${store.store_name} - ${store.address}, ${store.city}, ${store.state}`,
      });
    });
  }
  if (visitData.questionnaire.secureLevel !== 'medium') {
    changes.push({
      category: 'Questionnaire',
      field: 'Security Level',
      oldValue: '—',
      newValue: visitData.questionnaire.secureLevel,
    });
  }
  if (visitData.questionnaire.sellsFlowers) {
    changes.push({
      category: 'Questionnaire',
      field: 'Sells Flowers',
      oldValue: '—',
      newValue: 'Yes',
    });
  }
  if (visitData.questionnaire.interestedInCleaning) {
    changes.push({
      category: 'Questionnaire',
      field: 'Interested in Cleaning',
      oldValue: '—',
      newValue: 'Yes',
    });
  }

  // Wholesaler association changes (global model)
  visitData.wholesalerAssociations?.forEach((assoc, index) => {
    if (assoc.wholesaler.name) {
      const addressParts = [assoc.wholesaler.address, assoc.wholesaler.city, assoc.wholesaler.state].filter(Boolean);
      changes.push({
        category: 'Wholesaler Associations',
        field: `Wholesaler #${index + 1}`,
        oldValue: assoc.isNew ? 'New Association' : 'Existing',
        newValue: `${assoc.wholesaler.name}${assoc.wholesaler.phone ? ` - ${assoc.wholesaler.phone}` : ''}${addressParts.length > 0 ? ` (${addressParts.join(', ')})` : ''}`,
      });
    }
  });

  // Contact changes (now includes shirt size)
  visitData.contacts.forEach((contact, index) => {
    if (contact.name) {
      const shirtInfo = contact.shirtSize ? ` | Shirt: ${contact.shirtSize}` : '';
      changes.push({
        category: 'Contacts',
        field: `Contact #${index + 1}`,
        oldValue: contact.id ? 'Updated' : 'New',
        newValue: `${contact.name} (${contact.role}) - ${contact.phone}${shirtInfo}`,
      });
    }
  });

  // Field Orders changes
  visitData.fieldOrders?.forEach((order, index) => {
    const itemCount = order.line_items.length;
    const itemSummary = order.line_items.map(item => `${item.product_name} x${item.quantity}`).join(', ');
    changes.push({
      category: 'Field Orders',
      field: `${order.brand_name} Order`,
      oldValue: 'New Order',
      newValue: `$${order.subtotal.toFixed(2)} (${itemCount} item${itemCount !== 1 ? 's' : ''})`,
    });
    // Add line item details
    order.line_items.forEach(item => {
      changes.push({
        category: 'Field Orders',
        field: `  └ ${item.product_name}`,
        oldValue: '—',
        newValue: `${item.quantity} ${item.unit_type} @ $${item.unit_price.toFixed(2)} = $${item.total.toFixed(2)}`,
      });
    });
  });

  // Notes changes
  if (visitData.internalNotes) {
    changes.push({
      category: 'Notes',
      field: 'Internal Notes',
      oldValue: '—',
      newValue: visitData.internalNotes.substring(0, 50) + (visitData.internalNotes.length > 50 ? '...' : ''),
    });
  }
  if (visitData.relationshipNotes) {
    changes.push({
      category: 'Notes',
      field: 'Relationship Notes',
      oldValue: '—',
      newValue: visitData.relationshipNotes.substring(0, 50) + (visitData.relationshipNotes.length > 50 ? '...' : ''),
    });
  }
  if (visitData.nextFollowUp) {
    changes.push({
      category: 'Notes',
      field: 'Next Follow-Up',
      oldValue: '—',
      newValue: visitData.nextFollowUp.substring(0, 50) + (visitData.nextFollowUp.length > 50 ? '...' : ''),
    });
  }

  // Group by category
  const grouped = changes.reduce((acc, change) => {
    if (!acc[change.category]) {
      acc[change.category] = [];
    }
    acc[change.category].push(change);
    return acc;
  }, {} as Record<string, ChangeItem[]>);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Change List Preview
        </CardTitle>
        <CardDescription>
          These proposed changes will be submitted to the Change Control Center for review.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {changes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No changes recorded yet.</p>
            <p className="text-sm mt-1">Fill out the other tabs to create changes.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Badge variant="outline">{category}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {items.length} change{items.length !== 1 ? 's' : ''}
                  </span>
                </h3>
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <div 
                      key={index} 
                      className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30"
                    >
                      <span className="font-medium text-sm flex-shrink-0">{item.field}</span>
                      <div className="flex items-center gap-2 text-sm flex-1 min-w-0">
                        <span className="text-muted-foreground truncate">{item.oldValue}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-primary truncate">{item.newValue}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase());
}
