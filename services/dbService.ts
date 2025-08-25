
import { type UploadedCorpus } from '../types';

const DB_NAME = 'gemini-musical-map-db';
const DB_VERSION = 1;
const STORE_NAME = 'corpora';

let db: IDBDatabase;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        dbInstance.createObjectStore(STORE_NAME, { keyPath: 'name' });
      }
    };

    request.onsuccess = (event) => {
      db = (event.target as IDBOpenDBRequest).result;
      resolve(db);
    };

    request.onerror = (event) => {
      console.error('IndexedDB error:', (event.target as IDBOpenDBRequest).error);
      reject('Error opening IndexedDB.');
    };
  });
}

export async function saveCorpus(corpus: UploadedCorpus): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(corpus);

    request.onsuccess = () => resolve();
    request.onerror = (event) => {
        console.error("Error saving corpus to IndexedDB:", (event.target as IDBRequest).error);
        reject('Error saving corpus.');
    }
  });
}

export async function getCorpus(name: string): Promise<UploadedCorpus | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(name);

    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => {
        console.error("Error getting corpus from IndexedDB:", (event.target as IDBRequest).error);
        reject('Error getting corpus.');
    }
  });
}

export async function getAllCorpusNames(): Promise<string[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAllKeys();

    request.onsuccess = () => {
        resolve(request.result as string[]);
    };
    request.onerror = (event) => {
        console.error("Error getting corpus names from IndexedDB:", (event.target as IDBRequest).error);
        reject('Error getting corpus names.');
    }
  });
}
