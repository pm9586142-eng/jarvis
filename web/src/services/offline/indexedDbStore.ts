import {
  ChatSession,
  LocalModelRuntimeState,
  MemoryItem,
  NoteItem,
  SystemEventEntry,
  TaskItem,
} from '../../types/jarvis';

const DB_NAME = 'am_ai_cosmic_db';
const DB_VERSION = 1;

export type IndexedDbStoreName =
  | 'kv_meta'
  | 'sessions'
  | 'memories'
  | 'tasks'
  | 'notes'
  | 'sync_queue'
  | 'local_models'
  | 'event_logs';

export interface PendingSyncQueueEntry {
  id: string;
  entityType: 'task' | 'note' | 'memory';
  operation: 'upsert' | 'delete';
  recordId: string;
  payload?: TaskItem | NoteItem | MemoryItem;
  queuedAt: number;
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (!hasIndexedDb()) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        const stores: Array<{ name: IndexedDbStoreName; keyPath?: string }> = [
          { name: 'kv_meta', keyPath: 'key' },
          { name: 'sessions', keyPath: 'id' },
          { name: 'memories', keyPath: 'id' },
          { name: 'tasks', keyPath: 'id' },
          { name: 'notes', keyPath: 'id' },
          { name: 'sync_queue', keyPath: 'id' },
          { name: 'local_models', keyPath: 'modelId' },
          { name: 'event_logs', keyPath: 'id' },
        ];
        for (const s of stores) {
          if (!db.objectStoreNames.contains(s.name)) {
            db.createObjectStore(s.name, { keyPath: s.keyPath });
          }
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readAllFromStore<T>(storeName: IndexedDbStoreName): Promise<T[]> {
  const db = await openDatabase();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? (req.result as T[]) : []);
      req.onerror = () => resolve([]);
      tx.oncomplete = () => db.close();
      tx.onabort = () => db.close();
    } catch {
      db.close();
      resolve([]);
    }
  });
}

async function replaceStoreItems<T>(storeName: IndexedDbStoreName, items: T[]): Promise<boolean> {
  const db = await openDatabase();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();
      for (const item of items) {
        store.put(item);
      }
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
      tx.onabort = () => {
        db.close();
        resolve(false);
      };
    } catch {
      db.close();
      resolve(false);
    }
  });
}

export const amIndexedDbStore = {
  isSupported: hasIndexedDb,

  getSessions: () => readAllFromStore<ChatSession>('sessions'),
  saveSessions: (items: ChatSession[]) =>
    replaceStoreItems(
      'sessions',
      items.filter((s) => !s.isTemporary)
    ),

  getMemories: () => readAllFromStore<MemoryItem>('memories'),
  saveMemories: (items: MemoryItem[]) => replaceStoreItems('memories', items),

  getTasks: () => readAllFromStore<TaskItem>('tasks'),
  saveTasks: (items: TaskItem[]) => replaceStoreItems('tasks', items),

  getNotes: () => readAllFromStore<NoteItem>('notes'),
  saveNotes: (items: NoteItem[]) => replaceStoreItems('notes', items),

  getSyncQueue: () => readAllFromStore<PendingSyncQueueEntry>('sync_queue'),
  saveSyncQueue: (items: PendingSyncQueueEntry[]) => replaceStoreItems('sync_queue', items),

  getLocalModels: () => readAllFromStore<LocalModelRuntimeState>('local_models'),
  saveLocalModels: (items: LocalModelRuntimeState[]) => replaceStoreItems('local_models', items),

  getEventLogs: () => readAllFromStore<SystemEventEntry>('event_logs'),
  saveEventLogs: (items: SystemEventEntry[]) => replaceStoreItems('event_logs', items.slice(0, 200)),

  async setMetaValue(key: string, value: unknown): Promise<boolean> {
    const db = await openDatabase();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('kv_meta', 'readwrite');
        tx.objectStore('kv_meta').put({ key, value, updatedAt: Date.now() });
        tx.oncomplete = () => {
          db.close();
          resolve(true);
        };
        tx.onerror = () => {
          db.close();
          resolve(false);
        };
      } catch {
        db.close();
        resolve(false);
      }
    });
  },
};
