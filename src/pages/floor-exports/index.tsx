import FloorExportPage from './FloorExportPage';
import { FLOOR_EXPORT_CONFIGS } from '@/config/floorExportConfig';

function makeFloorPage(floorId: string) {
  const config = FLOOR_EXPORT_CONFIGS.find(c => c.floorId === floorId);
  if (!config) return () => <div>Floor config not found: {floorId}</div>;
  return () => <FloorExportPage config={config} />;
}

export const CommandExport = makeFloorPage('grabba-command');
export const Floor1Export = makeFloorPage('floor-1-crm');
export const Floor2Export = makeFloorPage('floor-2-communication');
export const Floor3Export = makeFloorPage('floor-3-inventory');
export const Floor4Export = makeFloorPage('floor-4-delivery');
export const Floor5Export = makeFloorPage('floor-5-orders');
export const Floor6Export = makeFloorPage('floor-6-production');
export const Floor7Export = makeFloorPage('floor-7-wholesale');
export const Floor8Export = makeFloorPage('floor-8-ambassadors');
export const Floor9Export = makeFloorPage('floor-9-ai');
