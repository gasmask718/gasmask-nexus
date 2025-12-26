/**
 * CRMRouter - Smart router that directs to legacy or new CRM based on business type
 * 
 * Grabba businesses (gasmask, hot_mama, grabba_r_us, hot_scolatti) → Legacy GrabbaCRM
 * All other businesses → New Blueprint-based CRM
 */
import { useParams } from 'react-router-dom';
import GrabbaCRM from '@/pages/grabba/GrabbaCRM';
import BusinessCRMDashboard from './BusinessCRMDashboard';
import { GrabbaLayout } from '@/components/grabba/GrabbaLayout';
import { useMemo } from 'react';

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

export function isGrabbaBusiness(slug: string | undefined): boolean {
  if (!slug) return false;
  const normalized = slug.toLowerCase().trim();
  return GRABBA_BUSINESS_SLUGS.includes(normalized);
}

export default function CRMRouter() {
  const { businessSlug } = useParams<{ businessSlug: string }>();
  
  const isGrabba = useMemo(() => isGrabbaBusiness(businessSlug), [businessSlug]);
  
  // Grabba businesses use the legacy GrabbaCRM wrapped in GrabbaLayout
  // GrabbaLayout already includes GrabbaBrandProvider
  if (isGrabba) {
    return (
      <GrabbaLayout>
        <GrabbaCRM />
      </GrabbaLayout>
    );
  }
  
  // All other businesses use the new Blueprint-based CRM
  return <BusinessCRMDashboard />;
}
