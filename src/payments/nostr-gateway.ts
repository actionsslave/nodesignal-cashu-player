/**
 * Relay-Zugriff. Alles, was die App mit nostr-Relays tut, läuft hierüber —
 * damit ist NR-02 an einer Stelle durchzusetzen und die Zahlungslogik ohne
 * Netz prüfbar.
 */
import type { SignedNostrEvent } from '../identity/nip07.js';

export interface EventFilter {
  kinds: number[];
  authors: string[];
  /** Nur fuer kind:7375 noetig: NIP-60 legt beliebig viele davon an. */
  limit?: number;
  /**
   * Nur Events ab diesem Zeitpunkt, in Sekunden seit Epoch — so zaehlt nostr.
   * Gebraucht fuer SOQ-03: Hat ein anderer Client die Wallet angefasst,
   * seit der Float offen ist?
   */
  since?: number;
}

export interface PublishResult {
  /** Relays, die das Event mit OK bestätigt haben (FR-29). */
  acceptedBy: string[];
}

export interface NostrGateway {
  /** Jüngstes Event zu diesem Filter, oder undefined. */
  fetchEvent(relays: string[], filter: EventFilter): Promise<SignedNostrEvent | undefined>;
  /**
   * Alle Events zu diesem Filter. SFR-14 braucht das: Ein Nutzer hat beliebig
   * viele kind:7375, und das Guthaben ist ihre Summe — das juengste allein
   * sagt nichts.
   */
  fetchEvents(relays: string[], filter: EventFilter): Promise<SignedNostrEvent[]>;
  /**
   * Baut die Verbindungen auf, bevor irgendetwas Unwiderrufliches passiert.
   * Liefert die erreichbaren Relays; wirft, wenn keines erreichbar ist.
   */
  connect(relays: string[]): Promise<string[]>;
  /** Publiziert und wartet, bis mindestens ein Relay mit OK bestätigt. */
  publish(relays: string[], event: SignedNostrEvent): Promise<PublishResult>;
}

export class NoRelayError extends Error {
  readonly name = 'NoRelayError';
  constructor(message = 'Kein Relay des Empfängers ist erreichbar.') {
    super(message);
  }
}

export class PublishRejectedError extends Error {
  readonly name = 'PublishRejectedError';
  constructor(message = 'Kein Relay hat das Event bestätigt.') {
    super(message);
  }
}
