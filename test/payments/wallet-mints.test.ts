/**
 * SFR-30: Die Mint-Liste im kind:17375 ist eine Angabe, kein Verbot.
 *
 * Nennt das Wallet-Event keine Mints, hiess das bisher: leere Schnittmenge,
 * Quelle gesperrt. Damit machte eine fehlende Deklaration eine funktionierende
 * Wallet unbrauchbar — obwohl die Proofs in den kind:7375 ihren Mint selbst
 * nennen und der die eigentliche Tatsache ist.
 *
 * Nennt das Event Mints, schneidet es weiter mit. Nur die leere Liste zaehlt
 * als „keine Angabe" statt als „nichts erlaubt".
 */
import { describe, expect, it } from 'vitest';
import { evaluateSources } from '../../src/payments/source.js';

const MINIBITS = 'https://mint.minibits.cash/Bitcoin';
const MACADAMIA = 'https://mint.macadamia.cash';

const basis = {
  loggedIn: true,
  hasNip44: true,
  localBalanceByMint: {},
  allowedMints: [MINIBITS, MACADAMIA],
  recipientMints: [MINIBITS, MACADAMIA],
};

describe('SFR-30: Mints des Wallet-Events', () => {
  it('sperrt nicht, wenn das kind:17375 keine Mints nennt', () => {
    const { nip60 } = evaluateSources({
      ...basis,
      walletEvent: { mints: [] },
      nip60BalanceByMint: { [MINIBITS]: 500 },
    });

    expect(nip60.available).toBe(true);
    expect(nip60.balance).toBe(500);
    expect(nip60.mints).toEqual([MINIBITS, MACADAMIA]);
  });

  it('schneidet weiter mit, wenn das Event Mints nennt', () => {
    const { nip60 } = evaluateSources({
      ...basis,
      walletEvent: { mints: [MACADAMIA] },
      nip60BalanceByMint: { [MINIBITS]: 500 },
    });

    // Der Mint mit dem Guthaben steht nicht in der Wallet-Liste.
    expect(nip60.mints).toEqual([MACADAMIA]);
    expect(nip60.reason).toBe('kein-guthaben');
  });

  it('bleibt gesperrt, wenn wirklich kein gemeinsamer Mint dasteht', () => {
    const { nip60 } = evaluateSources({
      ...basis,
      recipientMints: ['https://fremder-mint.example'],
      walletEvent: { mints: [] },
      nip60BalanceByMint: { [MINIBITS]: 500 },
    });

    expect(nip60.reason).toBe('keine-mint-schnittmenge');
  });
});
