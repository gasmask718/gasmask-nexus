import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Send, Mail, Phone, Users, BarChart3, Upload, Shield } from 'lucide-react';
import { useVAPermissions } from '@/hooks/useVAPermissions';
import BlastTextModule from '@/components/communications/BlastTextModule';
import BlastEmailModule from '@/components/communications/BlastEmailModule';
import AIVoiceCallModule from '@/components/communications/AIVoiceCallModule';
import VACallPanel from '@/components/communications/VACallPanel';
import CRMSegmentationModule from '@/components/communications/CRMSegmentationModule';
import BatchUploadModule from '@/components/communications/BatchUploadModule';
import ConversationsView from '@/components/communications/ConversationsView';

// Brand configurations with their colors and voice personas
const brands = [
  {
    id: 'gasmask',
    name: 'GasMask',
    colors: { primary: '#D30000', secondary: '#000000', accent: '#FF4444' },
    voicePersona: 'street-lux confident tone',
    description: 'Premium street luxury products'
  },
  {
    id: 'hotmama',
    name: 'HotMama',
    colors: { primary: '#B76E79', secondary: '#000000', accent: '#E0BFB8' },
    voicePersona: 'warm, feminine luxury',
    description: 'Feminine luxury brand'
  },
  {
    id: 'grabba',
    name: 'Grabba R Us',
    colors: { primary: '#FFD400', secondary: '#245BFF', accent: '#7CF4A6' },
    voicePersona: 'NY casual & friendly',
    description: 'Colorful NYC bodega aesthetic'
  },
  {
    id: 'scalati',
    name: 'Hot Scalati',
    colors: { primary: '#5A3A2E', secondary: '#FF7A00', accent: '#8B4513' },
    voicePersona: 'warm and inviting',
    description: 'Chocolate and fire aesthetic'
  },
  {
    id: 'toptier',
    name: 'TopTier Experience',
    colors: { primary: '#000000', secondary: '#C0C0C0', accent: '#808080' },
    voicePersona: 'professional chauffeur logic',
    description: 'Premium transportation services'
  },
  {
    id: 'utusa',
    name: 'Unforgettable Times USA',
    colors: { primary: '#A020F0', secondary: '#FF2AA3', accent: '#FFD700' },
    voicePersona: 'nightlife smooth tone',
    description: 'Party and event services'
  },
  {
    id: 'iclean',
    name: 'iClean WeClean',
    colors: { primary: '#0094FF', secondary: '#00C853', accent: '#40C4FF' },
    voicePersona: 'professional and reliable',
    description: 'Cleaning services'
  },
  {
    id: 'playboxxx',
    name: 'Playboxxx',
    colors: { primary: '#FF00C8', secondary: '#00E4FF', accent: '#FF6EC7' },
    voicePersona: 'nightlife smooth tone',
    description: 'Adult entertainment platform'
  },
  {
    id: 'funding',
    name: 'Funding Company',
    colors: { primary: '#FFD700', secondary: '#000000', accent: '#FFA500' },
    voicePersona: 'formal financial tone',
    description: 'Business funding services'
  },
  {
    id: 'grants',
    name: 'Grant System',
    colors: { primary: '#2E7D32', secondary: '#1B5E20', accent: '#4CAF50' },
    voicePersona: 'professional and supportive',
    description: 'Grant application services'
  },
  {
    id: 'credit',
    name: 'Credit Repair',
    colors: { primary: '#1976D2', secondary: '#0D47A1', accent: '#42A5F5' },
    voicePersona: 'confident and reassuring',
    description: 'Credit repair and deletions'
  },
  {
    id: 'specialneeds',
    name: 'Special Needs App',
    colors: { primary: '#A8D8FF', secondary: '#D1A7FF', accent: '#A7FFD1' },
    voicePersona: 'calm and empathetic',
    description: 'Special needs support platform'
  },
  {
    id: 'betting',
    name: 'Sports Betting',
    colors: { primary: '#FF5722', secondary: '#BF360C', accent: '#FF7043' },
    voicePersona: 'firm, analytical tone',
    description: 'Sports betting platform'
  },
  {
    id: 'dynasty',
    name: 'Dynasty (Internal)',
    colors: { primary: '#424242', secondary: '#212121', accent: '#616161' },
    voicePersona: 'executive and strategic',
    description: 'Internal communications'
  }
];

