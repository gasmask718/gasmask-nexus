// Dynasty OS - Modular Department System
// Master index that exports and registers all modules

import { DynastyModule } from './types';
import { registerAllDepartments, departmentRegistry } from './RegisterDepartments';

// Import all modules
import { TopTierModule } from './toptier';
import { UnforgettableModule } from './unforgettable';
import { ICleanModule } from './iclean';
import { PlayboxxxModule } from './playboxxx';
import { SpecialNeedsModule } from './specialneeds';
import { FundingModule } from './funding';
import { GrantsModule } from './grants';
import { WealthModule } from './wealth';
import { BettingModule } from './betting';
import { BikerModule } from './biker';

// All Dynasty OS Modules
export const DYNASTY_MODULES: DynastyModule[] = [
  // Dynasty Business Units
  TopTierModule,
  UnforgettableModule,
  ICleanModule,
  PlayboxxxModule,
  SpecialNeedsModule,
  
  // Finance & Acquisition
  FundingModule,
  GrantsModule,
  WealthModule,
  
  // AI & Operations
  BettingModule,
  
  // Logistics
  BikerModule,
];

// Initialize all modules on import
registerAllDepartments(DYNASTY_MODULES);

// Export registry and types
export { departmentRegistry } from './RegisterDepartments';
export * from './types';

// Export individual modules for direct access
export {
  TopTierModule,
  UnforgettableModule,
  ICleanModule,
  PlayboxxxModule,
  SpecialNeedsModule,
  FundingModule,
  GrantsModule,
  WealthModule,
  BettingModule,
  BikerModule,
};

// Generate routes for React Router
export function generateModuleRoutes() {
  return departmentRegistry.getAllRoutes();
}

// Generate sidebar items for Layout
export function generateSidebarItems() {
  return departmentRegistry.getSidebarItems();
}

// Get modules by user permission
export function getAccessibleModules(userPermissions: string[]) {
  return departmentRegistry.getModulesByPermission(userPermissions);
}

// Get diagnostics
export function getModuleDiagnostics() {
  return departmentRegistry.getDiagnostics();
}

export default DYNASTY_MODULES;
