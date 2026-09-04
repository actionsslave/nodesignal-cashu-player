import { describe, expect, it } from 'vitest';
import { evaluateSources, type SourceInput } from '../../src/payments/source.js';

const MINT_A = 'https://mint-a.example';
const MINT_B = 'https://mint-b.example';

const basis: SourceInput = {
  loggedIn: true,
  hasNip44: true,
  walletEvent: { privkey: 'aa', mints: [MINT_A] },
  nip60BalanceByMint: { [MINT_A]: 2000 },
  localBalanceByMint: { [MINT_A]: 300 },
  allowedMints: [MINT_A, MINT_B],
  recipientMints: [MINT_A],
};

describe('SFR-28: beide Quellen gleichrangig', () => {
  it('meldet beide als verfügbar, wenn alles zusammenpasst', () => {
    const { nip60, local } = evaluateSources(basis);
    expect(nip60).toMatchObject({ available: true, balance: 2000 });
    expect(local).toMatchObject({ available: true, balance: 300 });
  });

  it('SFR-30: bildet die Schnittmenge je Quelle getrennt', () => {
    // Die lokale Wallet kennt kein kind:17375 — ihre Schnittmenge ist weiter.
    const { nip60, local } = evaluateSources({
      ...basis,
      walletEvent: { privkey: 'aa', mints: [MINT_B] },
      recipientMints: [MINT_A, MINT_B],
      nip60BalanceByMint: { [MINT_B]: 500 },
    });

    expect(nip60.mints).toEqual([MINT_B]);
    expect(local.mints).toEqual([MINT_A, MINT_B]);
  });
});

describe('SFR-29: jede Quelle nennt ihren eigenen Grund', () => {
  it('nennt die fehlende nip44-Unterstützung', () => {
    const { nip60, local } = evaluateSources({ ...basis, hasNip44: false });
    expect(nip60).toMatchObject({ available: false, reason: 'kein-nip44' });
    // SFR-11: die lokale Wallet bleibt davon unberührt.
    expect(local.available).toBe(true);
  });

  it('nennt das fehlende kind:17375', () => {
    const { nip60 } = evaluateSources({ ...basis, walletEvent: undefined });
    expect(nip60).toMatchObject({ available: false, reason: 'keine-wallet' });
  });

  it('nennt die leere Mint-Schnittmenge je Quelle', () => {
    const { nip60, local } = evaluateSources({ ...basis, recipientMints: ['https://fremd.example'] });
    expect(nip60.reason).toBe('keine-mint-schnittmenge');
    expect(local.reason).toBe('keine-mint-schnittmenge');
  });

  it('nennt fehlendes Guthaben', () => {
    const { nip60, local } = evaluateSources({
      ...basis,
      nip60BalanceByMint: {},
      localBalanceByMint: {},
    });
    expect(nip60.reason).toBe('kein-guthaben');
    expect(local.reason).toBe('kein-guthaben');
  });

  it('SFR-12: ohne Login ist keine Quelle verfügbar', () => {
    const { nip60, local } = evaluateSources({ ...basis, loggedIn: false });
    expect(nip60).toMatchObject({ available: false, reason: 'nicht-angemeldet' });
    expect(local).toMatchObject({ available: false, reason: 'nicht-angemeldet' });
  });

  it('zählt nur Guthaben bei Mints der Schnittmenge', () => {
    // 2000 Sat liegen bei einem Mint, den der Empfänger nicht nimmt.
    const { nip60 } = evaluateSources({
      ...basis,
      nip60BalanceByMint: { 'https://fremd.example': 2000 },
    });
    expect(nip60).toMatchObject({ available: false, reason: 'kein-guthaben', balance: 0 });
  });
});

describe('SFR-29: Vorauswahl', () => {
  it('SOQ-04: wählt NIP-60 vor, wenn beide verfügbar sind', () => {
    expect(evaluateSources(basis).preferred).toBe('nip60');
  });

  it('wählt die einzige verfügbare Quelle vor', () => {
    expect(evaluateSources({ ...basis, hasNip44: false }).preferred).toBe('local');
  });

  it('wählt nichts vor, wenn keine Quelle geht', () => {
    expect(evaluateSources({ ...basis, loggedIn: false }).preferred).toBeUndefined();
  });
});
