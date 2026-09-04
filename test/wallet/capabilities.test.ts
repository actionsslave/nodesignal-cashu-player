import { describe, expect, it } from 'vitest';
import {
  assertCanLockP2PK,
  MintCapabilityError,
  type MintCapabilities,
} from '../../src/wallet/mint-gateway.js';

const MINT = 'https://mint-a.example';

/** Nur das eine Stück der MintInfo, das die Prüfung braucht. */
function info(supported: Record<number, boolean>): MintCapabilities {
  return { isSupported: (nut: number) => ({ supported: supported[nut] ?? false }) };
}

describe('NIP-61: P2PK-Lock nur bei Mints, die NUT-11 durchsetzen', () => {
  it('laesst einen Mint mit NUT-11 durch', () => {
    expect(() => assertCanLockP2PK(MINT, info({ 11: true }))).not.toThrow();
  });

  it('bricht ab, wenn der Mint NUT-11 nicht unterstuetzt', () => {
    expect(() => assertCanLockP2PK(MINT, info({ 11: false }))).toThrow(MintCapabilityError);
  });

  it('nennt Mint und fehlende Faehigkeit im Fehler', () => {
    const error = (() => {
      try {
        assertCanLockP2PK(MINT, info({ 11: false }));
        return undefined;
      } catch (cause) {
        return cause as MintCapabilityError;
      }
    })();

    expect(error?.reason).toBe('nut11-fehlt');
    expect(error?.mintUrl).toBe(MINT);
    expect(error?.message).toContain(MINT);
    expect(error?.message).toContain('NUT-11');
  });

  it('verlangt NUT-12 nicht — DLEQ betrifft die Pruefung beim Empfaenger', () => {
    // NIP-61 empfiehlt NUT-12, aber die Verifikation ist Sache des Empfaengers.
    // Ein Mint ohne DLEQ kostet keinen Verlust, ein Mint ohne P2PK schon.
    expect(() => assertCanLockP2PK(MINT, info({ 11: true, 12: false }))).not.toThrow();
  });

  it('behandelt eine fehlende Angabe wie fehlende Unterstuetzung', () => {
    // Wer NUT-11 nicht meldet, setzt es womoeglich nicht durch. Im Zweifel
    // nicht locken — ein Nutzap ohne durchgesetztes P2PK ist fuer jeden ausgebbar.
    expect(() => assertCanLockP2PK(MINT, info({}))).toThrow(MintCapabilityError);
  });
});
