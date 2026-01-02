import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, ArrowRight } from 'lucide-react';
import { StoreVisitData } from '../StoreVisitEngine';

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

  // Sticker changes
  Object.entries(visitData.stickers).forEach(([brandId, stickers]) => {
    const brand = brands.find(b => b.id === brandId);
    Object.entries(stickers).forEach(([key, value]) => {
      if (key !== 'notes' && value === true) {
        changes.push({
          category: 'Stickers',
          field: `${brand?.name || brandId} - ${formatKey(key)}`,
          oldValue: '—',
          newValue: 'Yes',
        });
      }
      if (key === 'notes' && value) {
        changes.push({
          category: 'Stickers',
          field: `${brand?.name || brandId} - Notes`,
          oldValue: '—',
          newValue: value as string,
        });
      }
    });
  });

  // Questionnaire changes
  if (visitData.questionnaire.storeCount > 1) {
    changes.push({
      category: 'Questionnaire',
      field: 'Store Count',
      oldValue: '—',
      newValue: visitData.questionnaire.storeCount.toString(),
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
  if (visitData.questionnaire.wholesalers.length > 0) {
    changes.push({
      category: 'Questionnaire',
      field: 'Wholesalers',
      oldValue: '—',
      newValue: visitData.questionnaire.wholesalers.join(', '),
    });
  }
  if (visitData.questionnaire.clothingSize) {
    changes.push({
      category: 'Questionnaire',
      field: 'Clothing Size',
      oldValue: '—',
      newValue: visitData.questionnaire.clothingSize,
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

  // Contact changes
  visitData.contacts.forEach((contact, index) => {
    if (contact.name) {
      changes.push({
        category: 'Contacts',
        field: `Contact #${index + 1}`,
        oldValue: contact.id ? 'Updated' : 'New',
        newValue: `${contact.name} (${contact.role}) - ${contact.phone}`,
      });
    }
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
