/**
 * Device Cryptographic Signing - WebCrypto-based keypair management
 * Phase 3: Offline-Ready, Crypto-Signed, Zero-Trust Edge Execution
 */

const KEY_STORAGE_NAME = 'dynasty_device_keypair';
const ALGORITHM = {
  name: 'ECDSA',
  namedCurve: 'P-256',
};
const SIGN_ALGORITHM = {
  name: 'ECDSA',
  hash: { name: 'SHA-256' },
};

export interface DeviceKeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicKeyBase64: string;
  createdAt: string;
}

interface StoredKeyData {
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
  createdAt: string;
}

class DeviceCryptoManager {
  private keyPair: DeviceKeyPair | null = null;
  private isInitialized = false;

  /**
   * Check if WebCrypto is available and supports required algorithms
   */
  isSupported(): boolean {
    return !!(
      window.crypto &&
      window.crypto.subtle &&
      typeof window.crypto.subtle.generateKey === 'function' &&
      typeof window.crypto.subtle.sign === 'function' &&
      typeof window.crypto.subtle.exportKey === 'function'
    );
  }

  /**
   * Initialize or load existing keypair
   */
  async init(): Promise<boolean> {
    if (this.isInitialized && this.keyPair) return true;

    if (!this.isSupported()) {
      console.warn('WebCrypto not fully supported, device signing disabled');
      return false;
    }

    try {
      // Try to load existing keypair from IndexedDB
      const stored = await this.loadStoredKey();
      if (stored) {
        this.keyPair = await this.importKeyPair(stored);
        this.isInitialized = true;
        return true;
      }

      // Generate new keypair
      await this.generateKeyPair();
      this.isInitialized = true;
      return true;

    } catch (err) {
      console.error('Failed to initialize device crypto:', err);
      return false;
    }
  }

  /**
   * Generate a new ECDSA P-256 keypair
   */
  async generateKeyPair(): Promise<DeviceKeyPair> {
    const keyPair = await window.crypto.subtle.generateKey(
      ALGORITHM,
      true, // extractable for storage
      ['sign', 'verify']
    );

    // Export public key for server storage
    const publicKeyExported = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
    const publicKeyBase64 = this.arrayBufferToBase64(publicKeyExported);

    // Export both keys as JWK for storage
    const publicKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const privateKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);

    const createdAt = new Date().toISOString();

    // Store keypair
    await this.storeKey({
      publicKeyJwk,
      privateKeyJwk,
      createdAt,
    });

    this.keyPair = {
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
      publicKeyBase64,
      createdAt,
    };

    return this.keyPair;
  }

  /**
   * Get the public key in base64 format for server registration
   */
  getPublicKeyBase64(): string | null {
    return this.keyPair?.publicKeyBase64 || null;
  }

  /**
   * Get key creation timestamp
   */
  getKeyCreatedAt(): string | null {
    return this.keyPair?.createdAt || null;
  }

  /**
   * Sign data using the device private key
   */
  async sign(data: string): Promise<string | null> {
    if (!this.keyPair) {
      console.warn('No keypair available for signing');
      return null;
    }

    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);

      const signature = await window.crypto.subtle.sign(
        SIGN_ALGORITHM,
        this.keyPair.privateKey,
        dataBuffer
      );

      return this.arrayBufferToBase64(signature);

    } catch (err) {
      console.error('Signing failed:', err);
      return null;
    }
  }

  /**
   * Sign an action payload for the offline queue
   */
  async signAction(params: {
    action_id: string;
    device_id: string;
    sequence_number: number;
    client_timestamp: string;
    payload_hash: string;
  }): Promise<string | null> {
    // Create canonical string to sign
    const dataToSign = [
      params.action_id,
      params.device_id,
      params.sequence_number.toString(),
      params.client_timestamp,
      params.payload_hash,
    ].join('|');

    return this.sign(dataToSign);
  }

  /**
   * Verify a signature (for testing, actual verification happens server-side)
   */
  async verify(data: string, signatureBase64: string): Promise<boolean> {
    if (!this.keyPair) return false;

    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      const signatureBuffer = this.base64ToArrayBuffer(signatureBase64);

      return await window.crypto.subtle.verify(
        SIGN_ALGORITHM,
        this.keyPair.publicKey,
        signatureBuffer,
        dataBuffer
      );

    } catch (err) {
      console.error('Verification failed:', err);
      return false;
    }
  }

  /**
   * Force key rotation (clears existing keys)
   */
  async rotateKeys(): Promise<DeviceKeyPair | null> {
    await this.clearStoredKey();
    this.keyPair = null;
    this.isInitialized = false;
    
    try {
      await this.generateKeyPair();
      this.isInitialized = true;
      return this.keyPair;
    } catch (err) {
      console.error('Key rotation failed:', err);
      return null;
    }
  }

  /**
   * Check if key rotation is required (public key cleared by admin)
   */
  hasKeys(): boolean {
    return this.keyPair !== null;
  }

  // Private helper methods

  private async loadStoredKey(): Promise<StoredKeyData | null> {
    return new Promise((resolve) => {
      const request = indexedDB.open('dynasty_crypto', 1);

      request.onerror = () => resolve(null);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('keys')) {
          db.createObjectStore('keys', { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        try {
          const transaction = db.transaction(['keys'], 'readonly');
          const store = transaction.objectStore('keys');
          const getRequest = store.get(KEY_STORAGE_NAME);

          getRequest.onsuccess = () => {
            resolve(getRequest.result?.data || null);
          };

          getRequest.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      };
    });
  }

  private async storeKey(data: StoredKeyData): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('dynasty_crypto', 1);

      request.onerror = () => reject(request.error);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('keys')) {
          db.createObjectStore('keys', { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['keys'], 'readwrite');
        const store = transaction.objectStore('keys');
        store.put({ id: KEY_STORAGE_NAME, data });

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      };
    });
  }

  private async clearStoredKey(): Promise<void> {
    return new Promise((resolve) => {
      const request = indexedDB.open('dynasty_crypto', 1);

      request.onerror = () => resolve();

      request.onsuccess = () => {
        const db = request.result;
        try {
          const transaction = db.transaction(['keys'], 'readwrite');
          const store = transaction.objectStore('keys');
          store.delete(KEY_STORAGE_NAME);
          resolve();
        } catch {
          resolve();
        }
      };
    });
  }

  private async importKeyPair(stored: StoredKeyData): Promise<DeviceKeyPair> {
    const publicKey = await window.crypto.subtle.importKey(
      'jwk',
      stored.publicKeyJwk,
      ALGORITHM,
      true,
      ['verify']
    );

    const privateKey = await window.crypto.subtle.importKey(
      'jwk',
      stored.privateKeyJwk,
      ALGORITHM,
      true,
      ['sign']
    );

    const publicKeyExported = await window.crypto.subtle.exportKey('spki', publicKey);
    const publicKeyBase64 = this.arrayBufferToBase64(publicKeyExported);

    return {
      publicKey,
      privateKey,
      publicKeyBase64,
      createdAt: stored.createdAt,
    };
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

// Singleton instance
export const deviceCrypto = new DeviceCryptoManager();
