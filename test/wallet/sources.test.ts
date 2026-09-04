/**
 * SNR-09, SNR-07: Die Proofs der beiden Quellen dürfen sich nie mischen.
 *
 * Der Float liegt lokal, aber er gehört zur nostr-Wallet. Ohne Trennung in der
 * Ablage würde ein Nutzap aus der lokalen Wallet Proofs des Floats mitnehmen —
 * und damit Guthaben zwischen den Quellen verschieben, was nur die Entnahme
 * und die Rückgabe dürfen.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalWallet } from '../../src/wallet/local-wallet.js';
import { resetDatabase } from '../helpers/db.js';
import { makeProof } from '../helpers/proofs.js';

const MINT = 'https://mint.macadamia.cash';

describe('Quellentrennung der Proofs', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('zählt zum Guthaben nur die Proofs der eigenen Quelle', async () => {
    const lokal = new LocalWallet();
    const float = new LocalWallet({ source: 'nip60' });

    await lokal.addProofs(MINT, [makeProof(100, MINT).proof]);
    await float.addProofs(MINT, [makeProof(500, MINT).proof]);

    await expect(lokal.balance()).resolves.toBe(100);
    await expect(float.balance()).resolves.toBe(500);
  });

  it('reserviert keine Proofs der anderen Quelle', async () => {
    const lokal = new LocalWallet();
    const float = new LocalWallet({ source: 'nip60' });
    await float.addProofs(MINT, [makeProof(500, MINT).proof]);

    // Die lokale Wallet ist leer; die 500 Sat des Floats sind für sie unsichtbar.
    await expect(lokal.reserve(100)).rejects.toThrow();
  });

  it('exportiert nur das lokale Guthaben, nie den Float', async () => {
    const lokal = new LocalWallet();
    const float = new LocalWallet({ source: 'nip60' });
    await lokal.addProofs(MINT, [makeProof(64, MINT).proof]);
    await float.addProofs(MINT, [makeProof(512, MINT).proof]);

    const tokens = await lokal.exportTokens();
    expect(tokens).toHaveLength(1);
    expect(tokens[0].amount).toBe(64);
  });

  it('behandelt Proofs ohne Quellenangabe als lokal', async () => {
    // Bestand aus einer Fassung vor der Trennung — er gehoert dem Nutzer, nicht
    // dem Float, und darf durch die Migration nicht unsichtbar werden.
    const { openDatabase } = await import('../../src/db/database.js');
    const db = await openDatabase();
    const { secret, proof } = makeProof(21, MINT);
    await db.put('proofs', {
      secret,
      mintUrl: MINT,
      amount: 21,
      state: 'available',
      proof,
    } as never);

    await expect(new LocalWallet().balance()).resolves.toBe(21);
    await expect(new LocalWallet({ source: 'nip60' }).balance()).resolves.toBe(0);
  });
});
