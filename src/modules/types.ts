import { LucideIcon } from 'lucide-react';
import { ComponentType } from 'react';

export interface ModuleRoute {
  path: string;
  component: ComponentType;
  label: string;
  icon?: LucideIcon;
  requiresAuth?: boolean;
  allowedRoles?: string[];
}

export interface ModuleConfig {
  id: string;
  name: string;
  description: string;
  basePath: string;
  icon: LucideIcon;
  color?: string;
  permissions: string[];
  isEnabled: boolean;
  order: number;
}

export interface DynastyModule {
  config: ModuleConfig;
  routes: ModuleRoute[];
  Dashboard: ComponentType;
  sidebarItems: SidebarItem[];
}

export interface SidebarItem {
  path: string;
  label: string;
  icon: LucideIcon;
  children?: SidebarItem[];
}

export interface RegisteredModule {
  module: DynastyModule;
  isLoaded: boolean;
  loadedAt: Date;
}
