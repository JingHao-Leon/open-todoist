import type { Project, Task } from '../types';

/**
 * A deliberately small persistence layer.
 *
 * Two object stores, one settings store, no ORM and no migration framework: the
 * whole database is a few hundred lines and the data is plain JSON, so a user
 * can always export it and read it with `cat`.
 *
 * If IndexedDB is unavailable (private windows, hardened browser profiles) the
 * module transparently falls back to localStorage so the app still runs.
 */

const DB_NAME = 'open-todoist';
const DB_VERSION = 1;
const STORE_TASKS = 'tasks';
const STORE_PROJECTS = 'projects';
const STORE_SETTINGS = 'settings';
const FALLBACK_KEY = 'open-todoist-fallback-v1';

export interface Snapshot {
  tasks: Task[];
  projects: Project[];
}

let dbPromise: Promise<IDBDatabase | null> | null = null;
let usingFallback = false;

export function isUsingFallback(): boolean {
  return usingFallback;
}

function hasIndexedDb(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    if (!hasIndexedDb()) {
      usingFallback = true;
      resolve(null);
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      usingFallback = true;
      resolve(null);
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_TASKS)) {
        const tasks = db.createObjectStore(STORE_TASKS, { keyPath: 'id' });
        tasks.createIndex('byDeleted', 'isDeleted');
        tasks.createIndex('byProject', 'projectId');
        tasks.createIndex('byDue', 'due');
      }
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      usingFallback = true;
      resolve(null);
    };
    request.onblocked = () => {
      usingFallback = true;
      resolve(null);
    };
  });

  return dbPromise;
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/* ------------------------------------------------------------------ */
/* localStorage fallback                                               */
/* ------------------------------------------------------------------ */

function readFallback(): Snapshot {
  try {
    const raw = localStorage.getItem(FALLBACK_KEY);
    if (!raw) return { tasks: [], projects: [] };
    const parsed = JSON.parse(raw) as Snapshot;
    return { tasks: parsed.tasks ?? [], projects: parsed.projects ?? [] };
  } catch {
    return { tasks: [], projects: [] };
  }
}

function writeFallback(snapshot: Snapshot): void {
  try {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(snapshot));
  } catch {
    /* storage full or blocked — the app keeps working in memory */
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export async function loadSnapshot(): Promise<Snapshot> {
  const db = await openDatabase();
  if (!db) return readFallback();
  try {
    const tx = db.transaction([STORE_TASKS, STORE_PROJECTS], 'readonly');
    const [tasks, projects] = await Promise.all([
      promisify(tx.objectStore(STORE_TASKS).getAll() as IDBRequest<Task[]>),
      promisify(tx.objectStore(STORE_PROJECTS).getAll() as IDBRequest<Project[]>),
    ]);
    return { tasks, projects };
  } catch {
    usingFallback = true;
    return readFallback();
  }
}

/** Replace the entire dataset. Cheap enough at task-list sizes, and atomic. */
export async function saveSnapshot(snapshot: Snapshot): Promise<void> {
  const db = await openDatabase();
  if (!db) {
    writeFallback(snapshot);
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_TASKS, STORE_PROJECTS], 'readwrite');
    const taskStore = tx.objectStore(STORE_TASKS);
    const projectStore = tx.objectStore(STORE_PROJECTS);
    taskStore.clear();
    projectStore.clear();
    for (const task of snapshot.tasks) taskStore.put(task);
    for (const project of snapshot.projects) projectStore.put(project);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }).catch(() => {
    // Never lose the user's work: degrade to localStorage rather than throw.
    usingFallback = true;
    writeFallback(snapshot);
  });
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const db = await openDatabase();
  if (!db) {
    try {
      const raw = localStorage.getItem(`${FALLBACK_KEY}:${key}`);
      return raw ? (JSON.parse(raw) as T) : undefined;
    } catch {
      return undefined;
    }
  }
  try {
    const row = await promisify(
      db.transaction(STORE_SETTINGS, 'readonly').objectStore(STORE_SETTINGS).get(key),
    );
    return row ? (row.value as T) : undefined;
  } catch {
    return undefined;
  }
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const db = await openDatabase();
  if (!db) {
    try {
      localStorage.setItem(`${FALLBACK_KEY}:${key}`, JSON.stringify(value));
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    await promisify(
      db
        .transaction(STORE_SETTINGS, 'readwrite')
        .objectStore(STORE_SETTINGS)
        .put({ key, value }),
    );
  } catch {
    /* ignore */
  }
}
