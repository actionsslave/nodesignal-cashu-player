import { afterEach, describe, expect, it } from 'vitest';
import { closeDatabase, openDatabase, STORES } from '../../src/db/database.js';

afterEach(() => {
  closeDatabase();
});

describe('IndexedDB-Schema', () => {
  it('NFR-04: legt alle Stores für Abos, Episoden, Proofs und Verlauf an', async () => {
    const db = await openDatabase();
    expect([...db.objectStoreNames].sort()).toEqual([...STORES].sort());
  });

  it('speichert und liest einen Wert wieder aus', async () => {
    const db = await openDatabase();
    await db.put('settings', { key: 'streamingRate', value: 21 });
    const read = await db.get('settings', 'streamingRate');
    expect(read).toEqual({ key: 'streamingRate', value: 21 });
  });

  it('führt keine Abos und Episoden mehr — der Feed kommt aus dem Build-Snapshot', async () => {
    // SFR-01, SFR-08: Feed-Verwaltung entfällt; die Episodenliste liegt als
    // JSON im Bundle, nur die Hörposition gehört in IndexedDB.
    const db = await openDatabase();
    const stores = [...db.objectStoreNames];
    expect(stores).not.toContain('subscriptions');
    expect(stores).not.toContain('episodes');
    expect(stores).toContain('positions');
  });

  it('SFR-14: hält die Zuordnung von kind:7375-Events zu Proofs', async () => {
    const db = await openDatabase();
    expect([...db.objectStoreNames]).toContain('tokenEvents');
  });

  it('SFR-17: hält einen offenen Float, damit er wiederherstellbar ist', async () => {
    const db = await openDatabase();
    expect([...db.objectStoreNames]).toContain('floatState');
  });

  it('FR-29: hält eine Warteschlange für noch nicht bestätigte Nutzaps', async () => {
    const db = await openDatabase();
    expect([...db.objectStoreNames]).toContain('pendingNutzaps');
  });

  it('liefert bei mehrfachem Öffnen dieselbe Verbindung', async () => {
    const first = await openDatabase();
    const second = await openDatabase();
    expect(second).toBe(first);
  });
});
