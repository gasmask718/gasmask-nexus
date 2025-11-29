import { useState, useEffect, useCallback } from 'react';
import {
  AutomationRule,
  AutomationEvent,
  AutomationTrigger,
  getAllRules,
  getEnabledRules,
  getAutomationEvents,
  getAutomationStats,
  enableRule,
  disableRule,
  runRule,
  triggerAutomation,
  subscribeToAutomation,
} from '@/lib/automation/AutomationEngine';
import {
  initializeDefaultRules,
  getRulesByFloor,
} from '@/lib/automation/AutomationRules';
import {
  AINodePrediction,
  AINodeStatus,
  getAINodeStatus,
  getAllPredictions,
  runAllAINodes,
  toggleAINode,
  AINodeType,
} from '@/lib/automation/AINodes';
import { GrabbaBrandId } from '@/config/grabbaSkyscraper';

// Initialize rules on first import
let initialized = false;
if (!initialized) {
  initializeDefaultRules();
  initialized = true;
}

export function useAutomationRules(floorId?: string) {
  const [rules, setRules] = useState<AutomationRule[]>([]);

  useEffect(() => {
    const loadRules = () => {
      if (floorId) {
        setRules(getRulesByFloor(floorId));
      } else {
        setRules(getAllRules());
      }
    };

    loadRules();

    // Listen for automation events to refresh
    const handleEvent = () => loadRules();
    window.addEventListener('grabba-automation', handleEvent);
    return () => window.removeEventListener('grabba-automation', handleEvent);
  }, [floorId]);

  const toggle = useCallback((ruleId: string, enabled: boolean) => {
    if (enabled) {
      enableRule(ruleId);
    } else {
      disableRule(ruleId);
    }
    setRules(floorId ? getRulesByFloor(floorId) : getAllRules());
  }, [floorId]);

  const execute = useCallback(async (ruleId: string, payload?: Record<string, unknown>) => {
    return runRule(ruleId, payload);
  }, []);

  return { rules, toggle, execute };
}

export function useAutomationEvents(options?: {
  ruleId?: string;
  status?: AutomationEvent['status'];
  limit?: number;
}) {
  const [events, setEvents] = useState<AutomationEvent[]>([]);

  useEffect(() => {
    setEvents(getAutomationEvents(options));

    const unsubscribe = subscribeToAutomation(() => {
      setEvents(getAutomationEvents(options));
    });

    return unsubscribe;
  }, [options?.ruleId, options?.status, options?.limit]);

  return events;
}

export function useAutomationStats() {
  const [stats, setStats] = useState(getAutomationStats());

  useEffect(() => {
    const handleEvent = () => setStats(getAutomationStats());
    window.addEventListener('grabba-automation', handleEvent);
    return () => window.removeEventListener('grabba-automation', handleEvent);
  }, []);

  return stats;
}

export function useAutomationTrigger() {
  return useCallback((trigger: AutomationTrigger, payload?: Record<string, unknown>) => {
    triggerAutomation(trigger, payload);
  }, []);
}

export function useAINodes() {
  const [nodes, setNodes] = useState<AINodeStatus[]>(getAINodeStatus());

  useEffect(() => {
    const handlePrediction = () => setNodes(getAINodeStatus());
    window.addEventListener('grabba-ai-prediction', handlePrediction);
    return () => window.removeEventListener('grabba-ai-prediction', handlePrediction);
  }, []);

  const toggle = useCallback((nodeType: AINodeType, isActive: boolean) => {
    toggleAINode(nodeType, isActive);
    setNodes(getAINodeStatus());
  }, []);

  const runAll = useCallback((brand?: GrabbaBrandId) => {
    return runAllAINodes(brand);
  }, []);

  return { nodes, toggle, runAll };
}

export function useAIPredictions(options?: {
  nodeType?: AINodeType;
  brand?: GrabbaBrandId;
  limit?: number;
}) {
  const [predictions, setPredictions] = useState<AINodePrediction[]>([]);

  useEffect(() => {
    setPredictions(getAllPredictions(options));

    const handlePrediction = () => {
      setPredictions(getAllPredictions(options));
    };
    window.addEventListener('grabba-ai-prediction', handlePrediction);
    return () => window.removeEventListener('grabba-ai-prediction', handlePrediction);
  }, [options?.nodeType, options?.brand, options?.limit]);

  return predictions;
}

export function useAutomationIndicator() {
  const [activeCount, setActiveCount] = useState(0);
  const [recentEvent, setRecentEvent] = useState<AutomationEvent | null>(null);

  useEffect(() => {
    const updateCount = () => {
      setActiveCount(getEnabledRules().length);
    };
    updateCount();

    const unsubscribe = subscribeToAutomation((event) => {
      setRecentEvent(event);
      updateCount();
    });

    return unsubscribe;
  }, []);

  return { activeCount, recentEvent };
}
