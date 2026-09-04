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
import type { ProofSource } from './local-wallet.js';

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

/**
 * SNR-09: Ohne `source` zaehlt alles zusammen — das waere die Summe beider
 * Quellen und in der Anzeige eine Luege. Die Seite fragt deshalb je Quelle.
 */
export function mintOverview(proofs: ProofRecord[], source?: ProofSource): MintRow[] {
  const byMint = new Map<string, MintRow>();

  for (const record of proofs) {
    // Reservierte Proofs stecken in einer laufenden Zahlung und zaehlen nicht.
    if (record.state !== 'available') continue;
    if (source !== undefined && (record.source ?? 'local') !== source) continue;
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
