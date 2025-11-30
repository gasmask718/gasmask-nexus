import { Routes, Route } from 'react-router-dom';
import { useModules } from '@/hooks/useModules';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';

/**
 * ModuleRouter - Dynamically generates routes from registered modules
 * This component renders all routes from the module registry
 */
export function ModuleRouter() {
  const { routes } = useModules();

  return (
    <Routes>
      {routes.map((route) => (
        <Route
          key={route.path}
          path={route.path}
          element={
            route.requiresAuth ? (
              <ProtectedRoute>
                <Layout>
                  <route.component />
                </Layout>
              </ProtectedRoute>
            ) : (
              <Layout>
                <route.component />
              </Layout>
            )
          }
        />
      ))}
    </Routes>
  );
}

export default ModuleRouter;
