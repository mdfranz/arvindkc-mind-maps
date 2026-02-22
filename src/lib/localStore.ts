import type { Edge, Node } from '@xyflow/react';
import type { MindNodeModelData } from '../types';

const STORAGE_KEY = 'mymind.vault.v2';
const KEY_KEY = 'mymind.vault.key.v2';

type MindFlowNode = Node<MindNodeModelData, 'mind'>;

export type StoredMindMap = {
  id: string | number;
  title: string;
  updatedAt: string;
  nodes: MindFlowNode[];
  edges: Edge[];
};

type Vault = {
  maps: StoredMindMap[];
};

type EncryptedVault = {
  v: 2;
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

async function getOrCreateKey(): Promise<CryptoKey> {
  const existing = localStorage.getItem(KEY_KEY);

  if (existing) {
    const raw = base64ToBytes(existing);
    return crypto.subtle.importKey('raw', toArrayBuffer(raw), { name: 'AES-GCM' }, true, [
      'encrypt',
      'decrypt'
    ]);
  }

  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt'
  ]);

  const exported = await crypto.subtle.exportKey('raw', key);
  localStorage.setItem(KEY_KEY, bytesToBase64(new Uint8Array(exported)));

  return key;
}

async function encryptVault(vault: Vault): Promise<EncryptedVault> {
  const key = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const plaintext = encoder.encode(JSON.stringify(vault));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, plaintext);

  return {
    v: 2,
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(ciphertext))
  };
}

async function decryptVault(payload: EncryptedVault): Promise<Vault> {
  const key = await getOrCreateKey();
  const iv = base64ToBytes(payload.iv);
  const encrypted = base64ToBytes(payload.data);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(encrypted)
  );

  const parsed = JSON.parse(decoder.decode(decrypted)) as Vault;
  return { maps: Array.isArray(parsed.maps) ? parsed.maps : [] };
}

export async function loadLocalMaps(): Promise<StoredMindMap[]> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  let payload: EncryptedVault;
  try {
    payload = JSON.parse(raw) as EncryptedVault;
  } catch {
    throw new Error('Saved local maps are unreadable.');
  }

  if (payload.v !== 2 || !payload.iv || !payload.data) {
    throw new Error('Saved local maps are invalid.');
  }

  try {
    const vault = await decryptVault(payload);
    return vault.maps;
  } catch {
    throw new Error('Unable to decrypt local maps for this browser profile.');
  }
}

export async function saveLocalMaps(maps: StoredMindMap[]): Promise<void> {
  const encrypted = await encryptVault({ maps });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(encrypted));
}
