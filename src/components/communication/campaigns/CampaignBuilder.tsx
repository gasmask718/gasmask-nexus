// ═══════════════════════════════════════════════════════════════════════════════
// CAMPAIGN BUILDER WITH VERTICAL ENFORCEMENT
// Only allows cross-promotion within the same vertical
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Send, 
  Phone, 
  MessageSquare, 
  Mail,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Users,
  Target
} from 'lucide-react';
import { VerticalBrandCombo } from '../verticals/VerticalSelector';
import { VerticalRulesDisplay, VerticalValidationStatus } from '../verticals/VerticalGuard';
import { type VerticalSlug, VERTICALS, getCrossPromotionInfo } from '@/config/verticals';
import { useVerticalEnforcement } from '@/hooks/useVerticals';
import { toast } from 'sonner';

interface CampaignBuilderProps {
  onCampaignCreate?: (campaign: any) => void;
}

export default function CampaignBuilder({ onCampaignCreate }: CampaignBuilderProps) {
  const [campaignName, setCampaignName] = useState('');
  const [channel, setChannel] = useState<'sms' | 'call' | 'email'>('sms');
  const [selectedVertical, setSelectedVertical] = useState<VerticalSlug | null>(null);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [messageContent, setMessageContent] = useState('');
  const [targetSegment, setTargetSegment] = useState<string>('all_stores');
  
  const { validateContent, getEnforcedSystemPrompt } = useVerticalEnforcement();
  
  // Validate content against vertical rules
  const validation = selectedVertical 
    ? validateContent(messageContent, selectedVertical)
    : { isValid: true, violations: [] };
  
  const handleCreateCampaign = () => {
    if (!campaignName || !selectedVertical || selectedBrands.length === 0) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    if (!validation.isValid) {
      toast.error('Campaign content violates vertical rules');
      return;
    }
    
    // Get enforced system prompt for AI calls
    const systemPrompt = getEnforcedSystemPrompt(selectedVertical, '');
    
    const campaign = {
      name: campaignName,
      channel,
      vertical: selectedVertical,
      brands: selectedBrands,
      message: messageContent,
      targetSegment,
      systemPrompt,
      enforcedRules: getCrossPromotionInfo(selectedVertical),
    };
    
    toast.success('Campaign created with vertical enforcement');
    onCampaignCreate?.(campaign);
  };
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Form */}
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Campaign Builder
            </CardTitle>
            <CardDescription>
              Create campaigns with vertical enforcement - only pitch allowed brands
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Campaign Name */}
            <div className="space-y-2">
              <Label>Campaign Name</Label>
              <Input 
                placeholder="e.g. GasMask Restock - December"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
              />
            </div>
            
            {/* Channel Selection */}
            <div className="space-y-2">
              <Label>Channel</Label>
              <div className="flex gap-2">
                <Button 
                  variant={channel === 'sms' ? 'default' : 'outline'}
                  onClick={() => setChannel('sms')}
                  className="flex-1"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  SMS
                </Button>
                <Button 
                  variant={channel === 'call' ? 'default' : 'outline'}
                  onClick={() => setChannel('call')}
                  className="flex-1"
                >
                  <Phone className="h-4 w-4 mr-2" />
                  AI Call
                </Button>
                <Button 
                  variant={channel === 'email' ? 'default' : 'outline'}
                  onClick={() => setChannel('email')}
                  className="flex-1"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
              </div>
            </div>
            
            {/* Vertical & Brand Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Vertical & Brands
              </Label>
              <VerticalBrandCombo
                selectedVertical={selectedVertical}
                onVerticalChange={setSelectedVertical}
                selectedBrands={selectedBrands}
                onBrandsChange={setSelectedBrands}
              />
            </div>
            
            {/* Target Segment */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Target Segment
              </Label>
              <Select value={targetSegment} onValueChange={setTargetSegment}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_stores">All Stores</SelectItem>
                  <SelectItem value="active_stores">Active Stores (ordered in 30 days)</SelectItem>
                  <SelectItem value="inactive_stores">Inactive Stores (no orders in 30+ days)</SelectItem>
                  <SelectItem value="high_value">High Value Stores ($500+/month)</SelectItem>
                  <SelectItem value="low_stock">Low Stock Alert Stores</SelectItem>
                  <SelectItem value="new_stores">New Stores (first 60 days)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Message Content */}
            <div className="space-y-2">
              <Label>Message Content</Label>
              <Textarea 
                placeholder={`Enter your ${channel === 'call' ? 'script' : 'message'} here...`}
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                rows={6}
              />
              
              {/* Validation Status */}
              {messageContent && selectedVertical && (
                <VerticalValidationStatus 
                  isValid={validation.isValid}
                  violations={validation.violations}
                />
              )}
            </div>
            
            {/* Create Button */}
            <Button 
              className="w-full" 
              size="lg"
              onClick={handleCreateCampaign}
              disabled={!validation.isValid || !campaignName || selectedBrands.length === 0}
            >
              <Send className="h-4 w-4 mr-2" />
              Create Campaign
            </Button>
          </CardContent>
        </Card>
      </div>
      
      {/* Vertical Rules Sidebar */}
      <div className="space-y-4">
        {selectedVertical ? (
          <>
            <VerticalRulesDisplay verticalSlug={selectedVertical} />
            
            {/* Selected Brands Summary */}
            {selectedBrands.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Campaign Brands
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {selectedBrands.map(brand => (
                      <Badge key={brand} variant="secondary">
                        {brand}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    AI can cross-promote all selected brands within calls/messages
                  </p>
                </CardContent>
              </Card>
            )}
            
            {/* AI System Prompt Preview */}
            <Card className="bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">AI System Prompt (Preview)</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                  {VERTICALS[selectedVertical]?.systemPromptPrefix.slice(0, 300)}...
                </pre>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="bg-muted/30">
            <CardContent className="py-12 text-center">
              <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                Select a vertical to see enforcement rules
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
