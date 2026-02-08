/**
 * CanonicalStoreDataProvider — Wraps any store profile page with the canonical
 * store data engine. Child components access store data via useCanonicalStoreData().
 *
 * Usage:
 *   <CanonicalStoreDataProvider storeId={id}>
 *     <StoreSections />
 *   </CanonicalStoreDataProvider>
 */

import { ReactNode } from 'react';
import {
  CanonicalStoreDataContext,
  useCanonicalStoreEngine,
} from '@/hooks/useCanonicalStoreData';

interface Props {
  storeId: string | undefined;
  children: ReactNode;
}

export function CanonicalStoreDataProvider({ storeId, children }: Props) {
  const engine = useCanonicalStoreEngine(storeId);

  return (
    <CanonicalStoreDataContext.Provider value={engine}>
      {children}
    </CanonicalStoreDataContext.Provider>
  );
}
