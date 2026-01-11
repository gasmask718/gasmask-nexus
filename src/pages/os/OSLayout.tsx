import { Outlet } from 'react-router-dom';

export default function OSLayout() {
  return (
    <div className="min-h-full">
      <Outlet />
    </div>
  );
}
