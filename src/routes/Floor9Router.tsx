/**
 * Floor9Router - Anti-404 shield for Floor 9 AI Operations
 * 
 * This router ensures no Floor 9 subpage can ever 404.
 * Bad links self-heal by redirecting to the hub.
 * 
 * Part of Phase 9.1 — AI Trust Hardening & Safety
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';

// Floor 9 Page imports
import { 
  Floor9Hub, 
  Floor9Playbooks, 
  Floor9ActionQueue, 
  Floor9InstinctLog, 
  Floor9Results,
  Floor9Predictions
} from '@/pages/floor9';

/**
 * Floor9Router - Centralized routing for Floor 9 AI Operations
 * 
 * Guarantees:
 * - No Floor 9 subpage can ever 404
 * - Bad links self-heal to /grabba/floor9
 * - Sidebar mistakes don't crash the system
 */
export function Floor9Router() {
  useEffect(() => {
    console.info('[Floor 9] AI Operations Router mounted successfully');
  }, []);

  return (
    <Routes>
      {/* Index route - AI Operations Hub */}
      <Route index element={<Floor9Hub />} />
      
      {/* Subpage routes */}
      <Route path="playbooks" element={<Floor9Playbooks />} />
      <Route path="action-queue" element={<Floor9ActionQueue />} />
      <Route path="instinct-log" element={<Floor9InstinctLog />} />
      <Route path="results" element={<Floor9Results />} />
      <Route path="predictions" element={<Floor9Predictions />} />
      
      {/* HARD FAILSAFE - Any unknown route redirects to hub */}
      <Route path="*" element={<Navigate to="/grabba/floor9" replace />} />
    </Routes>
  );
}

export default Floor9Router;
