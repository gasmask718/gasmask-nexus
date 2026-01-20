/**
 * Offline Action Queue - IndexedDB-backed persistent queue for portal actions
 * Phase 3: Offline-Ready, Crypto-Signed, Zero-Trust Edge Execution
 */

const DB_NAME = 'dynasty_portal_queue';
const DB_VERSION = 1;
const STORE_NAME = 'actions';
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

export interface QueuedAction {
  id: string; // IndexedDB key
  action_id: string;
  portal_type: 'driver' | 'biker';
  user_id: string;
  device_id: string;
  assignment_id?: string;
  shift_id?: string;
  action_type: string;
  payload: Record<string, unknown>;
  client_timestamp: string;
  sequence_number: number;
  payload_hash: string;
  signature?: string;
  status: 'queued' | 'sending' | 'acked' | 'rejected' | 'deadletter';
  retry_count: number;
  last_error?: string;
  created_at: string;
  last_attempt_at?: string;
}

export interface SyncStatus {
  isOnline: boolean;
  queuedCount: number;
  sendingCount: number;
  failedCount: number;
  lastSyncAt?: string;
  isSyncing: boolean;
}

class OfflineQueueManager {
  private db: IDBDatabase | null = null;
  private isInitialized = false;
  private syncInProgress = false;
  private sequenceNumber = 0;
  private listeners: Set<(status: SyncStatus) => void> = new Set();
  private onlineHandler: (() => void) | null = null;

