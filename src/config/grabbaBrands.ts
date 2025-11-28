// Grabba Brands Configuration - Visual System & Constants

export const GRABBA_BRANDS = ['gasmask', 'hotmama', 'hotscolati', 'grabba_r_us'] as const;
export type GrabbaBrand = typeof GRABBA_BRANDS[number];

export const GRABBA_BRAND_CONFIG: Record<GrabbaBrand, {
  label: string;
  primary: string;
  gradient: string;
  pill: string;
  icon: string;
}> = {
  gasmask: {
    label: 'GasMask',
    primary: 'bg-red-600',
    gradient: 'from-red-600/20 to-red-900/10 border-red-500/30',
    pill: 'bg-red-500/20 text-red-300 border-red-500/40',
    icon: '🔴',
  },
  hotmama: {
    label: 'HotMama',
    primary: 'bg-rose-400',
    gradient: 'from-rose-500/20 to-rose-900/10 border-rose-500/30',
    pill: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    icon: '🩷',
  },
  hotscolati: {
    label: 'HotScolati',
    primary: 'bg-amber-500',
    gradient: 'from-amber-500/20 to-amber-900/10 border-amber-500/30',
    pill: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    icon: '🟡',
  },
  grabba_r_us: {
    label: 'Grabba R Us',
    primary: 'bg-purple-500',
    gradient: 'from-purple-500/20 to-purple-900/10 border-purple-500/30',
    pill: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    icon: '🟣',
  },
};

// Grabba 8-Floor Navigation
export const GRABBA_FLOORS = [
  {
    floor: 'F1',
    label: 'CRM & Stores',
    path: '/grabba/crm',
    description: 'All Grabba stores, wholesalers, and direct customers in one CRM – filterable by brand.',
    icon: 'Users',
  },
  {
    floor: 'F2',
    label: 'Communication Center',
    path: '/grabba/communication',
    description: 'Text, call, and email center powered by AI – focused on Grabba accounts.',
    icon: 'MessageSquare',
  },
  {
    floor: 'F3',
    label: 'Inventory Intelligence',
    path: '/grabba/inventory',
    description: 'Live tube counts, ETA, and neighborhood performance across all Grabba brands.',
    icon: 'Package',
  },
  {
    floor: 'F4',
    label: 'Production Center',
    path: '/grabba/production',
    description: 'Monitor boxes made, tools issued, machinery health, and production office performance.',
    icon: 'Factory',
  },
  {
    floor: 'F5',
    label: 'Deliveries & Drivers',
    path: '/grabba/deliveries',
    description: 'Routes, drivers, bikers, collections, and delivery performance for Grabba.',
    icon: 'Truck',
  },
  {
    floor: 'F6',
    label: 'Ambassadors & Reps',
    path: '/grabba/ambassadors',
    description: 'Partner reps who find and maintain stores and wholesalers – with tracked commissions.',
    icon: 'Award',
  },
  {
    floor: 'F7',
    label: 'National Wholesale Platform',
    path: '/grabba/wholesale-platform',
    description: 'Wholesalers upload products, sell through our network, and get sourced with top items.',
    icon: 'Globe',
  },
  {
    floor: 'F8',
    label: 'Accounting & Finance',
    path: '/grabba/finance',
    description: 'Profit, costs, commissions, unpaid, and risk scores for all Grabba product companies.',
    icon: 'DollarSign',
  },
];

export function getBrandConfig(brand: string) {
  return GRABBA_BRAND_CONFIG[brand as GrabbaBrand] || GRABBA_BRAND_CONFIG.gasmask;
}

export function formatTubesAsBoxes(tubes: number) {
  const TUBES_PER_BOX = 100;
  const fullBoxes = Math.floor(tubes / TUBES_PER_BOX);
  const remainder = tubes % TUBES_PER_BOX;
  
  let fractionLabel = '';
  if (remainder === 0) {
    fractionLabel = fullBoxes > 0 ? `${fullBoxes} box${fullBoxes > 1 ? 'es' : ''}` : '0 boxes';
  } else if (remainder <= 25) {
    fractionLabel = fullBoxes > 0 ? `${fullBoxes} + ¼ box` : '¼ box';
  } else if (remainder <= 50) {
    fractionLabel = fullBoxes > 0 ? `${fullBoxes} + ½ box` : '½ box';
  } else if (remainder <= 75) {
    fractionLabel = fullBoxes > 0 ? `${fullBoxes} + ¾ box` : '¾ box';
  } else {
    fractionLabel = `${fullBoxes + 1} box${fullBoxes + 1 > 1 ? 'es' : ''} (almost)`;
  }
  
  return { fullBoxes, remainder, fractionLabel };
}
