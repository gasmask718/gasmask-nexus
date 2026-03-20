import { useState, useEffect } from 'react';

/**
 * Returns true when the browser tab is visible, false when hidden.
 * Use to pause polling/intervals when the user isn't looking.
 */
export function useDocumentVisibility() {
  const [visible, setVisible] = useState(!document.hidden);

  useEffect(() => {
    const handler = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  return visible;
}
