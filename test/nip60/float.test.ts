import { describe, expect, it } from 'vitest';
import {
  FloatAmountError,
  assertFloatAmount,
  planFloatTake,
  planFloatReturn,
  remainingFloat,
} from '../../src/nip60/float.js';
import type { TokenEventContent } from '../../src/nip60/wallet-event.js';

const MINT = 'https://mint-a.example';

function event(id: string, ...amounts: number[]): { id: string; content: TokenEventContent } {
  return {
    id,
    content: {
      mint: MINT,
      unit: 'sat',
      del: [],
      proofs: amounts.map((amount, i) => ({
        id: '00ad268c4d1f5826',
        amount,
        secret: `${id}-${i}`,
        C: '02aa',
      })),
    },
  };
}

describe('SFR-18: Float-Betrag prüfen', () => {
  it('nimmt den Vorgabewert an', () => {
    expect(() => assertFloatAmount(500)).not.toThrow();
  });

  it('weist Beträge außerhalb der Grenzen ab', () => {
    expect(() => assertFloatAmount(50)).toThrow(FloatAmountError);
    expect(() => assertFloatAmount(20_000)).toThrow(FloatAmountError);
  });

  it('weist Kommazahlen ab — Sat sind ganzzahlig', () => {
    expect(() => assertFloatAmount(500.5)).toThrow(FloatAmountError);
  });

  it('nennt die Grenzen im Fehlertext', () => {
    const error = (() => {
      try {
        assertFloatAmount(1);
        return undefined;
      } catch (cause) {
        return cause as FloatAmountError;
      }
    })();
    expect(error?.message).toContain('100');
    expect(error?.message).toContain('10.000');
  });
});

describe('SFR-16: Float-Entnahme planen', () => {
  it('wählt Events, bis der Betrag gedeckt ist', () => {
    const plan = planFloatTake([event('e1', 8, 2), event('e2', 500)], 500, MINT);

    expect(plan?.consumedEventIds).toEqual(['e2']);
    expect(plan?.available).toBe(500);
  });

  it('nimmt mehrere Events, wenn eines nicht reicht', () => {
    const plan = planFloatTake([event('e1', 300), event('e2', 300)], 500, MINT);

    expect(plan?.consumedEventIds).toEqual(['e1', 'e2']);
    expect(plan?.available).toBe(600);
    // Das Wechselgeld geht als neues kind:7375 zurueck.
    expect(plan?.change).toBe(100);
  });

  it('liefert nichts, wenn das Guthaben beim Mint nicht reicht', () => {
    expect(planFloatTake([event('e1', 100)], 500, MINT)).toBeUndefined();
  });

  it('ignoriert Events anderer Mints — ein Bündel trägt genau einen Mint', () => {
    const fremd = { id: 'e9', content: { ...event('e9', 900).content, mint: 'https://andere.example' } };
    expect(planFloatTake([fremd], 500, MINT)).toBeUndefined();
  });

  it('führt Schreibweisen desselben Mints zusammen', () => {
    const mitSlash = { id: 'e1', content: { ...event('e1', 500).content, mint: `${MINT}/` } };
    expect(planFloatTake([mitSlash], 500, MINT)?.consumedEventIds).toEqual(['e1']);
  });

  it('ignoriert Events in fremder Einheit', () => {
    const usd = { id: 'e9', content: { ...event('e9', 900).content, unit: 'usd' } };
    expect(planFloatTake([usd], 500, MINT)).toBeUndefined();
  });
});

describe('SFR-17: Float-Rückgabe', () => {
  it('gibt den ungenutzten Rest zurück', () => {
    expect(planFloatReturn({ amount: 500, spent: 30 })).toMatchObject({ amount: 470 });
  });

  it('gibt nichts zurück, wenn der Float aufgebraucht ist', () => {
    expect(planFloatReturn({ amount: 500, spent: 500 })).toBeUndefined();
  });

  it('ist idempotent: ein bereits zurückgegebener Float ergibt nichts', () => {
    expect(planFloatReturn({ amount: 0, spent: 0 })).toBeUndefined();
  });

  it('behandelt Überziehung als aufgebraucht, nicht als negative Rückgabe', () => {
    expect(planFloatReturn({ amount: 500, spent: 600 })).toBeUndefined();
  });
});

describe('SFR-20: verbleibender Float', () => {
  it('ist Entnahme minus Ausgegebenes', () => {
    expect(remainingFloat({ amount: 500, spent: 30 })).toBe(470);
  });

  it('wird nie negativ', () => {
    expect(remainingFloat({ amount: 500, spent: 600 })).toBe(0);
  });
});
