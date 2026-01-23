import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Building2, Phone, Mail, MapPin, User, Shield, 
  FileCheck, Calendar, DollarSign, Tag, AlertTriangle, Edit, Globe
} from 'lucide-react';
import { format } from 'date-fns';
import { WholesalerTags, WholesalerTagsBadges } from './WholesalerTags';
import { ClickablePhone } from '@/components/communication/ClickablePhone';

interface WholesalerIdentityCardProps {
  profile: any;
  onEdit?: () => void;
}

export function WholesalerIdentityCard({ profile, onEdit }: WholesalerIdentityCardProps) {
  if (!profile) return null;

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'at-risk': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'suspended': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getRoleTypeColor = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'primary': return 'bg-blue-500/20 text-blue-400';
      case 'backup': return 'bg-purple-500/20 text-purple-400';
      case 'specialty': return 'bg-amber-500/20 text-amber-400';
      case 'regional': return 'bg-cyan-500/20 text-cyan-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk?.toLowerCase()) {
      case 'low': return 'text-green-400';
      case 'medium': return 'text-amber-400';
      case 'high': return 'text-orange-400';
      case 'critical': return 'text-red-400';
      default: return 'text-muted-foreground';
    }
  };

  // Build location string with all components
  const locationParts = [
    profile.neighborhood,
    profile.city,
    profile.state,
  ].filter(Boolean);
  const fullLocation = locationParts.join(', ') || 'No location set';

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-purple-500" />
            </div>
            <div>
              <CardTitle className="text-xl">{profile.legal_business_name || profile.name}</CardTitle>
              {profile.dba_name && (
                <p className="text-sm text-muted-foreground">DBA: {profile.dba_name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(profile.status)}>
              {profile.status || 'Active'}
            </Badge>
            <Badge className={getRoleTypeColor(profile.role_type)}>
              {profile.role_type || 'Primary'}
            </Badge>
            {onEdit && (
              <Button variant="ghost" size="icon" onClick={onEdit}>
                <Edit className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Tags Row - Displayed prominently in header */}
        {profile.id && (
          <div className="pt-3">
            <WholesalerTagsBadges wholesalerId={profile.id} maxTags={5} />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Contact Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Primary Contact */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Primary Contact</p>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{profile.contact_name || 'Not set'}</span>
            </div>
            {profile.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <ClickablePhone 
                  phone={profile.phone}
                  entityType="wholesaler"
                  entityId={profile.id}
                  entityName={profile.contact_name || profile.name}
                  className="text-sm text-primary hover:underline"
                />
              </div>
            )}
          </div>

          {/* Backup Contact */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Backup Contact</p>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{profile.backup_contact_name || 'Not set'}</span>
            </div>
            {profile.backup_contact_phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{profile.backup_contact_phone}</span>
              </div>
            )}
          </div>

          {/* Location - ENHANCED */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Location</p>
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="text-sm">
                {profile.city && <span className="font-medium">{profile.city}</span>}
                {profile.city && profile.state && <span className="text-muted-foreground">, </span>}
                {profile.state && <span>{profile.state}</span>}
                {profile.neighborhood && (
                  <p className="text-xs text-muted-foreground">{profile.neighborhood}</p>
                )}
                {!profile.city && !profile.state && !profile.neighborhood && (
                  <span className="text-muted-foreground">Not set</span>
                )}
              </div>
            </div>
            {profile.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${profile.email}`} className="text-sm text-primary hover:underline truncate">{profile.email}</a>
              </div>
            )}
          </div>

          {/* Risk & Health */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Risk Status</p>
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${getRiskColor(profile.risk_level)}`} />
              <span className={`text-sm font-medium capitalize ${getRiskColor(profile.risk_level)}`}>
                {profile.risk_level || 'Low'} Risk
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Health: {profile.relationship_health_score || 50}/100</span>
            </div>
          </div>
        </div>

        {/* Tags Section - Full Management */}
        {profile.id && (
          <div className="pt-4 border-t border-border/50">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Tags & Classifications</p>
            <WholesalerTags wholesalerId={profile.id} showSelector={true} />
          </div>
        )}

        {/* Business Terms Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 pt-4 border-t border-border/50">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Pricing Tier</p>
            <p className="font-medium capitalize">{profile.pricing_tier || 'Standard'}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Payment Terms</p>
            <p className="font-medium uppercase">{profile.payment_terms || 'NET30'}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">MOQ</p>
            <p className="font-medium">{profile.moq || 1} units</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Margin</p>
            <p className="font-medium">{profile.margin_agreement || 0}%</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Reorder Point</p>
            <p className="font-medium">{profile.reorder_threshold || '-'}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Tax ID</p>
            <p className="font-medium">{profile.tax_id || '-'}</p>
          </div>
        </div>

        {/* Compliance Documents */}
        {(profile.license_number || profile.resale_cert_number || profile.insurance_policy) && (
          <div className="pt-4 border-t border-border/50">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Compliance Documents</p>
            <div className="flex flex-wrap gap-2">
              {profile.license_number && (
                <Badge variant="outline" className="gap-1">
                  <FileCheck className="h-3 w-3" />
                  License: {profile.license_number}
                  {profile.license_expiry && (
                    <span className="text-muted-foreground ml-1">
                      (exp: {format(new Date(profile.license_expiry), 'MM/yy')})
                    </span>
                  )}
                </Badge>
              )}
              {profile.resale_cert_number && (
                <Badge variant="outline" className="gap-1">
                  <FileCheck className="h-3 w-3" />
                  Resale: {profile.resale_cert_number}
                </Badge>
              )}
              {profile.insurance_policy && (
                <Badge variant="outline" className="gap-1">
                  <Shield className="h-3 w-3" />
                  Insured
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Authorized Brands */}
        {profile.authorized_brands && profile.authorized_brands.length > 0 && (
          <div className="pt-4 border-t border-border/50">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Authorized Brands</p>
            <div className="flex flex-wrap gap-2">
              {profile.authorized_brands.map((brand: string, i: number) => (
                <Badge key={i} variant="secondary" className="bg-primary/10">
                  <Tag className="h-3 w-3 mr-1" />
                  {brand}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Assigned Rep */}
        {profile.assigned_rep && (
          <div className="pt-4 border-t border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Assigned Rep: <span className="font-medium">{profile.assigned_rep.name}</span></span>
            </div>
            {profile.last_visit_date && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Last visit: {format(new Date(profile.last_visit_date), 'MMM d, yyyy')}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
