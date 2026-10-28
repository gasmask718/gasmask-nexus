import { describe, it, expect } from 'vitest';
import { nearbyStops, nearestNext, googleDirections, milesBetween } from '../lib/routes/nearMe';
const origin = { lat: 40.67, lng: -73.94 };
const stop = (id: string, lat: number, status = 'pending') => ({ id, status, planned_order: 1, store_lat: lat, store_lng: -73.94 });
describe('phone route rules', () => {
 it('excludes completed stops and selects next closest after completion', () => {
 const stops = [stop('far',40.69), stop('near',40.671), stop('done',40.6701,'completed')];
 expect(nearbyStops(stops,origin,null).map(s=>s.id)).toEqual(['near','far']);
 stops[1].status='completed'; expect(nearbyStops(stops,origin,null)[0].id).toBe('far');
 });
 it('applies the requested half-mile radius without inventing locations', () => {
 expect(nearbyStops([stop('near',40.671),stop('far',40.69),{id:'missing',status:'pending',planned_order:2}],origin,0.5).map(s=>s.id)).toEqual(['near']);
 expect(milesBetween(origin,{lat:40.68,lng:-73.94})).toBeCloseTo(0.6909,3);
 });
 it('caps Maps at nine remaining destinations in nearest-next order', () => {
 const chain=nearestNext(Array.from({length:12},(_,i)=>stop(String(i),40.671+i*.001)),origin);
 expect(chain.map(s=>s.id)).toEqual(['0','1','2','3','4','5','6','7','8']);
 const url=new URL(googleDirections(chain,origin) || '');
 expect(url.searchParams.get('origin')).toBe('40.67,-73.94');
 expect(url.searchParams.get('waypoints')?.split('|')).toHaveLength(8);
 expect(url.searchParams.get('destination')).toBe('40.679,-73.94');
 });
});
