/**
 * CRMRouter - Smart router that directs to legacy or new CRM based on business type
 * 
 * Grabba businesses (gasmask, hot_mama, grabba_r_us, hot_scolatti) → Legacy GrabbaCRM
 * TopTier Experience → TopTier Partner Dashboard
 * All other businesses → New Blueprint-based CRM
 */
import { useParams } from 'react-router-dom';
import GrabbaCRM from '@/pages/grabba/GrabbaCRM';
import BusinessCRMDashboard from './BusinessCRMDashboard';
import { GrabbaLayout } from '@/components/grabba/GrabbaLayout';
import { useMemo } from 'react';
import { TopTierPartnerDashboard } from '@/pages/crm/toptier';

// Grabba business slugs - these use the legacy CRM
const GRABBA_BUSINESS_SLUGS = [
  'gasmask',
  'gas_mask',
  'gas-mask',
  'hot_mama',
  'hot-mama',
  'hotmama',
  'grabba_r_us',
  'grabba-r-us',
  'grabbarrus',
  'hot_scolatti',
  'hot-scolatti',
  'hotscolatti',
];

// TopTier business slugs - these use the TopTier Partner CRM
const TOPTIER_BUSINESS_SLUGS = [
  'toptier_experience',
  'toptier-experience',
  'toptier',
  'top_tier',
  'top-tier',
];

export function isGrabbaBusiness(slug: string | undefined): boolean {
  if (!slug) return false;
  const normalized = slug.toLowerCase().trim();
  return GRABBA_BUSINESS_SLUGS.includes(normalized);
}

export function isTopTierBusiness(slug: string | undefined): boolean {
  if (!slug) return false;
  const normalized = slug.toLowerCase().trim();
  return TOPTIER_BUSINESS_SLUGS.includes(normalized);
}

export default function CRMRouter() {
  const { businessSlug } = useParams<{ businessSlug: string }>();
  
  const isGrabba = useMemo(() => isGrabbaBusiness(businessSlug), [businessSlug]);
  const isTopTier = useMemo(() => isTopTierBusiness(businessSlug), [businessSlug]);
  
  // Grabba businesses use the legacy GrabbaCRM wrapped in GrabbaLayout
  if (isGrabba) {
    return (
      <GrabbaLayout>
        <GrabbaCRM />
      </GrabbaLayout>
    );
  }
  
  // TopTier uses the Partner KPI Dashboard
  if (isTopTier) {
    return <TopTierPartnerDashboard />;
  }
  
  // All other businesses use the new Blueprint-based CRM
  return <BusinessCRMDashboard />;
}
