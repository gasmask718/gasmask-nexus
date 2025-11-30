// src/services/navigationSnapshotService.ts
import { departmentRegistry } from '@/modules/RegisterDepartments';

export interface NavigationSnapshot {
  routes: Array<{
    path: string;
    requiresAuth: boolean;
  }>;
  sidebarItems: Array<{
    label: string;
    path: string;
    icon?: string;
  }>;
  timestamp: string;
}

/**
 * Captures the current navigation state from the department registry
 */
export function getNavigationSnapshot(): NavigationSnapshot {
  const routes = departmentRegistry.getAllRoutes();
  const sidebarItems = departmentRegistry.getSidebarItems();

  return {
    routes: routes.map(r => ({
      path: r.path,
      requiresAuth: r.requiresAuth ?? false,
    })),
    sidebarItems: sidebarItems.map(s => ({
      label: s.label,
      path: s.path,
      icon: typeof s.icon === 'function' ? s.icon.displayName || 'icon' : undefined,
    })),
    timestamp: new Date().toISOString(),
  };
}
