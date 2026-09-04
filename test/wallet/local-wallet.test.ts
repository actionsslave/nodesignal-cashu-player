import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, openDatabase } from '../../src/db/database.js';
import { InsufficientFundsError } from '../../src/contracts/index.js';
import { LocalWallet } from '../../src/wallet/local-wallet.js';
import { resetDatabase } from '../helpers/db.js';
import { MINT_A, MINT_B, seedProofs } from '../helpers/proofs.js';
import { freshProofs } from '../helpers/mint.js';

let wallet: LocalWallet;

beforeEach(async () => {
  await resetDatabase();
  wallet = new LocalWallet();
});

afterEach(async () => {
  await closeDatabase();
});

describe('FR-15: Guthaben', () => {
  it('summiert die verfügbaren Proofs in Sat', async () => {
    await seedProofs([1, 2, 8]);
    await expect(wallet.balance()).resolves.toBe(11);
  });

  it('ist ohne Proofs 0', async () => {
    await expect(wallet.balance()).resolves.toBe(0);
  });
});

describe('FR-15: Proofs aufnehmen', () => {
  it('nimmt frische Proofs eines Mints in das verfügbare Guthaben auf', async () => {
    await wallet.addProofs(MINT_A, [
      { id: '00ad268c4d1f5826', amount: 7, secret: 'neu-1', C: `02${'a'.repeat(64)}` },
    ]);
    await expect(wallet.balance()).resolves.toBe(7);
  });

  it('nimmt eine leere Liste ohne Wirkung entgegen', async () => {
    await wallet.addProofs(MINT_A, []);
    await expect(wallet.balance()).resolves.toBe(0);
  });
});

describe('FR-29: Reserve-Semantik', () => {
  it('nimmt reservierte Proofs aus dem verfügbaren Guthaben', async () => {
    await seedProofs([8, 8]);
    const bundle = await wallet.reserve(8);
    expect(bundle.amount).toBeGreaterThanOrEqual(8);
    await expect(wallet.balance()).resolves.toBe(16 - bundle.amount);
  });

  it('commit entfernt die reservierten Proofs endgültig', async () => {
    await seedProofs([4, 4]);
    const bundle = await wallet.reserve(4);
    await wallet.commit(bundle);

    const db = await openDatabase();
    expect(await db.count('proofs')).toBe(2 - bundle.proofs.length);
    await expect(wallet.balance()).resolves.toBe(8 - bundle.amount);
  });

  it('US-06-AC-4: release stellt das ursprüngliche Guthaben vollständig wieder her', async () => {
    await seedProofs([16, 4, 1]);
    const before = await wallet.balance();
    const bundle = await wallet.reserve(17);
    await wallet.release(bundle);
    await expect(wallet.balance()).resolves.toBe(before);
  });

  it('wählt so wenige Proofs wie möglich und deckt den Betrag ab', async () => {
    await seedProofs([1, 2, 4, 8, 16]);
    const bundle = await wallet.reserve(10);
    expect(bundle.amount).toBeGreaterThanOrEqual(10);
    expect(bundle.proofs.length).toBeLessThanOrEqual(3);
  });

  it('meldet zu wenig Guthaben mit angefragtem und verfügbarem Betrag', async () => {
    await seedProofs([2, 3]);
    await expect(wallet.reserve(10)).rejects.toBeInstanceOf(InsufficientFundsError);
    await expect(wallet.reserve(10)).rejects.toMatchObject({ requested: 10, available: 5 });
  });

  it('reserviert nur Proofs eines einzigen Mints', async () => {
    await seedProofs([5], MINT_A);
    await seedProofs([5], MINT_B);
    const bundle = await wallet.reserve(5);
    expect(bundle.proofs.every((p) => p.secret.length > 0)).toBe(true);
    expect([MINT_A, MINT_B]).toContain(bundle.mintUrl);
    expect(bundle.amount).toBe(5);
  });

  it('kann auf einen bestimmten Mint eingeschränkt werden', async () => {
    await seedProofs([5], MINT_A);
    await seedProofs([9], MINT_B);
    const bundle = await wallet.reserve(6, MINT_B);
    expect(bundle.mintUrl).toBe(MINT_B);
  });

  it('erkennt den Mint normalisiert, nicht zeichengenau', async () => {
    await seedProofs([9], MINT_B);
    const bundle = await wallet.reserve(6, 'https://Mint-B.example/');
    expect(bundle.mintUrl).toBe(MINT_B);
  });

  it('meldet zu wenig Guthaben, wenn nur ein anderer Mint gedeckt wäre', async () => {
    await seedProofs([100], MINT_A);
    await expect(wallet.reserve(5, MINT_B)).rejects.toBeInstanceOf(InsufficientFundsError);
  });

  it('reserviert dieselben Proofs nicht zweimal', async () => {
    await seedProofs([5, 5]);
    const first = await wallet.reserve(5);
    const second = await wallet.reserve(5);
    const overlap = first.proofs.filter((p) => second.proofs.some((q) => q.secret === p.secret));
    expect(overlap).toEqual([]);
  });
});

describe('NIP-61: Mint-URLs normalisieren und deduplizieren', () => {
  // Final Consideration 2 der Spezifikation. Praktisch entsteht der Fall so:
  // Ein Token wird unter der Schreibweise des Ausstellers importiert, das
  // Wechselgeld eines Nutzaps landet unter der Schreibweise aus dem
  // kind:10019 des Empfaengers. Beides ist derselbe Mint.
  const MIT_SLASH = 'https://mint-a.example/';
  const OHNE_SLASH = 'https://mint-a.example';

  it('legt frische Proofs unter der normalisierten URL ab', async () => {
    const wallet = new LocalWallet();
    await wallet.addProofs(MIT_SLASH, freshProofs(MIT_SLASH, [8]));

    const db = await openDatabase();
    const records = await db.getAll('proofs');
    expect(records.map((record) => record.mintUrl)).toEqual([OHNE_SLASH]);
  });

  it('reserviert ueber beide Schreibweisen hinweg', async () => {
    await seedProofs([8], MIT_SLASH);
    await seedProofs([4], OHNE_SLASH);
    const wallet = new LocalWallet();

    // 12 Sat liegen da, aber in zwei Schreibweisen. Vor der Normalisierung
    // scheiterte das mit InsufficientFundsError.
    const bundle = await wallet.reserve(12, OHNE_SLASH);

    expect(bundle.amount).toBeGreaterThanOrEqual(12);
    expect(bundle.proofs).toHaveLength(2);
  });

  it('fasst beide Schreibweisen zu einem Export-Token zusammen', async () => {
    await seedProofs([8], MIT_SLASH);
    await seedProofs([4], OHNE_SLASH);

    const exports = await new LocalWallet().exportTokens();

    expect(exports).toHaveLength(1);
    expect(exports[0]).toMatchObject({ mintUrl: OHNE_SLASH, amount: 12 });
  });

  it('haelt verschiedene Mints weiterhin auseinander', async () => {
    await seedProofs([8], 'https://mint-a.example');
    await seedProofs([4], 'https://mint-b.example');

    const exports = await new LocalWallet().exportTokens();

    expect(exports).toHaveLength(2);
  });
});
