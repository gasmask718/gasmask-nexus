import { useEffect } from 'react';
import Layout from '@/components/Layout';
import { Outlet } from 'react-router-dom';

/**
 * AdminLayout — Thin alias around existing Layout component
 * Used for route grouping clarity. Zero behavioral change.
 * Phase 6: injects noindex to prevent admin surface SEO leakage.
 */
export default function AdminLayout() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
