// src/services/navigationSnapshotService.ts
import { departmentRegistry } from '@/modules/RegisterDepartments';

export interface NavigationSnapshot {
  generatedAt: string;
  routes: {
    path: string;
    method?: string;
  }[];
  sidebar: {
    label: string;
    path: string;
    moduleId?: string;
  }[];
}

export function getNavigationSnapshot(): NavigationSnapshot {
  const routes = departmentRegistry.getAllRoutes();
  const sidebarItems = departmentRegistry.getSidebarItems();

  return {
    generatedAt: new Date().toISOString(),
    routes: routes.map(r => ({
      path: r.path,
      method: 'GET',
    })),
    sidebar: sidebarItems.map(item => ({
      label: item.label,
      path: item.path,
      moduleId: (item as any).moduleId,
    })),
  };
}
