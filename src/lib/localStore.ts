import type { Edge, Node } from '@xyflow/react';
import type { MindNodeData } from '../types';

const STORAGE_KEY = 'mymind.encrypted.v1';
const PBKDF2_ITERATIONS = 210000;

type MindFlowNode = Node<MindNodeData, 'mind'>;

export type StoredMindMap = {
  id: string;
  title: string;
  updatedAt: string;
  nodes: MindFlowNode[];
  edges: Edge[];
};

type Vault = {
  maps: StoredMindMap[];
};

type EncryptedVault = {
  v: 1;
  salt: string;
  iv: string;
  data: string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: 256
    },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptVault(vault: Vault, passphrase: string): Promise<EncryptedVault> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);

  const plaintext = encoder.encode(JSON.stringify(vault));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(iv)
    },
    key,
    plaintext
  );

  return {
    v: 1,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(ciphertext))
  };
}

async function decryptVault(payload: EncryptedVault, passphrase: string): Promise<Vault> {
  const salt = base64ToBytes(payload.salt);
  const iv = base64ToBytes(payload.iv);
  const encrypted = base64ToBytes(payload.data);

  const key = await deriveKey(passphrase, salt);
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(iv)
    },
    key,
    toArrayBuffer(encrypted)
  );

  const json = decoder.decode(decrypted);
  const parsed = JSON.parse(json) as Vault;

  return {
    maps: Array.isArray(parsed.maps) ? parsed.maps : []
  };
}

export async function loadEncryptedMaps(passphrase: string): Promise<StoredMindMap[]> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  let payload: EncryptedVault;
  try {
    payload = JSON.parse(raw) as EncryptedVault;
  } catch {
    throw new Error('Encrypted local storage is unreadable.');
  }

  if (payload.v !== 1 || !payload.salt || !payload.iv || !payload.data) {
    throw new Error('Encrypted local storage format is invalid.');
  }

  try {
    const vault = await decryptVault(payload, passphrase);
    return vault.maps;
  } catch {
    throw new Error('Failed to decrypt local maps. Check your passphrase.');
  }
}

export async function saveEncryptedMaps(maps: StoredMindMap[], passphrase: string): Promise<void> {
  const vault: Vault = { maps };
  const encrypted = await encryptVault(vault, passphrase);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(encrypted));
}
