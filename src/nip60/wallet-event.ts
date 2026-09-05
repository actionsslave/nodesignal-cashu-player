/**
 * NIP-60: die beiden Event-Arten, aus denen die Wallet des Nutzers besteht.
 *
 * `kind:17375` ist das replaceable Wallet-Event; sein Inhalt ist nip44-
 * verschlüsselt und enthält den Wallet-Privkey und die Mint-Liste. Der Privkey
 * ist ein eigener Cashu-P2PK-Schlüssel, getrennt von der nostr-Identität.
 * `kind:7375` hält die unverbrauchten Proofs, ebenfalls verschlüsselt.
 *
 * Hier steht nur das Auswerten des bereits entschlüsselten Klartexts. Das
 * Entschlüsseln läuft über die Extension (SFR-10), das Lesen von den Relays
 * über den NostrGateway — beides bleibt draußen, damit diese Auswertung ohne
 * Netz und ohne Extension prüfbar ist.
 */
import { normalizeMintUrl } from '@cashu/cashu-ts';
import { WALLET_UNIT } from '../config/build-config.js';
import type { StoredProof } from '../contracts/index.js';

export const WALLET_KIND = 17375;
export const TOKEN_KIND = 7375;
export const HISTORY_KIND = 7376;

export interface WalletDescriptor {
  /**
   * SNR-03: verlässt den Speicher der Seite nicht.
   *
   * Optional, weil er nur zum *Empfangen* von Nutzaps gebraucht wird: Er
   * entsperrt P2PK-Ecash. Dieser Player empfängt keine (SNR-04) und gibt die
   * gewöhnlichen Proofs aus den kind:7375 aus. Eine Wallet ohne ihn ist für
   * uns voll benutzbar.
   */
  privkey?: string;
  mints: string[];
}

export interface TokenEventContent {
  mint: string;
  unit: string;
  proofs: StoredProof[];
  /** Event-IDs, die dieses Event ersetzt (NIP-60 `del`). */
  del: string[];
}

function canonical(url: string): string {
  try {
    return normalizeMintUrl(url);
  } catch {
    return url;
  }
}

/**
 * SFR-13: Der Inhalt ist eine Liste von Tags, wie im Event selbst —
 * `[["privkey", "…"], ["mint", "https://…"], …]`.
 *
 * Der Privkey ist optional — siehe WalletDescriptor. Nichts liefert die
 * Funktion nur, wenn der Inhalt gar kein Tag-Array ist.
 */
export function parseWalletEvent(plaintext: string): WalletDescriptor | undefined {
  let tags: unknown;
  try {
    tags = JSON.parse(plaintext);
  } catch {
    return undefined;
  }
  if (!Array.isArray(tags)) return undefined;

  const werte = (name: string): string[] =>
    tags
      .filter((tag): tag is string[] => Array.isArray(tag) && tag[0] === name && Boolean(tag[1]))
      .map((tag) => tag[1]);

  return { privkey: werte('privkey')[0], mints: werte('mint') };
}

/** SFR-14: Der Inhalt eines kind:7375 ist ein Objekt, kein Tag-Array. */
export function parseTokenEvent(plaintext: string): TokenEventContent | undefined {
  let content: unknown;
  try {
    content = JSON.parse(plaintext);
  } catch {
    return undefined;
  }
  if (typeof content !== 'object' || content === null) return undefined;

  const { mint, unit, proofs, del } = content as Record<string, unknown>;
  if (typeof mint !== 'string' || mint === '') return undefined;
  if (!Array.isArray(proofs) || proofs.length === 0) return undefined;

  return {
    mint,
    // NIP-60 nennt `unit`; fehlt es, gilt sat wie überall in Cashu.
    unit: typeof unit === 'string' && unit !== '' ? unit : 'sat',
    proofs: proofs as StoredProof[],
    del: Array.isArray(del) ? del.filter((id): id is string => typeof id === 'string') : [],
  };
}

/**
 * SFR-14, SFR-20: Guthaben je Mint. Schreibweisen desselben Mints werden
 * zusammengeführt, fremde Einheiten bleiben draußen — die App führt nur eine.
 */
export function balanceByMint(events: TokenEventContent[]): Record<string, number> {
  const byMint: Record<string, number> = {};
  for (const event of events) {
    if (event.unit !== WALLET_UNIT) continue;
    const key = canonical(event.mint);
    const summe = event.proofs.reduce((total, proof) => total + Number(proof.amount), 0);
    byMint[key] = (byMint[key] ?? 0) + summe;
  }
  return byMint;
}
