import {
  Package, Calendar, Video, DollarSign, ShoppingCart, Settings
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// DYNASTY BRAND IDENTITY CONFIG
// Brand names, colors, and styles — consumed by BrandPlaceholder and brand
// theming. The per-brand `routes` arrays were removed (2026-08-22 ghost-page
// cleanup): they were rendered nowhere and duplicated AppRoutes.tsx, which is
// the single source of truth for routing.
// ═══════════════════════════════════════════════════════════════════════════════

export interface Brand {
  id: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent?: string;
    rgb?: string;
  };
  style: string;
}

export interface Floor {
  id: string;
  name: string;
  icon: LucideIcon;
  description: string;
  brands: Brand[];
}

export const dynastyFloors: Floor[] = [
  {
    id: 'product-companies',
    name: 'Product Companies',
    icon: Package,
    description: 'Physical product brands',
    brands: [
      {
        id: 'gasmask',
        name: 'GasMask',
        colors: {
          primary: '#D30000',
          secondary: '#000000',
          rgb: '211, 0, 0'
        },
        style: 'Dark industrial, premium street-luxury'
      },
      {
        id: 'hotmama',
        name: 'HotMama',
        colors: {
          primary: '#B76E79',
          secondary: '#000000',
          accent: '#E0BFB8',
          rgb: '183, 110, 121'
        },
        style: 'Feminine luxury metallic'
      },
      {
        id: 'grabba',
        name: 'Grabba R Us',
        colors: {
          primary: '#FFD400',
          secondary: '#245BFF',
          accent: '#7CF4A6',
          rgb: '255, 212, 0'
        },
        style: 'Colorful NYC nostalgic bodega aesthetic'
      },
      {
        id: 'scalati',
        name: 'Hotscolatti',
        colors: {
          primary: '#5A3A2E',
          secondary: '#FF7A00',
          rgb: '90, 58, 46'
        },
        style: 'Chocolate brown & fire orange'
      }
    ]
  },
  {
    id: 'service-experience',
    name: 'Service & Experience',
    icon: Calendar,
    description: 'Service-based businesses',
    brands: [
      {
        id: 'toptier',
        name: 'TopTier Experience',
        colors: {
          primary: '#000000',
          secondary: '#C0C0C0',
          rgb: '0, 0, 0'
        },
        style: 'Black & Silver luxury'
      },
      {
        id: 'unforgettable',
        name: 'Unforgettable Times USA',
        colors: {
          primary: '#A020F0',
          secondary: '#FF2AA3',
          accent: '#FFD700',
          rgb: '160, 32, 240'
        },
        style: 'Party palette (Purple, Hot Pink, Gold, Electric Blue)'
      },
      {
        id: 'iclean',
        name: 'iClean WeClean',
        colors: {
          primary: '#0094FF',
          secondary: '#00C853',
          rgb: '0, 148, 255'
        },
        style: 'Blue & Green clean aesthetic'
      }
    ]
  },
  {
    id: 'platforms-digital',
    name: 'Platforms & Digital Apps',
    icon: Video,
    description: 'Digital platforms and apps',
    brands: [
      {
        id: 'playboxxx',
        name: 'Playboxxx',
        colors: {
          primary: '#FF00C8',
          secondary: '#00E4FF',
          rgb: '255, 0, 200'
        },
        style: 'Neon Pink & Neon Blue'
      },
      {
        id: 'specialneeds',
        name: 'Special Needs App',
        colors: {
          primary: '#A8D8FF',
          secondary: '#D1A7FF',
          accent: '#A7FFD1',
          rgb: '168, 216, 255'
        },
        style: 'Soft Calming Palette (Baby Blue, Lilac, Mint)'
      }
    ]
  },
  {
    id: 'finance-acquisition',
    name: 'Finance & Acquisition',
    icon: DollarSign,
    description: 'Financial operations center',
    brands: [
      {
        id: 'finance',
        name: 'Financial Operations',
        colors: {
          primary: '#FFD700',
          secondary: '#000000',
          rgb: '255, 215, 0'
        },
        style: 'Gold & Black elite'
      }
    ]
  },
  {
    id: 'ecommerce-marketplaces',
    name: 'E-Commerce & Marketplaces',
    icon: ShoppingCart,
    description: 'Online marketplaces and stores',
    brands: [
      {
        id: 'ecommerce',
        name: 'E-Commerce Hub',
        colors: {
          primary: '#0094FF',
          secondary: '#000000',
          rgb: '0, 148, 255'
        },
        style: 'Modern blue-black tech palette'
      }
    ]
  },
  {
    id: 'systems-engine',
    name: 'Systems & Engine Room',
    icon: Settings,
    description: 'Core systems and automation',
    brands: [
      {
        id: 'systems',
        name: 'System Operations',
        colors: {
          primary: '#1F2937',
          secondary: '#374151',
          rgb: '31, 41, 55'
        },
        style: 'Dark ultra-technical theme'
      }
    ]
  }
];

export function getBrandById(brandId: string): Brand | undefined {
  for (const floor of dynastyFloors) {
    const brand = floor.brands.find(b => b.id === brandId);
    if (brand) return brand;
  }
  return undefined;
}

export function getFloorById(floorId: string): Floor | undefined {
  return dynastyFloors.find(f => f.id === floorId);
}

export function getAllBrands(): Brand[] {
  return dynastyFloors.flatMap(floor => floor.brands);
}
