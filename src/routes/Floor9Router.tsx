/**
 * Floor9Router - Anti-404 shield for Floor 9 AI Operations
 * 
 * This router ensures no Floor 9 subpage can ever 404.
 * Bad links self-heal by redirecting to the hub.
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';

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
import Floor9AIAgents from '@/pages/floor9/Floor9AIAgents';

// Note Cleaner Agent
const NoteCleanerPage = lazy(() => import('@/pages/gasmask/NoteCleanerPage'));

/**
 * Floor9Router - Centralized routing for Floor 9 AI Operations
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
      
      {/* Note Cleaner Agent */}
      <Route path="note-cleaner" element={
        <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading Note Cleaner...</div>}>
          <NoteCleanerPage />
        </Suspense>
      } />
      
      {/* Phase H: Governance Command Center */}
      <Route path="governance" element={<GovernanceCommandCenter />} />
      <Route path="command-center" element={<GovernanceCommandCenter />} />
      
      {/* Phase 4.5: Observation Mode */}
      <Route path="observation" element={<Floor9Observation />} />
      <Route path="learning" element={<Floor9Observation />} />

      {/* Item #22/#23: Floor Agents + AI Backfill */}
      <Route path="ai-agents" element={<Floor9AIAgents />} />
      <Route path="backfill" element={<Floor9AIAgents />} />
      
      {/* HARD FAILSAFE - Any unknown route redirects to hub */}
      <Route path="*" element={<Navigate to="/grabba/floor9" replace />} />
    </Routes>
  );
}

export default Floor9Router;
