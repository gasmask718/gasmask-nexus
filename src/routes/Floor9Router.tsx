/**
 * Floor9Router - Anti-404 shield for Floor 9 AI Operations
 * 
 * This router ensures no Floor 9 subpage can ever 404.
 * Bad links self-heal by redirecting to the hub.
 * 
 * Part of Phase 9.1 — AI Trust Hardening & Safety
 * Updated for Phase G-H — Governance Command Center
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
  Floor9Predictions,
  Floor9Alerts,
  Floor9Tasks
} from '@/pages/floor9';

// Governance Command Center (Phase H)
import GovernanceCommandCenter from '@/pages/admin/GovernanceCommandCenter';

// Phase 4.5 Observation Mode
import Floor9Observation from '@/pages/floor9/Floor9Observation';

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
      <Route path="alerts" element={<Floor9Alerts />} />
      <Route path="tasks" element={<Floor9Tasks />} />
      
      {/* Phase H: Governance Command Center */}
      <Route path="governance" element={<GovernanceCommandCenter />} />
      <Route path="command-center" element={<GovernanceCommandCenter />} />
      
      {/* Phase 4.5: Observation Mode */}
      <Route path="observation" element={<Floor9Observation />} />
      <Route path="learning" element={<Floor9Observation />} />
      
      {/* HARD FAILSAFE - Any unknown route redirects to hub */}
      <Route path="*" element={<Navigate to="/grabba/floor9" replace />} />
    </Routes>
  );
}

export default Floor9Router;
