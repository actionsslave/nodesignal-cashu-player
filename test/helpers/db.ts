import { closeDatabase, DB_NAME, openDatabase } from '../../src/db/database.js';

/** Frische, leere Datenbank für einen Testlauf. */
export async function resetDatabase(): Promise<void> {
  await closeDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
  await openDatabase();
}
