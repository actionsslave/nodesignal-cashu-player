import { describe, expect, it } from 'vitest';
import { mintOverview } from '../../src/wallet/mint-overview.js';
import type { ProofRecord } from '../../src/db/database.js';

function proof(mintUrl: string, amount: number, keysetId = '00ad268c4d1f5826'): ProofRecord {
  return {
    secret: `s-${mintUrl}-${amount}-${Math.random()}`,
    mintUrl,
    amount,
    state: 'available',
    proof: { id: keysetId, amount, secret: 'x', C: '02' },
  };
}

describe('Mint-Übersicht für die Wallet-Seite', () => {
  it('fasst das Guthaben je Mint zusammen', () => {
    const zeilen = mintOverview([
      proof('https://mint-a.example', 8),
      proof('https://mint-a.example', 4),
      proof('https://mint-b.example', 10),
    ]);

    expect(zeilen).toEqual([
      { url: 'https://mint-a.example', balance: 12, unit: 'sat', keysetId: '00ad268c4d1f5826' },
      { url: 'https://mint-b.example', balance: 10, unit: 'sat', keysetId: '00ad268c4d1f5826' },
    ]);
  });

  it('führt Schreibweisen desselben Mints zusammen', () => {
    const zeilen = mintOverview([
      proof('https://mint-a.example/', 8),
      proof('https://mint-a.example', 4),
    ]);

    expect(zeilen).toHaveLength(1);
    expect(zeilen[0].balance).toBe(12);
  });

  it('nennt die Keyset-ID des Mints', () => {
    const zeilen = mintOverview([proof('https://mint-a.example', 8, '00abcdef12345678')]);
    expect(zeilen[0].keysetId).toBe('00abcdef12345678');
  });

  it('zählt reservierte Proofs nicht mit — sie stecken in einer Zahlung', () => {
    const reserviert = { ...proof('https://mint-a.example', 100), state: 'reserved' as const };
    const zeilen = mintOverview([proof('https://mint-a.example', 8), reserviert]);

    expect(zeilen[0].balance).toBe(8);
  });

  it('sortiert nach Guthaben, das grösste zuerst', () => {
    const zeilen = mintOverview([
      proof('https://klein.example', 2),
      proof('https://gross.example', 200),
    ]);

    expect(zeilen.map((z) => z.url)).toEqual(['https://gross.example', 'https://klein.example']);
  });

  it('liefert für eine leere Wallet keine Zeilen', () => {
    expect(mintOverview([])).toEqual([]);
  });
});
