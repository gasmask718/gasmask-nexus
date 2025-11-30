import { useMemo } from 'react';
import { useUserRole } from './useUserRole';
import { 
  departmentRegistry, 
  getAccessibleModules, 
  generateModuleRoutes, 
  generateSidebarItems,
  getModuleDiagnostics,
  DynastyModule,
  ModuleRoute,
  SidebarItem
} from '@/modules';

export interface UseModulesReturn {
  // All registered modules
  allModules: DynastyModule[];
  
  // Modules accessible to current user based on permissions
  accessibleModules: DynastyModule[];
  
  // All routes from registered modules
  routes: ModuleRoute[];
  
  // Sidebar items for navigation
  sidebarItems: SidebarItem[];
  
  // Get a specific module by ID
  getModule: (id: string) => DynastyModule | undefined;
  
  // Check if user has access to a module
  hasAccess: (moduleId: string) => boolean;
  
  // Diagnostics
  diagnostics: ReturnType<typeof getModuleDiagnostics>;
}

export function useModules(): UseModulesReturn {
  const { role, isAdmin } = useUserRole();

  const userPermissions = useMemo(() => {
    const permissions = [role || 'user'];
    if (isAdmin) permissions.push('admin');
    return permissions;
  }, [role, isAdmin]);

  const allModules = useMemo(() => {
    return departmentRegistry.getAllModules();
  }, []);

  const accessibleModules = useMemo(() => {
    return getAccessibleModules(userPermissions);
  }, [userPermissions]);

  const routes = useMemo(() => {
    return generateModuleRoutes();
  }, []);

  const sidebarItems = useMemo(() => {
    return generateSidebarItems();
  }, []);

  const getModule = (id: string) => {
    return departmentRegistry.getModule(id);
  };

  const hasAccess = (moduleId: string) => {
    const module = getModule(moduleId);
    if (!module) return false;
    return module.config.permissions.some(p => userPermissions.includes(p));
  };

  const diagnostics = useMemo(() => {
    return getModuleDiagnostics();
  }, []);

  return {
    allModules,
    accessibleModules,
    routes,
    sidebarItems,
    getModule,
    hasAccess,
    diagnostics,
  };
}

export default useModules;
