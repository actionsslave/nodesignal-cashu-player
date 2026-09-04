import { getTokenMetadata } from '@cashu/cashu-ts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase } from '../../src/db/database.js';
import { LocalWallet } from '../../src/wallet/local-wallet.js';
import { resetDatabase } from '../helpers/db.js';
import { MINT_A, MINT_B, seedProofs } from '../helpers/proofs.js';

let wallet: LocalWallet;

beforeEach(async () => {
  await resetDatabase();
  wallet = new LocalWallet();
});

afterEach(async () => {
  await closeDatabase();
});

describe('FR-16: Wallet exportieren', () => {
  it('US-04-AC-3: liefert einen Cashu-Token über das gesamte Guthaben', async () => {
    await seedProofs([256, 128, 64, 32, 16, 4]);
    const token = await wallet.exportAll();
    const metadata = getTokenMetadata(token);
    expect(metadata.amount.toNumber()).toBe(500);
    expect(metadata.mint).toBe(MINT_A);
  });

  it('lässt das Guthaben nach dem Export unverändert — der Export ist eine Sicherung', async () => {
    await seedProofs([500]);
    await wallet.exportAll();
    await expect(wallet.balance()).resolves.toBe(500);
  });

  it('nimmt reservierte Proofs nicht in den Export auf', async () => {
    await seedProofs([100, 400]);
    await wallet.reserve(100);
    const token = await wallet.exportAll();
    expect(getTokenMetadata(token).amount.toNumber()).toBe(400);
  });

  it('liefert je Mint einen eigenen Token', async () => {
    await seedProofs([100], MINT_A);
    await seedProofs([21], MINT_B);
    const exports = await wallet.exportTokens();
    expect(exports).toHaveLength(2);
    expect(exports.map((e) => e.amount).sort((a, b) => a - b)).toEqual([21, 100]);
    expect(exports.map((e) => e.mintUrl).sort()).toEqual([MINT_A, MINT_B].sort());
  });

  it('ist bei leerer Wallet ein leerer String', async () => {
    await expect(wallet.exportAll()).resolves.toBe('');
    await expect(wallet.exportTokens()).resolves.toEqual([]);
  });
});
