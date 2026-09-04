/**
 * SFR-16, SFR-17: Entnahme und Rückgabe des Floats.
 *
 * Die harten Grenzen aus SNR-01 und SNR-02 stehen hier als Test, weil sie sich
 * nicht per Regex prüfen lassen: kein kind:17375 wird angefasst, und ein
 * Deletion-Event entsteht nur für kind:7375-Events, die diese App selbst
 * gelesen und verbraucht hat.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FloatService } from '../../src/nip60/float-service.js';
import { TOKEN_KIND, WALLET_KIND } from '../../src/nip60/wallet-event.js';
import { openDatabase } from '../../src/db/database.js';
import { LocalWallet } from '../../src/wallet/local-wallet.js';
import { resetDatabase } from '../helpers/db.js';
import { fakeNostr } from '../helpers/nostr.js';
import { fakeGateway, freshProofs } from '../helpers/mint.js';

const MINT = 'https://mint.macadamia.cash';
const PUBKEY = 'a'.repeat(64);
const RELAYS = ['wss://relay.example'];

function tokenEvent(id: string, amounts: number[]) {
  return {
    id,
    content: {
      mint: MINT,
      unit: 'sat',
      proofs: freshProofs(MINT, amounts),
      del: [],
    },
  };
}

function makeService(overrides: Partial<ConstructorParameters<typeof FloatService>[0]> = {}) {
  const nostr = fakeNostr({ acceptedBy: RELAYS });
  return {
    nostr,
    service: new FloatService({
      pubkeyHex: PUBKEY,
      relays: RELAYS,
      nostr,
      mint: fakeGateway(),
      encrypt: async (_pubkey: string, plaintext: string) => `enc:${plaintext}`,
      signEvent: async (event) => ({ ...event, id: `id-${event.kind}`, pubkey: PUBKEY, sig: 'sig' }),
      ...overrides,
    }),
  };
}

describe('FloatService', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('SFR-16: entnimmt den Betrag, legt ihn lokal ab und schreibt das Wechselgeld zurück', async () => {
    const { service, nostr } = makeService();
    const ergebnis = await service.take({
      amount: 500,
      mintUrl: MINT,
      events: [tokenEvent('ev-1', [1000])],
    });

    expect(ergebnis.amount).toBe(500);
    expect(ergebnis.change).toBe(500);

    // Der Float liegt als eigene Quelle lokal — nicht in der lokalen Wallet.
    await expect(new LocalWallet({ source: 'nip60' }).balance()).resolves.toBe(500);
    await expect(new LocalWallet().balance()).resolves.toBe(0);

    const kinds = nostr.published.map((event) => event.kind);
    expect(kinds).toContain(TOKEN_KIND);
    expect(kinds).toContain(5);
  });

  it('SNR-02: löscht nur die Events, die für diese Entnahme verbraucht wurden', async () => {
    const { service, nostr } = makeService();
    await service.take({
      amount: 500,
      mintUrl: MINT,
      events: [tokenEvent('ev-1', [1000]), tokenEvent('ev-2', [64])],
    });

    const deletion = nostr.published.find((event) => event.kind === 5);
    const geloescht = deletion?.tags.filter((tag) => tag[0] === 'e').map((tag) => tag[1]);
    expect(geloescht).toEqual(['ev-1']);
  });

  it('SNR-01: fasst das kind:17375 nie an', async () => {
    const { service, nostr } = makeService();
    await service.take({ amount: 500, mintUrl: MINT, events: [tokenEvent('ev-1', [1000])] });
    expect(nostr.published.some((event) => event.kind === WALLET_KIND)).toBe(false);
  });

  it('publiziert nichts, wenn das Guthaben beim Mint nicht reicht', async () => {
    const { service, nostr } = makeService();
    await expect(
      service.take({ amount: 500, mintUrl: MINT, events: [tokenEvent('ev-1', [64])] }),
    ).rejects.toThrow();
    expect(nostr.published).toEqual([]);
  });

  it('schreibt das neue Token-Event vor dem Deletion-Event', async () => {
    const { service, nostr } = makeService();
    await service.take({ amount: 500, mintUrl: MINT, events: [tokenEvent('ev-1', [1000])] });
    expect(nostr.published[0].kind).toBe(TOKEN_KIND);
    expect(nostr.published[1].kind).toBe(5);
  });

  it('SFR-17: gibt den Rest zurück und räumt den lokalen Float weg', async () => {
    const { service, nostr } = makeService();
    await service.take({ amount: 500, mintUrl: MINT, events: [tokenEvent('ev-1', [1000])] });
    nostr.published.length = 0;

    const rueckgabe = await service.giveBack();
    expect(rueckgabe?.amount).toBe(500);
    await expect(new LocalWallet({ source: 'nip60' }).balance()).resolves.toBe(0);
    expect(nostr.published.map((e) => e.kind)).toEqual([TOKEN_KIND]);

    const db = await openDatabase();
    await expect(db.get('floatState', 'current')).resolves.toBeUndefined();
  });

  it('SFR-17: eine zweite Rückgabe publiziert nichts', async () => {
    const { service, nostr } = makeService();
    await service.take({ amount: 500, mintUrl: MINT, events: [tokenEvent('ev-1', [1000])] });
    await service.giveBack();
    nostr.published.length = 0;

    await expect(service.giveBack()).resolves.toBeUndefined();
    expect(nostr.published).toEqual([]);
  });

  it('lässt den lokalen Float liegen, wenn die Rückgabe am Relay scheitert', async () => {
    const { service, nostr } = makeService();
    await service.take({ amount: 500, mintUrl: MINT, events: [tokenEvent('ev-1', [1000])] });
    nostr.publish = vi.fn(async () => {
      throw new Error('kein Relay');
    });

    await expect(service.giveBack()).rejects.toThrow();
    // Das Guthaben ist nicht verloren — es liegt weiter lokal und wird beim
    // nächsten Besuch angeboten (SOQ-03).
    await expect(new LocalWallet({ source: 'nip60' }).balance()).resolves.toBe(500);
  });
});
