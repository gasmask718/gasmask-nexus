import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Filter, Download } from 'lucide-react';
import CampaignMethodModal from './CampaignMethodModal';
import { toast } from 'sonner';

interface CRMSegmentationModuleProps {
  brand: string;
  brandColor?: string;
}

export default function CRMSegmentationModule({ brand, brandColor = '#6366f1' }: CRMSegmentationModuleProps) {
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);

  const handleCampaignMethodSelect = (method: 'sms' | 'email' | 'ai-call' | 'va-call') => {
    toast.success(`Campaign method selected: ${method}`);
  };

  const segments = [
    { name: 'All Contacts', count: 1250, color: 'default' },
    { name: 'Customers', count: 820, color: 'default' },
    { name: 'Stores', count: 145, color: 'secondary' },
    { name: 'Ambassadors', count: 34, color: 'secondary' },
    { name: 'Inactive (30+ days)', count: 210, color: 'destructive' },
    { name: 'High Value', count: 78, color: 'default' },
    { name: 'New (7 days)', count: 42, color: 'default' },
  ];

  const filters = [
    'Product Interest',
    'Last Contact Date',
    'Geography',
    'Order Frequency',
    'Revenue Tier',
    'Store Category',
    'Employee Role',
    'Engagement Score'
  ];

  return (
    <div className="space-y-4">
      <Card style={{ borderTop: `4px solid ${brandColor}` }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" style={{ color: brandColor }} />
            CRM Segments for {brand}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="space-y-2">
            <Label>Search Contacts</Label>
            <Input placeholder="Search by name, email, phone..." />
          </div>

          {/* Quick Segments */}
          <div className="space-y-2">
            <Label>Quick Segments</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {segments.map((segment) => (
                <Button
                  key={segment.name}
                  variant="outline"
                  className="justify-between h-auto py-3"
                >
                  <span className="text-sm">{segment.name}</span>
                  <Badge variant={segment.color as any}>{segment.count}</Badge>
                </Button>
              ))}
            </div>
          </div>

          {/* Advanced Filters */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Advanced Filters
            </Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {filters.map((filter) => (
                <Badge key={filter} variant="outline" className="justify-center py-2 cursor-pointer hover:bg-primary hover:text-primary-foreground">
                  {filter}
                </Badge>
              ))}
            </div>
          </div>

          {/* Selected Segment Info */}
          <div className="p-4 rounded-lg border" style={{ backgroundColor: `${brandColor}10` }}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">Current Selection:</span>
              <Badge>1,250 contacts</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              All contacts for {brand} brand
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button 
              className="flex-1" 
              style={{ backgroundColor: brandColor, color: 'white' }}
              onClick={() => setCampaignModalOpen(true)}
            >
              Use in Campaign
            </Button>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>

          <CampaignMethodModal
            open={campaignModalOpen}
            onClose={() => setCampaignModalOpen(false)}
            onSelect={handleCampaignMethodSelect}
            brandColor={brandColor}
          />

          {/* Recent Activity */}
          <div className="space-y-2">
            <Label>Recent Segment Activity</Label>
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-3 rounded-lg border text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Inactive Customers Campaign</span>
                    <Badge variant="outline">210 contacts</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Created 2 days ago</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
