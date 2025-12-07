import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguagePersonality } from '@/hooks/useLanguagePersonality';
import LanguageProfilesPanel from './LanguageProfilesPanel';
import PersonalityProfilesPanel from './PersonalityProfilesPanel';
import RegionStylesPanel from './RegionStylesPanel';
import LanguageStatsPanel from './LanguageStatsPanel';
import ToneCorrectionsPanel from './ToneCorrectionsPanel';

interface LanguagePersonalityTabProps {
  businessId?: string;
}

export default function LanguagePersonalityTab({ businessId }: LanguagePersonalityTabProps) {
  const {
    languageProfiles,
    personalityProfiles,
    regionStyles,
    languageStats,
    toneCorrections,
    isLoading,
    createPersonality,
    createRegionStyle,
  } = useLanguagePersonality(businessId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Language & Personality Engine</h2>
        <p className="text-muted-foreground">
          Configure multi-lingual, multi-dialect, and personality-adaptive communication.
        </p>
      </div>

      <Tabs defaultValue="languages" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="languages">Languages</TabsTrigger>
          <TabsTrigger value="personalities">Personalities</TabsTrigger>
          <TabsTrigger value="regions">Regions</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
          <TabsTrigger value="corrections">Corrections</TabsTrigger>
        </TabsList>

        <TabsContent value="languages">
          <LanguageProfilesPanel
            profiles={languageProfiles || []}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="personalities">
          <PersonalityProfilesPanel
            profiles={personalityProfiles || []}
            languageProfiles={languageProfiles || []}
            isLoading={isLoading}
            onCreateProfile={createPersonality}
            businessId={businessId}
          />
        </TabsContent>

        <TabsContent value="regions">
          <RegionStylesPanel
            styles={regionStyles || []}
            personalities={personalityProfiles || []}
            isLoading={isLoading}
            onCreateStyle={createRegionStyle}
          />
        </TabsContent>

        <TabsContent value="stats">
          <LanguageStatsPanel stats={languageStats} />
        </TabsContent>

        <TabsContent value="corrections">
          <ToneCorrectionsPanel
            corrections={toneCorrections || []}
            isLoading={isLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