  async init(): Promise<void> {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        this.loadSequenceNumber();
        this.setupOnlineListener();
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('action_id', 'action_id', { unique: true });
          store.createIndex('sequence_number', 'sequence_number', { unique: false });
          store.createIndex('created_at', 'created_at', { unique: false });
        }
      };
    });
  }

  private async loadSequenceNumber(): Promise<void> {
    const actions = await this.getAllActions();
    if (actions.length > 0) {
      this.sequenceNumber = Math.max(...actions.map(a => a.sequence_number)) + 1;
    } else {
      // Try to load from localStorage as fallback
      const stored = localStorage.getItem('portal_sequence_number');
      this.sequenceNumber = stored ? parseInt(stored, 10) : 0;
    }
  }

  private saveSequenceNumber(): void {
    localStorage.setItem('portal_sequence_number', this.sequenceNumber.toString());
  }

  private setupOnlineListener(): void {
    this.onlineHandler = () => {
      if (navigator.onLine) {
        this.triggerSync();
      }
      this.notifyListeners();
    };
    
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.onlineHandler);
  }

  getNextSequenceNumber(): number {
    const seq = this.sequenceNumber++;
    this.saveSequenceNumber();
    return seq;
  }

  async enqueue(action: Omit<QueuedAction, 'id' | 'status' | 'retry_count' | 'created_at' | 'sequence_number'>): Promise<string> {
    await this.init();
    
    const id = crypto.randomUUID();
    const queuedAction: QueuedAction = {
      ...action,
      id,
      sequence_number: this.getNextSequenceNumber(),
      status: 'queued',
      retry_count: 0,
      created_at: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(queuedAction);

      request.onsuccess = () => {
        this.notifyListeners();
        // Attempt sync if online
        if (navigator.onLine) {
          this.triggerSync();
        }
        resolve(id);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getAction(id: string): Promise<QueuedAction | undefined> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllActions(): Promise<QueuedAction[]> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getQueuedActions(): Promise<QueuedAction[]> {
    const all = await this.getAllActions();
    return all.filter(a => a.status === 'queued' || a.status === 'sending');
  }

  async getFailedActions(): Promise<QueuedAction[]> {
    const all = await this.getAllActions();
    return all.filter(a => a.status === 'rejected' || a.status === 'deadletter');
  }

  async updateAction(id: string, updates: Partial<QueuedAction>): Promise<void> {
    await this.init();

    return new Promise(async (resolve, reject) => {
      const action = await this.getAction(id);
      if (!action) {
        reject(new Error('Action not found'));
        return;
      }

      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({ ...action, ...updates });

      request.onsuccess = () => {
        this.notifyListeners();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteAction(id: string): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        this.notifyListeners();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearAckedActions(): Promise<void> {
    const all = await this.getAllActions();
    const acked = all.filter(a => a.status === 'acked');
    for (const action of acked) {
      await this.deleteAction(action.id);
    }
  }

  async getStatus(): Promise<SyncStatus> {
    const all = await this.getAllActions();
    const lastSync = localStorage.getItem('portal_last_sync');

    return {
      isOnline: navigator.onLine,
      queuedCount: all.filter(a => a.status === 'queued').length,
      sendingCount: all.filter(a => a.status === 'sending').length,
      failedCount: all.filter(a => a.status === 'rejected' || a.status === 'deadletter').length,
      lastSyncAt: lastSync || undefined,
      isSyncing: this.syncInProgress,
    };
  }

  subscribe(callback: (status: SyncStatus) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private async notifyListeners(): Promise<void> {
    const status = await this.getStatus();
    this.listeners.forEach(cb => cb(status));
  }

  async triggerSync(): Promise<void> {
    if (this.syncInProgress || !navigator.onLine) return;

    this.syncInProgress = true;
    this.notifyListeners();

    try {
      const queued = await this.getQueuedActions();
      if (queued.length === 0) return;

      // Sort by sequence number
      queued.sort((a, b) => a.sequence_number - b.sequence_number);

      // Mark as sending
      for (const action of queued) {
        await this.updateAction(action.id, { status: 'sending', last_attempt_at: new Date().toISOString() });
      }

      // Import supabase dynamically to avoid circular deps
      const { supabase } = await import('@/integrations/supabase/client');

      // Prepare actions for ingestion - cast payload to Json-compatible type
      const actionsPayload = queued.map(a => ({
        action_id: a.action_id,
        portal_type: a.portal_type,
        device_id: a.device_id,
        assignment_id: a.assignment_id || null,
        shift_id: a.shift_id || null,
        action_type: a.action_type,
        payload: a.payload as Record<string, string | number | boolean | null>,
        client_timestamp: a.client_timestamp,
        sequence_number: a.sequence_number,
        payload_hash: a.payload_hash,
        signature: a.signature || null,
      }));

      const { data, error } = await supabase.rpc('ingest_portal_actions', {
        _actions: actionsPayload,
      });

      if (error) {
        throw error;
      }

      // Process results
      const results = data as Array<{
        action_id: string;
        status: 'acked' | 'rejected' | 'quarantined';
        rejection_code?: string;
        rejection_reason?: string;
      }>;

      for (const result of results) {
        const action = queued.find(a => a.action_id === result.action_id);
        if (!action) continue;

        if (result.status === 'acked') {
          await this.updateAction(action.id, { status: 'acked' });
        } else {
          const newRetryCount = action.retry_count + 1;
          if (newRetryCount >= MAX_RETRIES) {
            await this.updateAction(action.id, {
              status: 'deadletter',
              retry_count: newRetryCount,
              last_error: result.rejection_reason || 'Max retries exceeded',
            });
          } else {
            await this.updateAction(action.id, {
              status: 'queued',
              retry_count: newRetryCount,
              last_error: result.rejection_reason,
            });
          }
        }
      }

      localStorage.setItem('portal_last_sync', new Date().toISOString());

      // Clean up acked actions older than 1 hour
      await this.clearAckedActions();

    } catch (err) {
      console.error('Sync failed:', err);
      
      // Revert to queued status with backoff
      const queued = await this.getAllActions();
      for (const action of queued.filter(a => a.status === 'sending')) {
        const newRetryCount = action.retry_count + 1;
        await this.updateAction(action.id, {
          status: newRetryCount >= MAX_RETRIES ? 'deadletter' : 'queued',
          retry_count: newRetryCount,
          last_error: err instanceof Error ? err.message : 'Sync failed',
        });
      }

    } finally {
      this.syncInProgress = false;
      this.notifyListeners();
    }
  }

  async retryFailed(): Promise<void> {
    const failed = await this.getFailedActions();
    for (const action of failed) {
      if (action.status !== 'deadletter') {
        await this.updateAction(action.id, { status: 'queued', retry_count: 0, last_error: undefined });
      }
    }
    await this.triggerSync();
  }

  destroy(): void {
    if (this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler);
      window.removeEventListener('offline', this.onlineHandler);
    }
    if (this.db) {
      this.db.close();
    }
  }
}

// Singleton instance
export const offlineQueue = new OfflineQueueManager();

// Helper to compute payload hash
export async function computePayloadHash(payload: unknown): Promise<string> {
  const str = JSON.stringify(payload);
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
