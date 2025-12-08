import { useBusinessStore } from '@/stores/businessStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Building2, Phone, Megaphone } from 'lucide-react';

interface BusinessCampaignFiltersProps {
  selectedCampaign?: string;
  onCampaignChange?: (campaignId: string) => void;
  selectedPhoneNumber?: string;
  onPhoneNumberChange?: (phoneId: string) => void;
  showPhoneFilter?: boolean;
  showCampaignFilter?: boolean;
}

// Mock data - in production this would come from the database
const mockCampaigns = [
  { id: 'all', name: 'All Campaigns' },
  { id: 'camp-1', name: 'Reactivation Blast' },
  { id: 'camp-2', name: 'New Store Welcome' },
  { id: 'camp-3', name: 'Product Launch' },
  { id: 'camp-4', name: 'High-Risk Recovery' },
];

const mockPhoneNumbers = [
  { id: 'all', number: 'All Numbers' },
  { id: 'phone-1', number: '+1 (555) 123-4567 (Main)' },
  { id: 'phone-2', number: '+1 (555) 234-5678 (Reactivation)' },
  { id: 'phone-3', number: '+1 (555) 345-6789 (Promo)' },
];

export const BusinessCampaignFilters = ({
  selectedCampaign = 'all',
  onCampaignChange,
  selectedPhoneNumber = 'all',
  onPhoneNumberChange,
  showPhoneFilter = true,
  showCampaignFilter = true,
}: BusinessCampaignFiltersProps) => {
  const { businesses, selectedBusiness, switchBusiness } = useBusinessStore();

  return (
    <div className="flex flex-wrap items-end gap-4 p-4 bg-card/50 rounded-lg border border-border">
      {/* Business Filter */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground flex items-center gap-1">
          <Building2 className="h-3 w-3" />
          Business
        </Label>
        <Select
          value={selectedBusiness?.id || ''}
          onValueChange={switchBusiness}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select business" />
          </SelectTrigger>
          <SelectContent>
            {businesses.map((business) => (
              <SelectItem key={business.id} value={business.id}>
                {business.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Campaign Filter */}
      {showCampaignFilter && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Megaphone className="h-3 w-3" />
            Campaign
          </Label>
          <Select
            value={selectedCampaign}
            onValueChange={onCampaignChange}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select campaign" />
            </SelectTrigger>
            <SelectContent>
              {mockCampaigns.map((campaign) => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Phone Number Filter */}
      {showPhoneFilter && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Phone className="h-3 w-3" />
            Phone Number
          </Label>
          <Select
            value={selectedPhoneNumber}
            onValueChange={onPhoneNumberChange}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Select number" />
            </SelectTrigger>
            <SelectContent>
              {mockPhoneNumbers.map((phone) => (
                <SelectItem key={phone.id} value={phone.id}>
                  {phone.number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
};

export default BusinessCampaignFilters;
