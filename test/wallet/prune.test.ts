/**
 * NUT-07: Beim Laden prüfen, was der Mint schon als ausgegeben kennt.
 *
 * Anlass war ein echter Fall: Ein Token wurde exportiert und anderswo
 * eingelöst, das Guthaben stand hier weiter. Ein Bestand, den die App nicht
 * mehr ausgeben kann, darf nicht als Guthaben dastehen — jede Zahlung daraus
 * scheiterte beim Mint, und der Nutzer erführe den Grund erst dann.
 *
 * Geprüft wird je Proof, nicht je Bündel: Sonst risse ein einzelner
 * ausgegebener Proof unverbrauchte mit sich.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalWallet } from '../../src/wallet/local-wallet.js';
import { resetDatabase } from '../helpers/db.js';
import { makeProof } from '../helpers/proofs.js';
import { fakeGateway } from '../helpers/mint.js';

const MINT = 'https://mint.macadamia.cash';

describe('pruneSpentProofs', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('entfernt genau die Proofs, die der Mint als ausgegeben kennt', async () => {
    const ausgegeben = makeProof(32, MINT).proof;
    const gut = makeProof(8, MINT).proof;
    const gateway = fakeGateway({ spentSecrets: [String(ausgegeben.secret)] });
    const wallet = new LocalWallet({ gateway });
    await wallet.addProofs(MINT, [ausgegeben, gut]);

    const entfernt = await wallet.pruneSpentProofs();

    expect(entfernt).toBe(32);
    await expect(wallet.balance()).resolves.toBe(8);
  });

  it('lässt alles liegen, wenn nichts ausgegeben ist', async () => {
    const wallet = new LocalWallet({ gateway: fakeGateway() });
    await wallet.addProofs(MINT, [makeProof(40, MINT).proof]);

    await expect(wallet.pruneSpentProofs()).resolves.toBe(0);
    await expect(wallet.balance()).resolves.toBe(40);
  });

  it('lässt alles liegen, wenn der Mint nicht erreichbar ist', async () => {
    // Nicht erreichbar heisst nicht „ausgegeben". Im Zweifel bleibt das
    // Guthaben stehen — Loeschen waere die teurere Fehlannahme.
    const wallet = new LocalWallet({ gateway: fakeGateway({ unreachable: true }) });
    await wallet.addProofs(MINT, [makeProof(40, MINT).proof]);

    await expect(wallet.pruneSpentProofs()).resolves.toBe(0);
    await expect(wallet.balance()).resolves.toBe(40);
  });

  it('rührt reservierte Proofs nicht an — sie stecken in einer Zahlung', async () => {
    const proof = makeProof(40, MINT).proof;
    const wallet = new LocalWallet({ gateway: fakeGateway({ spentSecrets: [String(proof.secret)] }) });
    await wallet.addProofs(MINT, [proof]);
    await wallet.reserve(40, MINT);

    await expect(wallet.pruneSpentProofs()).resolves.toBe(0);
  });

  it('prüft nur die eigene Quelle', async () => {
    const floatProof = makeProof(500, MINT).proof;
    const float = new LocalWallet({
      gateway: fakeGateway({ spentSecrets: [String(floatProof.secret)] }),
      source: 'nip60',
    });
    const lokal = new LocalWallet({
      gateway: fakeGateway({ spentSecrets: [String(floatProof.secret)] }),
    });
    await float.addProofs(MINT, [floatProof]);
    await lokal.addProofs(MINT, [makeProof(8, MINT).proof]);

    await expect(lokal.pruneSpentProofs()).resolves.toBe(0);
    await expect(float.balance()).resolves.toBe(500);
  });
});
