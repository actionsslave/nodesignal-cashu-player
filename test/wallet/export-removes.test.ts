/**
 * SFR-25: Ein exportierter Token verlässt den Player endgültig.
 *
 * Der Fehler, den das hier festhält: Der Export kodierte die Proofs nur und
 * liess sie liegen. Wer den Token anderswo einlöste, sah hier weiter ein
 * Guthaben, das es nicht mehr gab — und eine Zahlung daraus wäre beim Mint
 * als „bereits ausgegeben" gescheitert.
 *
 * Weggenommen wird erst, wenn der Nutzer den Token in der Hand hat. Wer den
 * Dialog schliesst, ohne zu kopieren, behält sein Guthaben.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalWallet } from '../../src/wallet/local-wallet.js';
import { resetDatabase } from '../helpers/db.js';
import { makeProof } from '../helpers/proofs.js';

const MINT = 'https://mint.macadamia.cash';

async function walletMit(...betraege: number[]) {
  const wallet = new LocalWallet();
  await wallet.addProofs(
    MINT,
    betraege.map((b) => makeProof(b, MINT).proof),
  );
  return wallet;
}

describe('SFR-25: Export nimmt das Guthaben mit', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('zählt die angebotenen Proofs nicht mehr zum Guthaben', async () => {
    const wallet = await walletMit(32, 8);
    const angebot = await wallet.beginExport();

    expect(angebot?.amount).toBe(40);
    await expect(wallet.balance()).resolves.toBe(0);
  });

  it('nimmt sie endgültig weg, wenn der Nutzer den Token hat', async () => {
    const wallet = await walletMit(40);
    const angebot = await wallet.beginExport();
    await wallet.completeExport(angebot!);

    await expect(wallet.balance()).resolves.toBe(0);
    await expect(wallet.exportTokens()).resolves.toEqual([]);
  });

  it('gibt sie zurück, wenn der Dialog ohne Kopieren geschlossen wird', async () => {
    const wallet = await walletMit(40);
    const angebot = await wallet.beginExport();
    await wallet.cancelExport(angebot!);

    await expect(wallet.balance()).resolves.toBe(40);
  });

  it('bietet nichts an, wenn nichts da ist', async () => {
    const wallet = new LocalWallet();
    await expect(wallet.beginExport()).resolves.toBeUndefined();
  });

  it('rührt den Float der nostr-Wallet nicht an', async () => {
    const lokal = await walletMit(40);
    const float = new LocalWallet({ source: 'nip60' });
    await float.addProofs(MINT, [makeProof(500, MINT).proof]);

    const angebot = await lokal.beginExport();
    await lokal.completeExport(angebot!);

    await expect(float.balance()).resolves.toBe(500);
  });
});
