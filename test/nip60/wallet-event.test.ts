import { describe, expect, it } from 'vitest';
import { parseWalletEvent, parseTokenEvent, balanceByMint } from '../../src/nip60/wallet-event.js';

const MINT_A = 'https://mint-a.example';
const MINT_B = 'https://mint-b.example';

describe('SFR-13: kind:17375 auswerten', () => {
  it('liest Mint-Liste und Wallet-Privkey aus dem entschlüsselten Inhalt', () => {
    const klartext = JSON.stringify([
      ['privkey', 'aa'.repeat(32)],
      ['mint', MINT_A],
      ['mint', MINT_B],
    ]);

    expect(parseWalletEvent(klartext)).toEqual({
      privkey: 'aa'.repeat(32),
      mints: [MINT_A, MINT_B],
    });
  });

  /*
   * Der Privkey aus NIP-60 entsperrt P2PK-Ecash — er wird beim *Empfangen* von
   * Nutzaps gebraucht. Dieser Player empfaengt keine (SNR-04); er gibt die
   * gewoehnlichen Proofs aus den kind:7375 aus, und dafuer braucht es ihn
   * nicht. Ihn zu verlangen hiesse, eine funktionierende Wallet fuer
   * nichtexistent zu erklaeren.
   */
  it('liest eine Wallet auch ohne Privkey — zum Ausgeben wird er nicht gebraucht', () => {
    expect(parseWalletEvent(JSON.stringify([['mint', MINT_A]]))).toEqual({
      privkey: undefined,
      mints: [MINT_A],
    });
  });

  it('liefert nichts, wenn der Inhalt kein Tag-Array ist', () => {
    expect(parseWalletEvent(JSON.stringify({ mint: MINT_A }))).toBeUndefined();
  });

  it('liefert nichts bei unlesbarem Inhalt', () => {
    expect(parseWalletEvent('kein json')).toBeUndefined();
  });

  it('kommt mit einer Wallet ohne Mints zurecht', () => {
    const parsed = parseWalletEvent(JSON.stringify([['privkey', 'bb'.repeat(32)]]));
    expect(parsed).toEqual({ privkey: 'bb'.repeat(32), mints: [] });
  });
});

describe('SFR-14: kind:7375 auswerten', () => {
  const proofs = [
    { id: '00ad268c4d1f5826', amount: 8, secret: 's1', C: '02aa' },
    { id: '00ad268c4d1f5826', amount: 2, secret: 's2', C: '02bb' },
  ];

  it('liest Mint, Einheit und Proofs', () => {
    const klartext = JSON.stringify({ mint: MINT_A, unit: 'sat', proofs });
    expect(parseTokenEvent(klartext)).toEqual({ mint: MINT_A, unit: 'sat', proofs, del: [] });
  });

  it('liest das del-Feld, das ersetzte Events benennt', () => {
    const klartext = JSON.stringify({ mint: MINT_A, proofs, del: ['event-1', 'event-2'] });
    expect(parseTokenEvent(klartext)?.del).toEqual(['event-1', 'event-2']);
  });

  it('nimmt sat an, wenn die Einheit fehlt', () => {
    const klartext = JSON.stringify({ mint: MINT_A, proofs });
    expect(parseTokenEvent(klartext)?.unit).toBe('sat');
  });

  it('liefert nichts ohne Mint oder ohne Proofs', () => {
    expect(parseTokenEvent(JSON.stringify({ proofs }))).toBeUndefined();
    expect(parseTokenEvent(JSON.stringify({ mint: MINT_A }))).toBeUndefined();
  });
});

describe('SFR-14: Guthaben je Mint', () => {
  const token = (mint: string, ...amounts: number[]) => ({
    mint,
    unit: 'sat',
    del: [],
    proofs: amounts.map((amount, i) => ({
      id: '00ad268c4d1f5826',
      amount,
      secret: `${mint}-${i}-${amount}`,
      C: '02aa',
    })),
  });

  it('summiert die Proofs je Mint', () => {
    expect(balanceByMint([token(MINT_A, 8, 2), token(MINT_B, 5)])).toEqual({
      [MINT_A]: 10,
      [MINT_B]: 5,
    });
  });

  it('führt Schreibweisen desselben Mints zusammen', () => {
    expect(balanceByMint([token('https://mint-a.example/', 8), token(MINT_A, 2)])).toEqual({
      [MINT_A]: 10,
    });
  });

  it('zählt nur die eigene Einheit', () => {
    const usd = { ...token(MINT_A, 100), unit: 'usd' };
    expect(balanceByMint([token(MINT_A, 8), usd])).toEqual({ [MINT_A]: 8 });
  });

  it('liefert für eine leere Wallet ein leeres Ergebnis', () => {
    expect(balanceByMint([])).toEqual({});
  });
});
