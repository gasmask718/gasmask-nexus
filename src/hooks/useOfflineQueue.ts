/**
 * Hook for managing offline action queue in portals
 * Phase 3: Offline-Ready, Crypto-Signed, Zero-Trust Edge Execution
 */

import { useState, useEffect, useCallback } from 'react';
import { offlineQueue, computePayloadHash, type SyncStatus, type QueuedAction } from '@/lib/offlineQueue';
import { deviceCrypto } from '@/lib/deviceCrypto';
import { useAuth } from '@/contexts/AuthContext';

interface UseOfflineQueueOptions {
  portalType: 'driver' | 'biker';
  deviceId: string;
}

interface EnqueueOptions {
  action_type: string;
  payload: Record<string, unknown>;
  assignment_id?: string;
  shift_id?: string;
}

export function useOfflineQueue({ portalType, deviceId }: UseOfflineQueueOptions) {
  const { user } = useAuth();
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    queuedCount: 0,
    sendingCount: 0,
    failedCount: 0,
    isSyncing: false,
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasCrypto, setHasCrypto] = useState(false);

  // Initialize queue and crypto
  useEffect(() => {
    const init = async () => {
      await offlineQueue.init();
      const cryptoReady = await deviceCrypto.init();
      setHasCrypto(cryptoReady);
      
      const initialStatus = await offlineQueue.getStatus();
      setStatus(initialStatus);
      setIsInitialized(true);
    };

    init();

    // Subscribe to status changes
    const unsubscribe = offlineQueue.subscribe(setStatus);

    return () => {
      unsubscribe();
    };
  }, []);

  // Enqueue an action with optional signing
  const enqueue = useCallback(async (options: EnqueueOptions): Promise<string> => {
    if (!user) throw new Error('User not authenticated');
    if (!isInitialized) throw new Error('Queue not initialized');

    const action_id = crypto.randomUUID();
    const client_timestamp = new Date().toISOString();
    
    // Compute payload hash
    const payload_hash = await computePayloadHash(options.payload);

    // Get sequence number (will be assigned by queue)
    const sequence_number = offlineQueue.getNextSequenceNumber();

    // Sign the action if crypto is available
    let signature: string | undefined;
    if (hasCrypto) {
      const sig = await deviceCrypto.signAction({
        action_id,
        device_id: deviceId,
        sequence_number,
        client_timestamp,
        payload_hash,
      });
      signature = sig || undefined;
    }

    // Enqueue the action
    const queueId = await offlineQueue.enqueue({
      action_id,
      portal_type: portalType,
      user_id: user.id,
      device_id: deviceId,
      assignment_id: options.assignment_id,
      shift_id: options.shift_id,
      action_type: options.action_type,
      payload: options.payload,
      client_timestamp,
      payload_hash,
      signature,
    });

    return queueId;
  }, [user, isInitialized, hasCrypto, deviceId, portalType]);

  // Force sync now
  const sync = useCallback(async () => {
    await offlineQueue.triggerSync();
  }, []);

  // Retry failed actions
  const retryFailed = useCallback(async () => {
    await offlineQueue.retryFailed();
  }, []);

  // Get all queued actions
  const getQueuedActions = useCallback(async (): Promise<QueuedAction[]> => {
    return offlineQueue.getQueuedActions();
  }, []);

  // Get failed actions
  const getFailedActions = useCallback(async (): Promise<QueuedAction[]> => {
    return offlineQueue.getFailedActions();
  }, []);

  return {
    status,
    isInitialized,
    hasCrypto,
    enqueue,
    sync,
    retryFailed,
    getQueuedActions,
    getFailedActions,
  };
}
