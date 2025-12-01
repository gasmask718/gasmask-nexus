import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  User, Phone, Clock, Star, Store, DollarSign, Package, 
  Truck, AlertTriangle, Lightbulb, TrendingUp, Target
} from 'lucide-react';
import type { ExtractedProfile } from '@/services/profileExtractionService';

interface StoreProfileSectionsProps {
  profile: ExtractedProfile;
  recentOrders?: any[];
  totalSpent?: number;
}

export function StoreProfileSections({ profile, recentOrders = [], totalSpent = 0 }: StoreProfileSectionsProps) {
  const lastThreeOrders = recentOrders.slice(0, 3);
  
  return (
    <div className="space-y-6">
      {/* SECTION A: Personal Snapshot */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-blue-500" />
            Personal Snapshot
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Owner Info */}
          {profile.personal_profile.owner_name && (
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <span className="text-lg font-semibold text-blue-600">
                  {profile.personal_profile.owner_name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-medium">{profile.personal_profile.owner_name}</p>
                {profile.personal_profile.communication_style && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {profile.personal_profile.communication_style}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Vibe Summary */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" />
              Quick Summary
            </p>
            <ul className="space-y-1 text-sm">
              {profile.personal_profile.restock_habits_summary && (
                <li className="flex items-start gap-2">
                  <Clock className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <span>{profile.personal_profile.restock_habits_summary}</span>
                </li>
              )}
              {profile.operational_profile.preferred_brands && profile.operational_profile.preferred_brands.length > 0 && (
                <li className="flex items-start gap-2">
                  <Package className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <span>Prefers: {profile.operational_profile.preferred_brands.join(', ')}</span>
                </li>
              )}
              {profile.operational_profile.delivery_preference && (
                <li className="flex items-start gap-2">
                  <Truck className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <span>{profile.operational_profile.delivery_preference}</span>
                </li>
              )}
            </ul>
          </div>

          {/* Last 3 Purchases */}
          {lastThreeOrders.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Recent Purchases</p>
              <div className="space-y-1.5">
                {lastThreeOrders.map((order: any) => (
                  <div key={order.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded bg-card border">
                    <span className="text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString()}
                    </span>
                    <span className="font-medium">${Number(order.order_total || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION B: Business Operations File */}
      <Card className="border-l-4 border-l-green-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-green-500" />
            Business Operations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Store Type */}
            {profile.operational_profile.store_type && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Store Type</p>
                <Badge variant="outline">{profile.operational_profile.store_type}</Badge>
              </div>
            )}

            {/* Average Spend */}
            {totalSpent > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Lifetime Spend</p>
                <p className="text-lg font-semibold flex items-center gap-1">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  {totalSpent.toFixed(2)}
                </p>
              </div>
            )}

            {/* Order Pattern */}
            {profile.operational_profile.typical_order_pattern && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground mb-1">Typical Order Pattern</p>
                <p className="text-sm">{profile.operational_profile.typical_order_pattern}</p>
              </div>
            )}

            {/* Payment Preferences */}
            {profile.operational_profile.payment_preferences && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Payment</p>
                <Badge variant="secondary" className="gap-1">
                  <DollarSign className="h-3 w-3" />
                  {profile.operational_profile.payment_preferences}
                </Badge>
              </div>
            )}

            {/* Delivery Window */}
            {profile.operational_profile.delivery_window && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Delivery Window</p>
                <Badge variant="secondary" className="gap-1">
                  <Clock className="h-3 w-3" />
                  {profile.operational_profile.delivery_window}
                </Badge>
              </div>
            )}
          </div>

          {/* Preferred Brands */}
          {profile.operational_profile.preferred_brands && profile.operational_profile.preferred_brands.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Preferred Brands</p>
              <div className="flex flex-wrap gap-1.5">
                {profile.operational_profile.preferred_brands.map(brand => (
                  <Badge key={brand} className="bg-primary/10 text-primary border-primary/20">
                    {brand}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Red Flags */}
          {profile.red_flags.notes.length > 0 && (
            <div className="border-t pt-4">
              <p className="text-xs font-medium text-red-600 mb-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Red Flags
              </p>
              <ul className="space-y-1">
                {profile.red_flags.notes.map((flag, i) => (
                  <li key={i} className="text-sm text-red-600 flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    {flag}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION C: Opportunities */}
      <Card className="border-l-4 border-l-amber-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Growth Opportunities
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Ambassador Potential */}
          {profile.operational_profile.ambassador_potential && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <p className="font-medium text-amber-700 flex items-center gap-2 mb-1">
                <Target className="h-4 w-4" />
                Ambassador Potential
              </p>
              {profile.operational_profile.ambassador_potential_note && (
                <p className="text-sm text-muted-foreground">
                  {profile.operational_profile.ambassador_potential_note}
                </p>
              )}
            </div>
          )}

          {/* Special Flags */}
          <div className="flex flex-wrap gap-2">
            {profile.operational_profile.can_host_posters && (
              <Badge className="bg-blue-500/10 text-blue-700 border-blue-500/20">
                Can Host Marketing Materials
              </Badge>
            )}
            {profile.operational_profile.wants_affiliate_system && (
              <Badge className="bg-purple-500/10 text-purple-700 border-purple-500/20">
                Interested in Affiliate System
              </Badge>
            )}
          </div>

          {/* Opportunity Notes */}
          {profile.opportunities.notes.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                Next Moves
              </p>
              <ul className="space-y-2">
                {profile.opportunities.notes.map((opp, i) => (
                  <li key={i} className="text-sm flex items-start gap-2 bg-muted/50 p-2 rounded">
                    <Lightbulb className="h-3 w-3 mt-0.5 text-amber-500 flex-shrink-0" />
                    <span>{opp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* AI Next Move Suggestion */}
          {profile.operational_profile.preferred_brands && profile.operational_profile.preferred_brands.length > 0 && (
            <div className="bg-gradient-to-r from-purple-500/5 to-blue-500/5 border border-purple-500/10 rounded-lg p-3">
              <p className="text-xs font-medium text-purple-700 mb-1">💡 Suggested Next Move</p>
              <p className="text-sm text-muted-foreground">
                Schedule a follow-up visit with {profile.operational_profile.preferred_brands[0]} samples. 
                {profile.operational_profile.delivery_window && ` Best time: ${profile.operational_profile.delivery_window}.`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
