import { Navigate } from 'react-router-dom';

/**
 * DEPRECATED: Legacy Marketplace Admin portal.
 * All traffic redirects to the enhanced Command Center at /admin/marketplace-control.
 * If you see this component render, something is wrong with routing.
 */
export default function MarketplaceAdmin() {
  console.error('LEGACY MARKETPLACE UI DETECTED — INVALID ROUTE BINDING. Redirecting to Command Center.');
  return <Navigate to="/admin/marketplace-control" replace />;
}
