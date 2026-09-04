/**
 * Vertrag aus Kapitel 5.7: Was die Empfängerauflösung liefert.
 * Betrifft FR-21, FR-22, FR-23.
 */

/** Grund, warum für ein Abo keine Zahlung möglich ist (FR-23). */
export type PaymentTargetFailure =
  /** Im Feed steht keine nostr-Identität (US-07-AC-1). */
  | 'no-npub'
  /** Zum npub ist kein kind:10019 auffindbar (US-07-AC-2). */
  | 'no-nutzap-config'
  /** Keine Schnittmenge zwischen kind:10019-Mints und erlaubter Liste (US-07-AC-3). */
  | 'no-common-mint'
  /**
   * Gemeinsame Mints gibt es, aber keiner davon fuehrt unsere Einheit.
   * NIP-61: die Marker an den `mint`-Tags nennen die Basiseinheiten.
   */
  | 'no-common-unit'
  /** Netzfehler bei der Auflösung; unterscheidbar von "dauerhaft nicht möglich". */
  | 'lookup-failed';

export interface ResolvedPaymentTarget {
  status: 'resolved';
  /** npub des Empfängers, wie im Feed gelesen (FR-21). */
  npub: string;
  /** Derselbe Schlüssel als 32-Byte-Hex (x-only), Ziel des `p`-Tags in FR-27. */
  pubkeyHex: string;
  /** P2PK-Pubkey aus kind:10019, exakt wie im Event. Das `02`-Präfix setzt FR-27 beim Locken. */
  p2pkPubkey: string;
  /** Mint-URLs exakt wie im kind:10019, geschnitten mit der erlaubten Liste (FR-22, NR-07). */
  mints: string[];
  /** Relay-URLs aus kind:10019; nur dorthin geht das kind:9321 (FR-27, NR-02). */
  relays: string[];
  /** Zeitpunkt der Auflösung in epoch ms; Basis für den 24-h-Cache (FR-22). */
  fetchedAt: number;
}

export interface UnresolvedPaymentTarget {
  status: 'unresolved';
  reason: PaymentTargetFailure;
  /** Anzeigetext für die Episodenansicht: nennt den konkret fehlenden Baustein (FR-23). */
  message: string;
  /** npub, sofern er gelesen werden konnte. */
  npub?: string;
  fetchedAt: number;
}

export type PaymentTarget = ResolvedPaymentTarget | UnresolvedPaymentTarget;

export function isPayable(target: PaymentTarget): target is ResolvedPaymentTarget {
  return target.status === 'resolved';
}
