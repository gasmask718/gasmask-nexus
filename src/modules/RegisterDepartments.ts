import { DynastyModule, RegisteredModule, ModuleRoute, SidebarItem } from './types';

// Module Registry
class DepartmentRegistry {
  private modules: Map<string, RegisteredModule> = new Map();
  private routes: ModuleRoute[] = [];
  private sidebarItems: SidebarItem[] = [];

  register(module: DynastyModule): void {
    if (this.modules.has(module.config.id)) {
      console.warn(`Module ${module.config.id} is already registered`);
      return;
    }

    this.modules.set(module.config.id, {
      module,
      isLoaded: true,
      loadedAt: new Date(),
    });

    // Register routes with base path prefix
    module.routes.forEach(route => {
      this.routes.push({
        ...route,
        path: `${module.config.basePath}${route.path}`,
      });
    });

    // Register sidebar items
    this.sidebarItems.push(...module.sidebarItems);

    console.log(`✅ Module registered: ${module.config.name}`);
  }

  unregister(moduleId: string): void {
    const registered = this.modules.get(moduleId);
    if (!registered) return;

    // Remove routes
    this.routes = this.routes.filter(
      r => !r.path.startsWith(registered.module.config.basePath)
    );

    // Remove sidebar items
    this.sidebarItems = this.sidebarItems.filter(
      item => !item.path.startsWith(registered.module.config.basePath)
    );

    this.modules.delete(moduleId);
    console.log(`❌ Module unregistered: ${moduleId}`);
  }

  getModule(moduleId: string): DynastyModule | undefined {
    return this.modules.get(moduleId)?.module;
  }

  getAllModules(): DynastyModule[] {
    return Array.from(this.modules.values())
      .map(r => r.module)
      .sort((a, b) => a.config.order - b.config.order);
  }

  getAllRoutes(): ModuleRoute[] {
    return [...this.routes];
  }

  getSidebarItems(): SidebarItem[] {
    return [...this.sidebarItems];
  }

  getModulesByPermission(userPermissions: string[]): DynastyModule[] {
    return this.getAllModules().filter(module =>
      module.config.permissions.some(p => userPermissions.includes(p) || userPermissions.includes('admin'))
    );
  }

  getDiagnostics(): ModuleDiagnostics {
    const modules = this.getAllModules();
    return {
      totalModules: modules.length,
      enabledModules: modules.filter(m => m.config.isEnabled).length,
      totalRoutes: this.routes.length,
      totalSidebarItems: this.sidebarItems.length,
      registeredAt: new Date(),
      moduleList: modules.map(m => ({
        id: m.config.id,
        name: m.config.name,
        basePath: m.config.basePath,
        routeCount: m.routes.length,
        isEnabled: m.config.isEnabled,
      })),
    };
  }
}

export interface ModuleDiagnostics {
  totalModules: number;
  enabledModules: number;
  totalRoutes: number;
  totalSidebarItems: number;
  registeredAt: Date;
  moduleList: {
    id: string;
    name: string;
    basePath: string;
    routeCount: number;
    isEnabled: boolean;
  }[];
}

// Singleton instance
export const departmentRegistry = new DepartmentRegistry();

// Helper function to create a module
export function createModule(config: DynastyModule): DynastyModule {
  return config;
}

// Auto-registration function
export function registerAllDepartments(modules: DynastyModule[]): void {
  console.log('🚀 Starting Dynasty OS Module Registration...');
  
  modules.forEach(module => {
    if (module.config.isEnabled) {
      departmentRegistry.register(module);
    }
  });

  const diagnostics = departmentRegistry.getDiagnostics();
  console.log('📊 Registration Complete:', diagnostics);
}

export default departmentRegistry;
