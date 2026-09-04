import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { npubEncode } from 'nostr-tools/nip19';
import { closeDatabase, openDatabase } from '../../src/db/database.js';
import { resetDatabase } from '../helpers/db.js';
import { login, logout, restoreSession, shortNpub } from '../../src/identity/session.js';

const PUBKEY_HEX = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
const NPUB = npubEncode(PUBKEY_HEX);

function install(provider: unknown): void {
  (window as { nostr?: unknown }).nostr = provider;
}

beforeEach(async () => {
  await resetDatabase();
});

afterEach(async () => {
  delete (window as { nostr?: unknown }).nostr;
  await closeDatabase();
});

describe('FR-02: Anmelden und Session', () => {
  it('US-01-AC-1: holt den Pubkey und speichert ihn als hex und npub', async () => {
    install({ getPublicKey: async () => PUBKEY_HEX });
    const session = await login();
    expect(session.pubkeyHex).toBe(PUBKEY_HEX);
    expect(session.npub).toBe(NPUB);
  });

  it('US-01-AC-1: zeigt den npub in gekürzter Form', () => {
    expect(shortNpub(NPUB)).toBe(`${NPUB.slice(0, 10)}…${NPUB.slice(-6)}`);
  });

  it('US-01-AC-2: die Session überlebt einen Reload ohne erneute Freigabeabfrage', async () => {
    const getPublicKey = vi.fn(async () => PUBKEY_HEX);
    install({ getPublicKey });
    await login();

    await closeDatabase();
    getPublicKey.mockClear();

    const restored = await restoreSession();
    expect(restored?.pubkeyHex).toBe(PUBKEY_HEX);
    expect(getPublicKey).not.toHaveBeenCalled();
  });

  it('liefert ohne vorherige Anmeldung keine Session', async () => {
    await expect(restoreSession()).resolves.toBeUndefined();
  });

  it('US-01-AC-4: eine abgelehnte Freigabe legt keine Session an', async () => {
    install({ getPublicKey: async () => { throw new Error('rejected'); } });
    await expect(login()).rejects.toMatchObject({ reason: 'abgelehnt' });
    await expect(restoreSession()).resolves.toBeUndefined();
  });

  it('US-01-AC-3: ohne Extension schlägt der Login mit benanntem Grund fehl', async () => {
    delete (window as { nostr?: unknown }).nostr;
    await expect(login()).rejects.toMatchObject({ reason: 'keine-extension' });
  });
});

describe('FR-06: Abmelden', () => {
  it('löscht Pubkey und Session', async () => {
    install({ getPublicKey: async () => PUBKEY_HEX });
    await login();
    await logout();
    await expect(restoreSession()).resolves.toBeUndefined();
  });

  it('lässt die lokale Wallet unangetastet', async () => {
    install({ getPublicKey: async () => PUBKEY_HEX });
    await login();
    const db = await openDatabase();
    await db.put('proofs', {
      secret: 's1',
      mintUrl: 'https://mint.example',
      amount: 21,
      state: 'available',
      proof: { id: 'k', amount: 21, secret: 's1', C: 'c' },
    });

    await logout();

    expect(await db.count('proofs')).toBe(1);
  });
});
