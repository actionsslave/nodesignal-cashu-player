/**
 * Die Mint-Tabelle der Wallet-Seite (Entwurf 4a).
 *
 * Alles hier ist aus den gespeicherten Proofs abgeleitet: Guthaben je Mint,
 * Einheit und Keyset. Erreichbarkeit steht nicht darin — sie verlangt einen
 * Netzabruf und wird von der Ansicht nachgereicht.
 */
import { normalizeMintUrl } from '@cashu/cashu-ts';
import { WALLET_UNIT } from '../config/build-config.js';
import type { ProofRecord } from '../db/database.js';

export interface MintRow {
  url: string;
  balance: number;
  unit: string;
  keysetId: string;
}

function canonical(url: string): string {
  try {
    return normalizeMintUrl(url);
  } catch {
    return url;
  }
}

export function mintOverview(proofs: ProofRecord[]): MintRow[] {
  const byMint = new Map<string, MintRow>();

  for (const record of proofs) {
    // Reservierte Proofs stecken in einer laufenden Zahlung und zaehlen nicht.
    if (record.state !== 'available') continue;
    const url = canonical(record.mintUrl);
    const row = byMint.get(url);
    if (row) {
      row.balance += record.amount;
    } else {
      byMint.set(url, {
        url,
        balance: record.amount,
        unit: WALLET_UNIT,
        keysetId: String(record.proof.id),
      });
    }
  }

  return [...byMint.values()].sort((a, b) => b.balance - a.balance);
}
