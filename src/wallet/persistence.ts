/**
 * FR-18: Beim ersten Aufladen dauerhaften Speicher anfordern und das Ergebnis
 * anzeigen. Chrome entscheidet heuristisch und lehnt stillschweigend ab
 * (Kapitel 5.4) — deshalb wird das Ergebnis festgehalten statt ignoriert.
 */
import { openDatabase } from '../db/database.js';

export type StorageMode = 'dauerhaft' | 'best effort' | 'nicht unterstützt';

const SETTING_KEY = 'storageMode';

export async function ensurePersistentStorage(): Promise<StorageMode> {
  const storage = navigator.storage as StorageManager | undefined;
  let mode: StorageMode;
  if (!storage || typeof storage.persist !== 'function') {
    mode = 'nicht unterstützt';
  } else if (await storage.persisted()) {
    mode = 'dauerhaft';
  } else {
    mode = (await storage.persist()) ? 'dauerhaft' : 'best effort';
  }

  const db = await openDatabase();
  await db.put('settings', { key: SETTING_KEY, value: mode });
  return mode;
}

export async function readStorageMode(): Promise<StorageMode | undefined> {
  const db = await openDatabase();
  const record = await db.get('settings', SETTING_KEY);
  return record?.value as StorageMode | undefined;
}
