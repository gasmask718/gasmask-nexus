import { Outlet } from 'react-router-dom';

export default function SBOHubLayout() {
  return (
    <div className="min-h-full">
      <Outlet />
    </div>
  );
}
