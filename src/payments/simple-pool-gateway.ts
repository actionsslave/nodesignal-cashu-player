/**
 * Echte Relay-Anbindung über nostr-tools (Kapitel 5.2).
 *
 * Die einzige Stelle, an der die App WebSockets zu Relays öffnet (NR-02).
 * Ausschließlich wss — von einer HTTPS-Seite blockiert der Browser ws ohnehin
 * (NFR-05).
 */
import { SimplePool, type Event, type Filter } from 'nostr-tools';
import type { SignedNostrEvent } from '../identity/nip07.js';
import {
  NoRelayError,
  PublishRejectedError,
  type EventFilter,
  type NostrGateway,
  type PublishResult,
} from './nostr-gateway.js';

/** Wartezeit für Verbindungsaufbau und Bestätigung; NFR-02 zielt auf unter 5 s. */
const MAX_WAIT_MS = 5_000;

export class SimplePoolGateway implements NostrGateway {
  private readonly pool = new SimplePool();

  async fetchEvent(relays: string[], filter: EventFilter): Promise<SignedNostrEvent | undefined> {
    const event = await this.pool.get([...relays], filter as Filter, { maxWait: MAX_WAIT_MS });
    return event ? (event as SignedNostrEvent) : undefined;
  }

  /** Verbindet vor dem unwiderruflichen Mint-Swap; liefert die erreichbaren Relays. */
  async connect(relays: string[]): Promise<string[]> {
    const attempts = await Promise.allSettled(
      relays.map((url) => this.pool.ensureRelay(url, { connectionTimeout: MAX_WAIT_MS })),
    );
    const reachable = relays.filter((_url, index) => attempts[index].status === 'fulfilled');
    if (reachable.length === 0) throw new NoRelayError();
    return reachable;
  }

  async publish(relays: string[], event: SignedNostrEvent): Promise<PublishResult> {
    const pending = this.pool
      .publish([...relays], event as unknown as Event, { maxWait: MAX_WAIT_MS })
      .map((promise, index) => promise.then(() => relays[index]));

    try {
      // FR-29: ein einziges OK genügt, und es soll nicht auf das langsamste Relay warten.
      const accepted = await Promise.any(pending);
      return { acceptedBy: [accepted] };
    } catch (cause) {
      throw new PublishRejectedError(
        cause instanceof AggregateError
          ? 'Kein Relay hat das Event bestätigt.'
          : String(cause),
      );
    }
  }
}
