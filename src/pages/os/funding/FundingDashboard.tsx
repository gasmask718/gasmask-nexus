import { Navigate } from "react-router-dom";

/**
 * DEPRECATED: This was the old orphan "Funding Company OS" page with mock data.
 * All funding operations now live at /funding-machine (Dynasty Funding Machine).
 * This redirect ensures any stale links still work.
 */
export default function FundingDashboard() {
  return <Navigate to="/funding-machine" replace />;
}
