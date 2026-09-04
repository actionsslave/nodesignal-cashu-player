/**
 * SFR-21, SFR-32: Was der Verlauf über eine Zeile sagt.
 *
 * Sechs Arten, und nur diese. Die Quelle steht dabei — ohne sie liesse sich
 * einer Zahlung nicht ansehen, ob sie den Float oder die lokale Wallet
 * belastet hat, und genau das ist die Frage, die der Verlauf beantworten soll.
 */
import { describe, expect, it } from 'vitest';
import { artLabel, matchesFilter, sourceLabel, statusLabel } from '../../src/ui/history-view.js';
import type { HistoryRecord } from '../../src/db/database.js';

const eintrag = (over: Partial<HistoryRecord>): HistoryRecord => ({
  id: 'x',
  direction: 'out',
  amount: 10,
  at: 0,
  status: 'gesendet',
  kind: 'streaming',
  ...over,
});

describe('Verlauf', () => {
  it('kennt genau die sechs Arten des Entwurfs', () => {
    expect(artLabel(eintrag({ kind: 'streaming' }))).toBe('Streaming');
    expect(artLabel(eintrag({ kind: 'boost' }))).toBe('Boost');
    expect(artLabel(eintrag({ kind: 'float_out' }))).toBe('Float-Entnahme');
    expect(artLabel(eintrag({ kind: 'float_in' }))).toBe('Float-Rückgabe');
    expect(artLabel(eintrag({ kind: 'import' }))).toBe('Aufgeladen');
    expect(artLabel(eintrag({ kind: 'export' }))).toBe('Exportiert');
  });

  it('nennt bei einer aus dem Float finanzierten Zahlung beides', () => {
    expect(sourceLabel(eintrag({ kind: 'boost', source: 'nip60' }))).toBe('nostr-Wallet · Float');
  });

  it('nennt bei den Float-Vorgängen selbst nur die Wallet', () => {
    expect(sourceLabel(eintrag({ kind: 'float_out', source: 'nip60' }))).toBe('nostr-Wallet');
    expect(sourceLabel(eintrag({ kind: 'float_in', source: 'nip60' }))).toBe('nostr-Wallet');
  });

  it('nennt die lokale Wallet als solche', () => {
    expect(sourceLabel(eintrag({ kind: 'boost', source: 'local' }))).toBe('Lokale Wallet');
  });

  it('nennt bei Float-Vorgängen die geschriebenen Events statt eines Status', () => {
    expect(statusLabel(eintrag({ kind: 'float_out' }))).toBe('kind:7375 · kind:5');
    expect(statusLabel(eintrag({ kind: 'float_in' }))).toBe('kind:7375');
    expect(statusLabel(eintrag({ kind: 'boost' }))).toBe('Gesendet');
  });

  it('fasst die vier Float- und Wallet-Arten unter ihren Filtern zusammen', () => {
    expect(matchesFilter(eintrag({ kind: 'float_out' }), 'float')).toBe(true);
    expect(matchesFilter(eintrag({ kind: 'float_in' }), 'float')).toBe(true);
    expect(matchesFilter(eintrag({ kind: 'import' }), 'wallet')).toBe(true);
    expect(matchesFilter(eintrag({ kind: 'export' }), 'wallet')).toBe(true);
    expect(matchesFilter(eintrag({ kind: 'boost' }), 'float')).toBe(false);
    expect(matchesFilter(eintrag({ kind: 'boost' }), 'alle')).toBe(true);
  });
});
