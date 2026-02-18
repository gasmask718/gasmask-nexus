import Layout from '@/components/Layout';
import { Outlet } from 'react-router-dom';

/**
 * AdminLayout — Thin alias around existing Layout component
 * Used for route grouping clarity. Zero behavioral change.
 */
export default function AdminLayout() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
