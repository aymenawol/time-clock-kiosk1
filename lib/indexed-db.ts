/**
 * IndexedDB offline queue for driver tablet.
 * Stores pending writes when tablet has no connection.
 */

const DB_NAME    = 'tc_offline'
const DB_VERSION = 1

type StoreNames =
  | 'pending_counting_sheet_rows'
  | 'pending_inspections'
  | 'pending_status_changes'
  | 'pending_breaks'

let _db: IDBDatabase | null = null

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('pending_counting_sheet_rows')) {
        db.createObjectStore('pending_counting_sheet_rows', { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains('pending_inspections')) {
        db.createObjectStore('pending_inspections', { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains('pending_status_changes')) {
        db.createObjectStore('pending_status_changes', { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains('pending_breaks')) {
        db.createObjectStore('pending_breaks', { keyPath: 'key' })
      }
    }
    req.onsuccess  = () => { _db = req.result; resolve(req.result) }
    req.onerror    = () => reject(req.error)
  })
}

export async function queueWrite(store: StoreNames, key: string, data: unknown): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).put({ key, data, queuedAt: new Date().toISOString() })
    tx.oncomplete = () => resolve()
    tx.onerror    = () => reject(tx.error)
  })
}

export async function getAllQueued(store: StoreNames): Promise<Array<{ key: string; data: unknown; queuedAt: string }>> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).getAll()
    req.onsuccess = () => resolve(req.result ?? [])
    req.onerror   = () => reject(req.error)
  })
}

export async function deleteQueued(store: StoreNames, key: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror    = () => reject(tx.error)
  })
}

export async function countQueued(store: StoreNames): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).count()
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}
