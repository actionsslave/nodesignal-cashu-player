import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeDatabase, openDatabase } from '../../src/db/database.js';
import { LocalWallet } from '../../src/wallet/local-wallet.js';
import {
  ensurePersistentStorage,
  readStorageMode,
} from '../../src/wallet/persistence.js';
import { resetDatabase } from '../helpers/db.js';
import { encodeToken, fakeGateway, freshProofs } from '../helpers/mint.js';

const ERLAUBT = 'https://mint-a.example';

function installStorage(storage: unknown): void {
  Object.defineProperty(navigator, 'storage', { value: storage, configurable: true });
}

beforeEach(async () => {
  await resetDatabase();
});

afterEach(async () => {
  installStorage(undefined);
  await closeDatabase();
});

describe('FR-18: Dauerhaften Speicher anfordern', () => {
  it('meldet "dauerhaft", wenn der Browser zusagt', async () => {
    installStorage({ persisted: async () => false, persist: async () => true });
    await expect(ensurePersistentStorage()).resolves.toBe('dauerhaft');
  });

  it('meldet "best effort", wenn der Browser stillschweigend ablehnt', async () => {
    installStorage({ persisted: async () => false, persist: async () => false });
    await expect(ensurePersistentStorage()).resolves.toBe('best effort');
  });

  it('meldet "nicht unterstützt", wenn die API fehlt', async () => {
    installStorage(undefined);
    await expect(ensurePersistentStorage()).resolves.toBe('nicht unterstützt');
  });

  it('fragt nicht erneut an, wenn der Speicher schon dauerhaft ist', async () => {
    const persist = vi.fn(async () => true);
    installStorage({ persisted: async () => true, persist });
    await expect(ensurePersistentStorage()).resolves.toBe('dauerhaft');
    expect(persist).not.toHaveBeenCalled();
  });

  it('hinterlegt das Ergebnis für die Wallet-Einstellungen', async () => {
    installStorage({ persisted: async () => false, persist: async () => false });
    await ensurePersistentStorage();
    await expect(readStorageMode()).resolves.toBe('best effort');
  });

  it('US-04-AC-2: das erste Aufladen fordert dauerhaften Speicher an', async () => {
    const persist = vi.fn(async () => true);
    installStorage({ persisted: async () => false, persist });

    const wallet = new LocalWallet({
      gateway: fakeGateway({ received: freshProofs(ERLAUBT, [10]) }),
      allowedMints: [ERLAUBT],
    });
    await wallet.importToken(encodeToken(ERLAUBT, [10]));

    expect(persist).toHaveBeenCalledTimes(1);
    await expect(readStorageMode()).resolves.toBe('dauerhaft');
  });

  it('ohne vorherige Anfrage ist der Modus unbekannt', async () => {
    const db = await openDatabase();
    expect(await db.get('settings', 'storageMode')).toBeUndefined();
    await expect(readStorageMode()).resolves.toBeUndefined();
  });
});
