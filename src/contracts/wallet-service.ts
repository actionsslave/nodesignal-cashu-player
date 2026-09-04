/**
 * Vertrag aus Kapitel 5.7: Wallet mit Reserve-Semantik.
 * Die Reserve-Semantik ist der Kern von FR-29: Proofs gelten erst als ausgegeben,
 * wenn ein Relay das Event mit OK bestätigt hat.
 */
import type { ProofLike } from '@cashu/cashu-ts';

/**
 * Proofs, wie sie in IndexedDB liegen: `amount` als Zahl, nicht als Amount-Objekt.
 * cashu-ts nennt diese Form ProofLike und normalisiert sie beim Einlesen.
 */
export type StoredProof = ProofLike;

/** Ein Satz reservierter Proofs, der committed oder freigegeben werden muss (FR-29). */
export interface ProofBundle {
  /** Eindeutige ID der Reservierung. */
  id: string;
  /** Summe der Proof-Beträge in Sat. Kann durch Wechselgeld > angefragtem Betrag sein. */
  amount: number;
  /** Mint, bei dem diese Proofs liegen. */
  mintUrl: string;
  proofs: StoredProof[];
}

export class InsufficientFundsError extends Error {
  constructor(
    readonly requested: number,
    readonly available: number,
  ) {
    super(`Guthaben reicht nicht: ${requested} Sat angefragt, ${available} Sat verfügbar`);
    this.name = 'InsufficientFundsError';
  }
}

export interface WalletService {
  /** Verfügbares Guthaben in Sat, ohne reservierte Proofs (FR-15). */
  balance(): Promise<number>;
  /**
   * Nimmt Proofs über mindestens `amount` Sat aus dem verfügbaren Bestand und sperrt sie.
   * @throws InsufficientFundsError wenn das verfügbare Guthaben nicht reicht.
   */
  reserve(amount: number, mintUrl?: string): Promise<ProofBundle>;
  /** Bestätigt die Ausgabe: die reservierten Proofs werden endgültig entfernt (FR-29). */
  commit(bundle: ProofBundle): Promise<void>;
  /** Gibt eine Reservierung zurück in den verfügbaren Bestand (FR-29, US-06-AC-4). */
  release(bundle: ProofBundle): Promise<void>;
  /** Das gesamte Guthaben als Cashu-Token-String (FR-16). */
  exportAll(): Promise<string>;
}
