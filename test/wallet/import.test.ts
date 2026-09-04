import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, openDatabase } from '../../src/db/database.js';
import { LocalWallet } from '../../src/wallet/local-wallet.js';
import { TokenImportError } from '../../src/wallet/mint-gateway.js';
import { resetDatabase } from '../helpers/db.js';
import { encodeToken, fakeGateway, freshProofs } from '../helpers/mint.js';

const ERLAUBT = 'https://mint-a.example';
const NICHT_ERLAUBT = 'https://fremder-mint.example';

function makeWallet(gateway = fakeGateway()) {
  return new LocalWallet({ gateway, allowedMints: [ERLAUBT] });
}

beforeEach(async () => {
  await resetDatabase();
});

afterEach(async () => {
  await closeDatabase();
});

describe('FR-17: Wallet per Token aufladen', () => {
  it('US-04-AC-1: erhöht das Guthaben um den Token-Betrag', async () => {
    const wallet = makeWallet(fakeGateway({ received: freshProofs(ERLAUBT, [8, 2]) }));
    await wallet.importToken(encodeToken(ERLAUBT, [10]));
    await expect(wallet.balance()).resolves.toBe(10);
  });

  it('US-04-AC-1: schreibt einen Eingang mit Zeitstempel in den Verlauf', async () => {
    const wallet = makeWallet(fakeGateway({ received: freshProofs(ERLAUBT, [10]) }));
    const before = Date.now();
    await wallet.importToken(encodeToken(ERLAUBT, [10]));

    const db = await openDatabase();
    const entries = await db.getAll('history');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ direction: 'in', amount: 10, kind: 'import' });
    expect(entries[0].at).toBeGreaterThanOrEqual(before);
  });

  it('US-04-AC-4: lehnt einen nicht erlaubten Mint ab und nennt ihn', async () => {
    const wallet = makeWallet();
    const error = await wallet.importToken(encodeToken(NICHT_ERLAUBT, [10])).catch((e) => e);
    expect(error).toBeInstanceOf(TokenImportError);
    expect(error.reason).toBe('mint-nicht-erlaubt');
    expect(error.message).toContain(NICHT_ERLAUBT);
  });

  it('US-04-AC-4: ein abgelehnter Import verändert das Guthaben nicht', async () => {
    const wallet = makeWallet();
    await wallet.importToken(encodeToken(NICHT_ERLAUBT, [10])).catch(() => undefined);
    await expect(wallet.balance()).resolves.toBe(0);
  });

  it('lehnt einen ungültigen Token mit konkretem Fehlertext ab', async () => {
    const wallet = makeWallet();
    await expect(wallet.importToken('kein-cashu-token')).rejects.toMatchObject({
      reason: 'ungueltig',
    });
  });

  it('lehnt einen bereits eingelösten Token ab', async () => {
    const wallet = makeWallet(fakeGateway({ spent: true }));
    await expect(wallet.importToken(encodeToken(ERLAUBT, [10]))).rejects.toMatchObject({
      reason: 'bereits-eingeloest',
    });
  });

  it('US-04-AC-5: meldet eine fehlende Mint-Verbindung als eigenen Grund', async () => {
    const wallet = makeWallet(fakeGateway({ unreachable: true }));
    const error = await wallet.importToken(encodeToken(ERLAUBT, [10])).catch((e) => e);
    expect(error.reason).toBe('mint-nicht-erreichbar');
    expect(error.message).toMatch(/Mint/i);
  });

  it('lehnt einen Token in einer anderen Einheit ab und nennt sie', async () => {
    // testnut.cashu.space fuehrt sat, msat, usd und eur. Ohne Pruefung landete
    // ein usd-Token als "Sat" im Guthaben und der Export etikettierte ihn falsch.
    const wallet = makeWallet();
    const error = await wallet.importToken(encodeToken(ERLAUBT, [20], 'usd')).catch((e) => e);

    expect(error).toBeInstanceOf(TokenImportError);
    expect(error.reason).toBe('einheit-nicht-unterstuetzt');
    expect(error.message).toContain('usd');
    expect(error.message).toContain('sat');
  });

  it('ein Token in fremder Einheit veraendert das Guthaben nicht', async () => {
    const wallet = makeWallet(fakeGateway({ received: freshProofs(ERLAUBT, [20]) }));
    await wallet.importToken(encodeToken(ERLAUBT, [20], 'usd')).catch(() => undefined);
    await expect(wallet.balance()).resolves.toBe(0);
  });

  it('prueft die Einheit, bevor der Mint ueberhaupt gefragt wird', async () => {
    // Ein nicht erreichbarer Mint darf den Einheiten-Grund nicht verdecken.
    const wallet = makeWallet(fakeGateway({ unreachable: true }));
    await expect(wallet.importToken(encodeToken(ERLAUBT, [20], 'eur'))).rejects.toMatchObject({
      reason: 'einheit-nicht-unterstuetzt',
    });
  });

  it('nimmt msat nicht als sat durch', async () => {
    const wallet = makeWallet();
    await expect(wallet.importToken(encodeToken(ERLAUBT, [20], 'msat'))).rejects.toMatchObject({
      reason: 'einheit-nicht-unterstuetzt',
    });
  });

  it('NR-07: vergleicht Mint-URLs normalisiert, nicht zeichengenau', async () => {
    const wallet = new LocalWallet({
      gateway: fakeGateway({ received: freshProofs(ERLAUBT, [10]) }),
      allowedMints: ['https://Mint-A.example/'],
    });
    await expect(wallet.importToken(encodeToken(ERLAUBT, [10]))).resolves.toMatchObject({
      amount: 10,
    });
  });
});
