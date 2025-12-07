import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, AlertTriangle, TrendingUp, User, Package, Clock } from "lucide-react";

interface PersonalProfile {
  personal_rapport_notes?: string | null;
  family_background?: string | null;
  country_of_origin?: string | null;
  communication_style?: string | null;
  key_relationships?: string[] | null;
}

interface OperationalProfile {
  typical_order_pattern?: string | null;
  preferred_brands?: string[] | null;
  delivery_window?: string | null;
  payment_habits?: string | null;
  special_requests?: string[] | null;
}

interface RedFlags {
  notes?: string[] | null;
  risk_level?: string | null;
}

interface Opportunities {
  notes?: string[] | null;
  upsell_potential?: string | null;
}

interface ExtractedProfile {
  personal_profile?: PersonalProfile | null;
  operational_profile?: OperationalProfile | null;
  red_flags?: RedFlags | null;
  opportunities?: Opportunities | null;
  extraction_confidence?: number | null;
  last_extracted_at?: string | null;
}

interface PersonalIntelligencePanelProps {
  profile: ExtractedProfile | null | undefined;
}

export function PersonalIntelligencePanel({ profile }: PersonalIntelligencePanelProps) {
  const hasData = profile && (
    profile.personal_profile?.personal_rapport_notes ||
    profile.operational_profile?.typical_order_pattern ||
    profile.red_flags?.notes?.length ||
    profile.opportunities?.notes?.length
  );

  return (
    <Card className="border-2 border-yellow-500/40 bg-yellow-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-yellow-600" />
          <CardTitle className="text-lg text-yellow-600">
            Personal Intelligence Summary
          </CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          AI-extracted customer traits, habits, opportunities, and relationship insights.
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        {!hasData ? (
          <div className="rounded-lg border border-dashed border-yellow-500/30 p-4 text-sm text-muted-foreground bg-yellow-500/5">
            <p className="font-medium text-yellow-700 mb-2">AI has not extracted insights yet.</p>
            <p>Once the extraction runs on this store's notes and interactions, you'll see:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Relationship snapshot & rapport notes</li>
              <li>Operational patterns & preferences</li>
              <li>Risk flags & red alerts</li>
              <li>Growth opportunities & upsell triggers</li>
            </ul>
          </div>
        ) : (
          <>
            {/* RELATIONSHIP SNAPSHOT */}
            {profile?.personal_profile && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-yellow-600" />
                  <h3 className="font-semibold text-base">Relationship Snapshot</h3>
                </div>
                <div className="pl-6 space-y-2 text-sm">
                  {profile.personal_profile.personal_rapport_notes && (
                    <p className="text-muted-foreground">{profile.personal_profile.personal_rapport_notes}</p>
                  )}
                  {profile.personal_profile.country_of_origin && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        Origin: {profile.personal_profile.country_of_origin}
                      </Badge>
                    </div>
                  )}
                  {profile.personal_profile.communication_style && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Style:</span> {profile.personal_profile.communication_style}
                    </p>
                  )}
                  {profile.personal_profile.key_relationships && profile.personal_profile.key_relationships.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {profile.personal_profile.key_relationships.map((rel, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{rel}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* OPERATIONAL PATTERNS */}
            {profile?.operational_profile && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-600" />
                  <h3 className="font-semibold text-base">Operational Patterns</h3>
                </div>
                <ul className="pl-6 text-sm list-disc space-y-1 text-muted-foreground">
                  {profile.operational_profile.typical_order_pattern && (
                    <li>{profile.operational_profile.typical_order_pattern}</li>
                  )}
                  {profile.operational_profile.preferred_brands && profile.operational_profile.preferred_brands.length > 0 && (
                    <li>Prefers: {profile.operational_profile.preferred_brands.join(", ")}</li>
                  )}
                  {profile.operational_profile.delivery_window && (
                    <li>
                      <Clock className="h-3 w-3 inline mr-1" />
                      Best delivery: {profile.operational_profile.delivery_window}
                    </li>
                  )}
                  {profile.operational_profile.payment_habits && (
                    <li>Payment: {profile.operational_profile.payment_habits}</li>
                  )}
                </ul>
              </div>
            )}

            {/* RED FLAGS */}
            {profile?.red_flags?.notes && profile.red_flags.notes.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <h3 className="font-semibold text-base text-red-600">Risk Flags</h3>
                </div>
                <ul className="pl-6 text-sm list-disc space-y-1 text-red-500">
                  {profile.red_flags.notes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* OPPORTUNITIES */}
            {profile?.opportunities?.notes && profile.opportunities.notes.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <h3 className="font-semibold text-base text-green-600">Growth Opportunities</h3>
                </div>
                <ul className="pl-6 text-sm list-disc space-y-1 text-green-600">
                  {profile.opportunities.notes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* EXTRACTION META */}
            {profile?.last_extracted_at && (
              <div className="pt-2 border-t text-xs text-muted-foreground flex items-center justify-between">
                <span>Last extracted: {new Date(profile.last_extracted_at).toLocaleDateString()}</span>
                {profile.extraction_confidence && (
                  <Badge variant="outline" className="text-xs">
                    {Math.round(profile.extraction_confidence * 100)}% confidence
                  </Badge>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