export default function CommunicationsCenterOverview() {
  const [selectedBrand, setSelectedBrand] = useState(brands[0]);
  const [activeModule, setActiveModule] = useState<'text' | 'email' | 'voice' | 'va-call' | 'crm' | 'batch' | 'conversations'>('text');
  const { getAllowedBrands, isLoading: permissionsLoading } = useVAPermissions();

  // Filter brands based on VA permissions
  const allowedBrandNames = getAllowedBrands();
  const filteredBrands = brands.filter(brand => 
    allowedBrandNames.includes(brand.name) || allowedBrandNames.length === 0
  );

  // If loading permissions, show loading state
  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Shield className="w-12 h-12 mx-auto mb-4 animate-pulse" />
          <p>Loading permissions...</p>
        </div>
      </div>
    );
  }

  // If no access to any brands, show access denied
  if (filteredBrands.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Shield className="w-12 h-12 mx-auto mb-4 text-red-600" />
          <h2 className="text-xl font-bold mb-2">Access Restricted</h2>
          <p className="text-muted-foreground">You don't have permission to access the Communications Center.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Communications Center</h1>
        <p className="text-muted-foreground mt-2">
          Enterprise multi-brand communication hub with AI-powered campaigns
        </p>
      </div>

      {/* Brand Selection Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Select Brand Channel</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedBrand.id} onValueChange={(value) => {
            const brand = brands.find(b => b.id === value);
            if (brand) setSelectedBrand(brand);
          }}>
            <TabsList className="w-full flex-wrap h-auto gap-2">
              {filteredBrands.map((brand) => (
                <TabsTrigger
                  key={brand.id}
                  value={brand.id}
                  className="flex-1 min-w-[140px]"
                  style={{
                    borderBottom: selectedBrand.id === brand.id ? `3px solid ${brand.colors.primary}` : 'none'
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: brand.colors.primary }}
                    />
                    {brand.name}
                  </div>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="w-3 h-3" />
            <span>Access to {filteredBrands.length} brand{filteredBrands.length > 1 ? 's' : ''}</span>
          </div>
        </CardContent>
      </Card>

      {/* Brand Info Card */}
      <Card style={{ borderTop: `4px solid ${selectedBrand.colors.primary}` }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-xl"
              style={{ backgroundColor: selectedBrand.colors.primary }}
            >
              {selectedBrand.name.charAt(0)}
            </div>
            <div>
              <div className="text-2xl">{selectedBrand.name} Communications</div>
              <div className="text-sm text-muted-foreground font-normal">
                {selectedBrand.description} • Voice: {selectedBrand.voicePersona}
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Module Selection */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 mb-6">
            <Button
              variant={activeModule === 'text' ? 'default' : 'outline'}
              className="flex flex-col h-20 gap-1"
              onClick={() => setActiveModule('text')}
              style={activeModule === 'text' ? {
                backgroundColor: selectedBrand.colors.primary,
                color: 'white'
              } : {}}
            >
              <Send className="w-5 h-5" />
              <span className="text-xs">Blast Text</span>
            </Button>
            
            <Button
              variant={activeModule === 'email' ? 'default' : 'outline'}
              className="flex flex-col h-20 gap-1"
              onClick={() => setActiveModule('email')}
              style={activeModule === 'email' ? {
                backgroundColor: selectedBrand.colors.primary,
                color: 'white'
              } : {}}
            >
              <Mail className="w-5 h-5" />
              <span className="text-xs">Blast Email</span>
            </Button>
            
            <Button
              variant={activeModule === 'voice' ? 'default' : 'outline'}
              className="flex flex-col h-20 gap-1"
              onClick={() => setActiveModule('voice')}
              style={activeModule === 'voice' ? {
                backgroundColor: selectedBrand.colors.primary,
                color: 'white'
              } : {}}
            >
              <Phone className="w-5 h-5" />
              <span className="text-xs">AI Voice</span>
            </Button>
            
            <Button
              variant={activeModule === 'va-call' ? 'default' : 'outline'}
              className="flex flex-col h-20 gap-1"
              onClick={() => setActiveModule('va-call')}
              style={activeModule === 'va-call' ? {
                backgroundColor: selectedBrand.colors.primary,
                color: 'white'
              } : {}}
            >
              <Phone className="w-5 h-5" />
              <span className="text-xs">VA Call</span>
            </Button>
            
            <Button
              variant={activeModule === 'crm' ? 'default' : 'outline'}
              className="flex flex-col h-20 gap-1"
              onClick={() => setActiveModule('crm')}
              style={activeModule === 'crm' ? {
                backgroundColor: selectedBrand.colors.primary,
                color: 'white'
              } : {}}
            >
              <Users className="w-5 h-5" />
              <span className="text-xs">CRM Segments</span>
            </Button>
            
            <Button
              variant={activeModule === 'batch' ? 'default' : 'outline'}
              className="flex flex-col h-20 gap-1"
              onClick={() => setActiveModule('batch')}
              style={activeModule === 'batch' ? {
                backgroundColor: selectedBrand.colors.primary,
                color: 'white'
              } : {}}
            >
              <Upload className="w-5 h-5" />
              <span className="text-xs">Batch Upload</span>
            </Button>
            
            <Button
              variant={activeModule === 'conversations' ? 'default' : 'outline'}
              className="flex flex-col h-20 gap-1"
              onClick={() => setActiveModule('conversations')}
              style={activeModule === 'conversations' ? {
                backgroundColor: selectedBrand.colors.primary,
                color: 'white'
              } : {}}
            >
              <BarChart3 className="w-5 h-5" />
              <span className="text-xs">Conversations</span>
            </Button>
          </div>

          {/* Active Module Content */}
          <div className="mt-6">
            {activeModule === 'text' && <BlastTextModule brand={selectedBrand.name} brandColor={selectedBrand.colors.primary} />}
            {activeModule === 'email' && <BlastEmailModule brand={selectedBrand.name} brandColor={selectedBrand.colors.primary} />}
            {activeModule === 'voice' && <AIVoiceCallModule brand={selectedBrand.name} brandColor={selectedBrand.colors.primary} />}
            {activeModule === 'va-call' && <VACallPanel brand={selectedBrand.name} brandColor={selectedBrand.colors.primary} />}
            {activeModule === 'crm' && <CRMSegmentationModule brand={selectedBrand.name} brandColor={selectedBrand.colors.primary} />}
            {activeModule === 'batch' && <BatchUploadModule brand={selectedBrand.name} brandColor={selectedBrand.colors.primary} />}
            {activeModule === 'conversations' && <ConversationsView brand={selectedBrand.name} brandColor={selectedBrand.colors.primary} />}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
