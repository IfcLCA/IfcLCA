/**
 * Client-side IFC file cache using IndexedDB.
 *
 * Stores the raw IFC binary per project so the 3D model
 * can be restored when revisiting a project without re-uploading.
 *
 * Schema: DB "ifclca-files", object store "ifc-files"
 *   key: projectId (string)
 *   value: { projectId, fileName, buffer (ArrayBuffer), storedAt (number) }
 */

const DB_NAME = "ifclca-files";
const DB_VERSION = 1;
const STORE_NAME = "ifc-files";

interface CachedIfcFile {
  projectId: string;
  fileName: string;
  buffer: ArrayBuffer;
  storedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "projectId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Store an IFC file buffer for a project. */
export async function saveIfcFile(
  projectId: string,
  fileName: string,
  buffer: ArrayBuffer
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const record: CachedIfcFile = {
      projectId,
      fileName,
      buffer,
      storedAt: Date.now(),
    };

    store.put(record);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch (err) {
    console.warn("[ifc-cache] Failed to save IFC file:", err);
  }
}

/** Retrieve a cached IFC file for a project. Returns null if not found. */
export async function loadIfcFile(
  projectId: string
): Promise<{ fileName: string; buffer: ArrayBuffer } | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(projectId);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        db.close();
        const record = request.result as CachedIfcFile | undefined;
        if (record) {
          resolve({ fileName: record.fileName, buffer: record.buffer });
        } else {
          resolve(null);
        }
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (err) {
    console.warn("[ifc-cache] Failed to load IFC file:", err);
    return null;
  }
}

/** Delete a cached IFC file for a project. */
export async function deleteIfcFile(projectId: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(projectId);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch (err) {
    console.warn("[ifc-cache] Failed to delete IFC file:", err);
  }
}

/** Check if a cached IFC file exists for a project. */
export async function hasIfcFile(projectId: string): Promise<boolean> {
  const file = await loadIfcFile(projectId);
  return file !== null;
}
